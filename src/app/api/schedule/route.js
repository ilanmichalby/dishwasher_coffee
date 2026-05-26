import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { scheduleWebhook } from '@/lib/qstash';

const COFFEE_ID = '9103117a-3163-4aa6-a4fb-b0a50acf832a';
const COFFEE_MIN_GAP_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Returns an error message if a coffee schedule at `scheduledTime` would be
 * within 5 minutes of another active coffee schedule. excludeId allows skipping
 * the row being edited.
 */
async function checkCoffeeConflict(scheduledTime, excludeId = null) {
  const target = new Date(scheduledTime).getTime();
  const windowStart = new Date(target - COFFEE_MIN_GAP_MS).toISOString();
  const windowEnd = new Date(target + COFFEE_MIN_GAP_MS).toISOString();

  let query = supabase
    .from('schedules')
    .select('id, scheduled_time')
    .eq('appliance_id', COFFEE_ID)
    .in('status', ['pending', 'processing'])
    .gte('scheduled_time', windowStart)
    .lte('scheduled_time', windowEnd);

  if (excludeId) query = query.neq('id', excludeId);

  const { data } = await query;
  if (data && data.length > 0) {
    const conflict = new Date(data[0].scheduled_time).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' });
    return `יש כבר תזמון קפה בשעה ${conflict}. חובה להשאיר לפחות 5 דקות בין תזמונים (כדי שהמכונה תספיק להידלק, להכין ולהיכבות).`;
  }
  return null;
}

export async function POST(request) {
  try {
    const { scheduled_time, program_key, appliance_id } = await request.json();

    if (!scheduled_time || !appliance_id) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Coffee: enforce min 5-minute gap between schedules
    if (appliance_id === COFFEE_ID) {
      const conflictErr = await checkCoffeeConflict(scheduled_time);
      if (conflictErr) {
        return NextResponse.json({ error: conflictErr }, { status: 409 });
      }
    }

    // 1. Save to Supabase
    const { data, error: dbError } = await supabase
      .from('schedules')
      .insert([{
        scheduled_time,
        program_key,
        appliance_id,
        status: 'pending'
      }])
      .select()
      .single();

    if (dbError) {
      console.error('Database error:', dbError);
      return NextResponse.json({ error: 'Failed to save schedule' }, { status: 500 });
    }

    const scheduleId = data.id;

    // 2. Schedule with QStash
    // We use the absolute URL of the process-queue API
    const protocol = process.env.NODE_ENV === 'development' ? 'http' : 'https';
    const host = request.headers.get('host');
    const webhookUrl = `${protocol}://${host}/api/process-queue`;

    try {
      const qstashResult = await scheduleWebhook(webhookUrl, scheduled_time, {
        schedule_id: scheduleId,
        source: 'qstash'
      });
      
      if (!qstashResult) {
        return NextResponse.json({ 
          message: 'נשמר במסד הנתונים, אך התזמון נכשל (חסר QSTASH_TOKEN)', 
          id: scheduleId,
          qstash: false 
        }, { status: 200 }); // Still 200 because DB record exists
      }

      return NextResponse.json({ 
        message: 'Scheduled successfully', 
        id: scheduleId,
        qstash: true 
      });
    } catch (qstashError) {
      console.error('QStash scheduling failed, but record saved to DB:', qstashError);
      // We return success because the DB record is there, but mention the QStash failure
      return NextResponse.json({ 
        message: 'Saved to DB, but QStash scheduling failed', 
        id: scheduleId,
        qstash: false 
      });
    }

  } catch (error) {
    console.error('Schedule API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const { id } = await request.json();

    if (!id) {
      return NextResponse.json({ error: 'Missing schedule ID' }, { status: 400 });
    }

    const { error } = await supabase
      .from('schedules')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json({ error: 'Failed to delete schedule' }, { status: 500 });
    }

    return NextResponse.json({ message: 'Schedule deleted successfully' });
  } catch (error) {
    console.error('Schedule API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request) {
  try {
    const { id, scheduled_time, program_key } = await request.json();

    if (!id) {
      return NextResponse.json({ error: 'Missing schedule ID' }, { status: 400 });
    }

    // Fetch current to see if time changed
    const { data: current, error: fetchError } = await supabase
      .from('schedules')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !current) {
      return NextResponse.json({ error: 'Schedule not found' }, { status: 404 });
    }

    // Coffee: enforce 5-min gap when changing time
    if (current.appliance_id === COFFEE_ID && scheduled_time && scheduled_time !== current.scheduled_time) {
      const conflictErr = await checkCoffeeConflict(scheduled_time, id);
      if (conflictErr) {
        return NextResponse.json({ error: conflictErr }, { status: 409 });
      }
    }

    const updates = {};
    if (scheduled_time) updates.scheduled_time = scheduled_time;
    if (program_key) updates.program_key = program_key;

    const { data, error: dbError } = await supabase
      .from('schedules')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (dbError) {
      console.error('Database error:', dbError);
      return NextResponse.json({ error: 'Failed to update schedule' }, { status: 500 });
    }

    // If time changed, schedule a new webhook
    if (scheduled_time && scheduled_time !== current.scheduled_time) {
      const protocol = process.env.NODE_ENV === 'development' ? 'http' : 'https';
      const host = request.headers.get('host');
      const webhookUrl = `${protocol}://${host}/api/process-queue`;

      try {
        await scheduleWebhook(webhookUrl, scheduled_time, {
          schedule_id: id,
          source: 'qstash_updated'
        });
      } catch (qstashError) {
        console.error('QStash scheduling failed on update:', qstashError);
      }
    }

    return NextResponse.json({ message: 'Schedule updated successfully', data });
  } catch (error) {
    console.error('Schedule API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
