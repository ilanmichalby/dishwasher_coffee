import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { scheduleWebhook } from '@/lib/qstash';

export async function POST(request) {
  try {
    const { scheduled_time, program_key, appliance_id } = await request.json();

    if (!scheduled_time || !appliance_id) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
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
      await scheduleWebhook(webhookUrl, scheduled_time, {
        schedule_id: scheduleId,
        source: 'qstash'
      });
      
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
