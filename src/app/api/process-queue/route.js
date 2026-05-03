import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getDishwashers, startDishwasherProgram } from '@/lib/bosch';
import { triggerFingerbot } from '@/lib/smartthings';
import { APPLIANCE_NAMES } from '@/lib/constants';

// Force dynamic execution for this route (no caching)
export const dynamic = 'force-dynamic';

export async function GET(request) {
  // Simple security check to ensure this is only called by our cron
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // 1. Fetch pending schedules whose time has passed
    const now = new Date().toISOString();
    
    const { data: pendingSchedules, error: dbError } = await supabase
      .from('schedules')
      .select('*')
      .eq('status', 'pending')
      .lte('scheduled_time', now)
      .lt('retry_count', 5); // Max 5 retries

    if (dbError) {
      console.error('Error fetching schedules:', dbError);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    if (!pendingSchedules || pendingSchedules.length === 0) {
      return NextResponse.json({ message: 'No pending schedules to process.' });
    }

    // 2. Fetch dishwashers to get the HaId (Home Appliance ID)
    let dishwashers;
    try {
      dishwashers = await getDishwashers();
    } catch (boschError) {
      console.error('Failed to connect to Bosch API:', boschError);
      return NextResponse.json({ error: 'Bosch API error' }, { status: 502 });
    }

    if (!dishwashers || dishwashers.length === 0) {
      return NextResponse.json({ error: 'No dishwashers found in Bosch account' }, { status: 404 });
    }

    // Assume we use the first dishwasher found
    const dishwasherHaId = dishwashers[0].haId;

    const results = [];

    // 3. Process each schedule
    for (const schedule of pendingSchedules) {
      try {
        // Find the specific dishwasher or fallback to the first one
        const targetHaId = schedule.appliance_id || dishwashers[0].haId;
        const dishwasherName = APPLIANCE_NAMES[targetHaId] || targetHaId;
        
        console.log(`Attempting to start schedule ${schedule.id} on ${dishwasherName}...`);
        
        // Call the appropriate API based on the device type/ID
        if (targetHaId === '9103117a-3163-4aa6-a4fb-b0a50acf832a') {
          console.log(`Triggering SmartThings Fingerbot for ${dishwasherName}...`);
          await triggerFingerbot(targetHaId);
        } else {
          console.log(`Starting Bosch program for ${dishwasherName}...`);
          await startDishwasherProgram(targetHaId, schedule.program_key, schedule.options || {});
        }

        // Mark as completed
        await supabase
          .from('schedules')
          .update({ status: 'completed', last_error: null })
          .eq('id', schedule.id);
          
        results.push({ id: schedule.id, status: 'completed' });

      } catch (error) {
        console.error(`Failed to execute schedule ${schedule.id}:`, error);

        // Increment retry count and save error
        await supabase
          .from('schedules')
          .update({ 
            retry_count: schedule.retry_count + 1,
            last_error: error.message,
            // If it hits max retries, mark as failed
            status: schedule.retry_count + 1 >= 5 ? 'failed' : 'pending'
          })
          .eq('id', schedule.id);
          
        results.push({ id: schedule.id, status: 'failed', error: error.message });
      }
    }

    return NextResponse.json({ message: 'Queue processed', results });

  } catch (error) {
    console.error('Process queue fatal error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
