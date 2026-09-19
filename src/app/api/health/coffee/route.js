import { NextResponse } from 'next/server';
import { getFingerbotDiagnostics } from '@/lib/tuya';
import { getBotStatus } from '@/lib/switchbot';
import { supabaseAdmin as supabase } from '@/lib/supabase-admin';

// Pre-Shabbat coffee health check.
//
// The failure that ruined Shabbat was invisible: the Tuya gateway dropped off
// WiFi, the Fingerbot went offline to the cloud, and the scheduled coffee
// silently never ran. Software can't reconnect a gateway — but it CAN warn you
// while there's still time to reboot it. This endpoint reports "unhealthy"
// (HTTP 503) only when a coffee is actually scheduled soon AND the Fingerbot is
// not confirmably reachable from the cloud. A Friday GitHub Action hits it and
// emails you on 503.
//
// Auth: CRON_SECRET, via ?key= or Authorization: Bearer. No secrets returned.

const COFFEE_ID = '9103117a-3163-4aa6-a4fb-b0a50acf832a';
// Lookahead is 72h, not 48h. A two-day chag adjacent to Shabbat — Rosh
// Hashanah 2026 ran Sat-Sun — is scheduled in one Friday-afternoon sitting,
// and 48h from that sitting stops short of the final day's runs, so the last
// appliance in the queue was never checked. 72h also matches exactly what the
// printed sheet shows (3 days), so the paper on the fridge and the check that
// cleared it now describe the same set of runs.
const LOOKAHEAD_MS = 72 * 60 * 60 * 1000;
// Below this the arm can stall mid-press while the API still reports success —
// "coffee.press.success in the log, no coffee in the cup". Warn while there is
// still time to swap the batteries.
const MIN_BOT_BATTERY = Number(process.env.SWITCHBOT_MIN_BATTERY) > 0
  ? Number(process.env.SWITCHBOT_MIN_BATTERY)
  : 25;

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

  // Is there a coffee scheduled in the lookahead window?
  const { data: upcoming, error: dbError } = await supabase
    .from('schedules')
    .select('id, scheduled_time, program_key')
    .eq('appliance_id', COFFEE_ID)
    .eq('status', 'pending')
    .gte('scheduled_time', now.toISOString())
    .lte('scheduled_time', until.toISOString())
    .order('scheduled_time', { ascending: true });

  const upcomingCoffee = dbError ? [] : (upcoming || []);
  const needsCoffee = upcomingCoffee.length > 0;

  // Can the cloud reach the Fingerbot right now?
  let online = null;
  let lastDpValue = null;
  let deviceError = null;
  try {
    const diag = await getFingerbotDiagnostics();
    online = diag.online === true;
    // Reported for information only. This Fingerbot is in click mode: it
    // clicks and returns by itself, so a DP reading of `true` is just the last
    // command's value, NOT an arm stuck in the pressed position. Don't fail the
    // check on it — that would email a false alarm every Friday.
    const dpCode = process.env.TUYA_FINGERBOT_DP_CODE || 'switch_1';
    lastDpValue = (diag.status || []).find((s) => s.code === dpCode)?.value ?? null;
  } catch (e) {
    deviceError = e.message;
  }

  // The brew button itself: is the SwitchBot reachable, in press mode, and
  // does it still have the battery to actually push?
  let bot = null;
  let botError = null;
  try {
    const status = await getBotStatus(process.env.SWITCHBOT_COFFEE_DEVICE_ID || 'E8158ABAA498');
    bot = {
      battery: status.battery ?? null,
      mode: status.deviceMode ?? null,
      power: status.power ?? null,
    };
  } catch (e) {
    botError = e.message;
  }

  const botBatteryLow = bot?.battery != null && bot.battery < MIN_BOT_BATTERY;
  // switchMode makes the arm hold a position instead of clicking — the command
  // succeeds and nothing gets brewed.
  const botWrongMode = bot?.mode != null && bot.mode !== 'pressMode';

  // Only worth an alert when a coffee is coming AND something on the path from
  // the cloud to the button is not confirmably in order. If nothing is
  // scheduled, an offline gateway isn't urgent yet.
  const healthy = !needsCoffee || (online === true && !botBatteryLow && !botWrongMode && !botError);

  const body = {
    healthy,
    fingerbot_online: online,
    fingerbot_last_dp_value: lastDpValue,
    device_error: deviceError,
    db_error: dbError ? dbError.message : null,
    switchbot: bot,
    switchbot_error: botError,
    switchbot_battery_low: botBatteryLow,
    switchbot_wrong_mode: botWrongMode,
    upcoming_coffee_count: upcomingCoffee.length,
    next_coffee: upcomingCoffee[0]?.scheduled_time || null,
    checked_at: now.toISOString(),
    message: healthy
      ? (needsCoffee
          ? 'Coffee scheduled, Fingerbot online and the SwitchBot can press — good to go.'
          : 'No coffee scheduled in the next 72h — nothing to check.')
      : online !== true
        ? 'Coffee is scheduled but the Fingerbot is OFFLINE. Reboot the Tuya gateway and confirm it reconnects to WiFi BEFORE Shabbat.'
        : botBatteryLow
          ? `Coffee is scheduled but the SwitchBot battery is at ${bot.battery}%. Replace it before Shabbat — a weak arm reports success without pressing.`
          : botWrongMode
            ? `Coffee is scheduled but the SwitchBot is in "${bot.mode}", not pressMode — it will hold instead of clicking. Fix it in the SwitchBot app.`
            : `Coffee is scheduled but the SwitchBot status could not be read: ${botError}`,
  };

  return NextResponse.json(body, { status: healthy ? 200 : 503 });
}
