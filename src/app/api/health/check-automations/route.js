import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabase-admin';
import { getFingerbotDiagnostics } from '@/lib/tuya';

// Manual automation health check - can be triggered from dashboard
// Returns: status, last check time, coffee schedule, fingerbot status

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    // Verify authorization - allow CRON_SECRET from GitHub Actions or direct API calls
    // Frontend calls don't need auth (they're internal and user is already authenticated)
    const isInternalCall = request.headers.get('x-internal-call') === 'true';
    const hasValidCron = cronSecret && authHeader === `Bearer ${cronSecret}`;

    if (!isInternalCall && !hasValidCron) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const now = new Date();
    const until = new Date(now.getTime() + 48 * 60 * 60 * 1000);
    const COFFEE_ID = '9103117a-3163-4aa6-a4fb-b0a50acf832a';

    // Check for scheduled coffee
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

    // Check Fingerbot connectivity
    let online = null;
    let deviceError = null;
    try {
      const diag = await getFingerbotDiagnostics();
      online = diag.online === true;
    } catch (e) {
      deviceError = e.message;
    }

    const healthy = !needsCoffee || online === true;
    const checkedAt = now.toISOString();

    // Save check result to a simple kv table (if we want to track history)
    try {
      await supabase
        .from('automation_health_checks')
        .insert([{
          checked_at: checkedAt,
          healthy,
          fingerbot_online: online,
          coffee_scheduled: needsCoffee,
          upcoming_coffee_count: upcomingCoffee.length,
          next_coffee: upcomingCoffee[0]?.scheduled_time || null,
          error_message: deviceError || null,
        }]);
    } catch (e) {
      console.warn('Failed to save health check to DB:', e.message);
      // Don't fail the response if we can't save history
    }

    const body = {
      healthy,
      fingerbot_online: online,
      device_error: deviceError,
      db_error: dbError ? dbError.message : null,
      upcoming_coffee_count: upcomingCoffee.length,
      next_coffee: upcomingCoffee[0]?.scheduled_time || null,
      checked_at: checkedAt,
      message: healthy
        ? (needsCoffee
            ? 'Coffee scheduled and the Fingerbot is online — good to go. ✅'
            : 'No coffee scheduled in the next 48h — nothing to check.')
        : 'Coffee is scheduled but the Fingerbot is OFFLINE. Reboot the Tuya gateway! 🚨',
    };

    return NextResponse.json(body, { status: healthy ? 200 : 503 });
  } catch (error) {
    console.error('Health check error:', error);
    return NextResponse.json(
      { error: 'Health check failed', message: error.message },
      { status: 500 }
    );
  }
}

export async function GET(request) {
  // Get last check result
  try {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data, error } = await supabase
      .from('automation_health_checks')
      .select('*')
      .order('checked_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      return NextResponse.json(
        { error: 'No previous checks found' },
        { status: 404 }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching last check:', error);
    return NextResponse.json(
      { error: 'Failed to fetch last check' },
      { status: 500 }
    );
  }
}
