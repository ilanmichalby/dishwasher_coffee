import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabase-admin';
import { APPLIANCE_NAMES } from '@/lib/constants';

// Post-mortem for "it didn't run on Shabbat", meant to be opened from a phone:
//   /api/debug/last-run?key=YOUR_CRON_SECRET        (last 3 days)
//   /api/debug/last-run?key=...&days=7
//
// For every schedule in the window it returns the row's final state plus its
// full schedule_events timeline, and — the part that matters at 8am on a
// Saturday — a one-line Hebrew verdict saying WHERE the sequence stopped
// (never picked up / powered on but never pressed / pressed but never powered
// off / device offline / door open...). Without this, diagnosing a missed run
// means reading raw rows in Supabase.
//
// Gated behind CRON_SECRET. Read-only: it never touches a device.
export const dynamic = 'force-dynamic';

const COFFEE_ID = '9103117a-3163-4aa6-a4fb-b0a50acf832a';

function timeIL(iso) {
  if (!iso) return null;
  return new Date(iso).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' });
}

// Where did this row actually stop? Derived from the event timeline, which is
// the only record of the multi-invocation coffee sequence.
function verdict(schedule, events) {
  const types = events.map((e) => e.event_type);
  const has = (t) => types.includes(t);
  const isCoffee = schedule.appliance_id === COFFEE_ID;

  if (schedule.status === 'completed') {
    if (isCoffee && !has('coffee.press.success')) {
      return 'הסתיים כ"הושלם" אבל אין אירוע לחיצה — לא הוכן קפה.';
    }
    return 'הושלם כרגיל.';
  }

  if (events.length === 0) {
    return 'אף אחד לא אסף את השורה — לא QStash ולא ה-cron. בדקו שה-workflow "Process schedule queue" רץ ושה-secrets APP_URL/CRON_SECRET מוגדרים.';
  }

  if (isCoffee) {
    if (has('coffee.press.success') && !has('coffee.power_off.success')) {
      return 'הקפה הוכן, אבל שלב הכיבוי לא הושלם — המכונה כנראה נשארה דלוקה.';
    }
    if (has('coffee.power_on.success') && !has('coffee.press.success')) {
      return 'המכונה נדלקה אבל שלב הלחיצה לא רץ/נכשל — נדלקה בלי קפה.';
    }
    if (!has('coffee.power_on.success')) {
      return 'שלב ההדלקה לא הצליח — בדקו את ה-Fingerbot ב-/api/debug/fingerbot.';
    }
  } else {
    const waits = types.filter((t) => t === 'dishwasher.waiting_remote_start').length;
    if (waits > 0 && schedule.status !== 'completed') {
      return `המדיח לא אפשר הפעלה מרחוק (Remote Start) ב-${waits} ניסיונות — צריך ללחוץ על כפתור ההפעלה מרחוק במדיח לפני שבת.`;
    }
  }

  const failure = [...events].reverse().find((e) => e.event_type === 'schedule.failed');
  if (failure) {
    return `נכשל: [${failure.details?.error_type || 'UNKNOWN'}] ${failure.details?.message || ''}`;
  }

  return `נעצר בסטטוס "${schedule.status}" אחרי ${events.length} אירועים — ראו את הציר למטה.`;
}

export async function GET(request) {
  const url = new URL(request.url);
  const key = url.searchParams.get('key');
  const authHeader = request.headers.get('authorization');
  const secret = process.env.CRON_SECRET;

  const authorized = secret && (key === secret || authHeader === `Bearer ${secret}`);
  if (!authorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const days = Math.min(Math.max(Number(url.searchParams.get('days')) || 3, 1), 30);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  try {
    const { data: schedules, error: schedErr } = await supabase
      .from('schedules')
      .select('*')
      .gte('scheduled_time', since)
      .order('scheduled_time', { ascending: true });

    if (schedErr) {
      return NextResponse.json({ error: schedErr.message }, { status: 500 });
    }

    const ids = (schedules || []).map((s) => s.id);
    let events = [];
    if (ids.length > 0) {
      const { data: evts, error: evtErr } = await supabase
        .from('schedule_events')
        .select('*')
        .in('schedule_id', ids)
        .order('created_at', { ascending: true });
      if (evtErr) {
        return NextResponse.json({ error: evtErr.message }, { status: 500 });
      }
      events = evts || [];
    }

    const bySchedule = {};
    for (const e of events) {
      (bySchedule[e.schedule_id] ||= []).push(e);
    }

    const report = (schedules || []).map((s) => {
      const evts = bySchedule[s.id] || [];
      return {
        id: s.id,
        appliance: APPLIANCE_NAMES[s.appliance_id] || s.appliance_id,
        program_key: s.program_key,
        scheduled_time: timeIL(s.scheduled_time),
        status: s.status,
        retry_count: s.retry_count,
        last_error: s.last_error,
        verdict: verdict(s, evts),
        timeline: evts.map((e) => ({
          at: timeIL(e.created_at),
          event: e.event_type,
          details: e.details,
        })),
      };
    });

    return NextResponse.json({
      window_days: days,
      generated_at: timeIL(new Date().toISOString()),
      total: report.length,
      by_status: report.reduce((acc, r) => {
        acc[r.status] = (acc[r.status] || 0) + 1;
        return acc;
      }, {}),
      schedules: report,
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
