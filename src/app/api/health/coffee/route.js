import { NextResponse } from 'next/server';
import { getFingerbotDiagnostics } from '@/lib/tuya';
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
const LOOKAHEAD_MS = 48 * 60 * 60 * 1000; // catch this Shabbat's coffee

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

  // Is there a coffee scheduled in the next 48h?
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
  let deviceError = null;
  try {
    const diag = await getFingerbotDiagnostics();
    online = diag.online === true;
  } catch (e) {
    deviceError = e.message;
  }

  // Only worth an alert when a coffee is coming AND we can't confirm the device
  // is online. If nothing is scheduled, an offline gateway isn't urgent yet.
  const healthy = !needsCoffee || online === true;

  const body = {
    healthy,
    fingerbot_online: online,
    device_error: deviceError,
    db_error: dbError ? dbError.message : null,
    upcoming_coffee_count: upcomingCoffee.length,
    next_coffee: upcomingCoffee[0]?.scheduled_time || null,
    checked_at: now.toISOString(),
    message: healthy
      ? (needsCoffee
          ? 'Coffee scheduled and the Fingerbot is online — good to go.'
          : 'No coffee scheduled in the next 48h — nothing to check.')
      : 'Coffee is scheduled but the Fingerbot is OFFLINE. Reboot the Tuya gateway and confirm it reconnects to WiFi BEFORE Shabbat.',
  };

  return NextResponse.json(body, { status: healthy ? 200 : 503 });
}
