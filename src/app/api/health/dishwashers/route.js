import { NextResponse } from 'next/server';
import { getDishwashers, getDishwasherStatus } from '@/lib/bosch';
import { supabaseAdmin as supabase } from '@/lib/supabase-admin';
import { APPLIANCE_NAMES } from '@/lib/constants';

// Pre-Shabbat dishwasher check.
//
// You can't fix a dishwasher on Shabbat. Everything that makes a scheduled run
// fail is visible on Friday afternoon — the appliance dropped off WiFi, the
// door is open, or "remote start" was never armed on the panel — and every one
// of those is a 30-second fix WHILE THERE IS STILL TIME. This reports
// unhealthy (HTTP 503) when a dishwasher has a run scheduled in the next 48h
// and something about it would make that run fail. The Friday GitHub Action
// hits it and emails on 503.
//
// Auth: CRON_SECRET, via ?key= or Authorization: Bearer. No secrets returned.

const COFFEE_ID = '9103117a-3163-4aa6-a4fb-b0a50acf832a';
const LOOKAHEAD_MS = 48 * 60 * 60 * 1000;

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const url = new URL(request.url);
  const key = url.searchParams.get('key');
  const authHeader = request.headers.get('authorization');
  const secret = process.env.CRON_SECRET;

  if (!secret || (key !== secret && authHeader !== `Bearer ${secret}`)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();
  const until = new Date(now.getTime() + LOOKAHEAD_MS);

  const { data: upcoming, error: dbError } = await supabase
    .from('schedules')
    .select('id, scheduled_time, program_key, appliance_id')
    .neq('appliance_id', COFFEE_ID)
    .eq('status', 'pending')
    .gte('scheduled_time', now.toISOString())
    .lte('scheduled_time', until.toISOString())
    .order('scheduled_time', { ascending: true });

  const upcomingRuns = dbError ? [] : (upcoming || []);

  if (upcomingRuns.length === 0) {
    return NextResponse.json({
      healthy: true,
      upcoming_run_count: 0,
      db_error: dbError ? dbError.message : null,
      checked_at: now.toISOString(),
      message: 'No dishwasher runs scheduled in the next 48h — nothing to check.',
    });
  }

  let devices = [];
  let fetchError = null;
  try {
    devices = await getDishwashers();
  } catch (e) {
    fetchError = e.message;
  }

  // Two severities, because they demand different things of you.
  //   blockers — will not fix themselves and need real time: an appliance off
  //              the network, remote start never armed, a device that Bosch
  //              will not even list. These fail the check and raise an alert.
  //   warnings — almost certainly not a fault at all. An open door 45 minutes
  //              before candle lighting means you are mid-load, which is
  //              exactly when this runs. Alerting on it every single week is
  //              how you train someone to ignore the alert that matters. The
  //              caller decides: the manual button treats it as a reminder,
  //              the last scheduled check treats it as a blocker.
  const blockers = [];
  const warnings = [];
  const report = [];

  // Only inspect the appliances that actually have a run coming.
  const scheduledIds = [...new Set(upcomingRuns.map((r) => r.appliance_id))];

  for (const haId of scheduledIds) {
    const name = APPLIANCE_NAMES[haId] || haId;
    const device = devices.find((d) => d.haId === haId);
    const entry = {
      appliance: name,
      next_run: upcomingRuns.find((r) => r.appliance_id === haId)?.scheduled_time || null,
      connected: device ? device.connected !== false : null,
      door: null,
      remote_start_allowed: null,
      error: null,
    };

    if (!device) {
      entry.error = fetchError || 'Appliance not returned by the Bosch API.';
      blockers.push(`${name}: לא נמצא ברשימת המכשירים של Bosch.`);
      report.push(entry);
      continue;
    }

    if (entry.connected === false) {
      blockers.push(`${name}: מנותק מהרשת. בדקו WiFi/ראוטר והפעילו "חיבור רשת קבוע" בתפריט המדיח.`);
    }

    // Door and remote-start are the other two silent killers. Both are only
    // readable when the appliance answers, so a failure here is informative,
    // not fatal on its own. Note that remote_start_allowed was observed to
    // stay true while the door was open, so it does not stand in for the door
    // check — on 2026-09-18 only the explicit door check caught it.
    try {
      const status = await getDishwasherStatus(haId);
      const list = status?.status || [];
      const door = list.find((s) => s.key === 'BSH.Common.Status.DoorState')?.value;
      const remote = list.find((s) => s.key === 'BSH.Common.Status.RemoteControlStartAllowed')?.value;
      entry.door = door ? door.split('.').pop() : null;
      entry.remote_start_allowed = remote ?? null;

      if (door === 'BSH.Common.EnumType.DoorState.Open') {
        warnings.push(`${name}: הדלת פתוחה — אם סיימתם לסדר, סגרו אותה.`);
      }
      if (remote === false) {
        blockers.push(`${name}: הפעלה מרחוק לא מאושרת. לחצו על כפתור ההפעלה מרחוק בלוח המדיח.`);
      }
    } catch (e) {
      entry.error = e.message;
    }

    report.push(entry);
  }

  // `strict=1` is the last check before candle lighting: by then "still
  // loading" is no longer a plausible excuse for an open door.
  const strict = url.searchParams.get('strict') === '1';
  const problems = strict ? [...blockers, ...warnings] : blockers;
  const healthy = problems.length === 0;

  return NextResponse.json({
    healthy,
    strict,
    upcoming_run_count: upcomingRuns.length,
    dishwashers: report,
    problems,
    blockers,
    warnings,
    fetch_error: fetchError,
    db_error: dbError ? dbError.message : null,
    checked_at: now.toISOString(),
    message: healthy
      ? (warnings.length > 0
          ? `מוכן. שימו לב: ${warnings.join(' | ')}`
          : 'Dishwasher runs are scheduled and every appliance is reachable and ready.')
      : problems.join(' | '),
  }, { status: healthy ? 200 : 503 });
}
