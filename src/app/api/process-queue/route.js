import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getDishwashers, startDishwasherProgram, setDishwasherPowerState, getAvailablePrograms, getDishwasherStatus } from '@/lib/bosch';
import { triggerFingerbot } from '@/lib/tuya';
import { pressBot } from '@/lib/switchbot';
import { APPLIANCE_NAMES } from '@/lib/constants';
import { Receiver } from "@upstash/qstash";

const receiver = new Receiver({
  currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY || "",
  nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY || "",
});


const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Force dynamic execution for this route (no caching)
export const dynamic = 'force-dynamic';

export async function POST(request) {
  return handleRequest(request);
}

export async function GET(request) {
  return handleRequest(request);
}

async function handleRequest(request) {
  // 1. Security Check
  const signature = request.headers.get("x-qstash-signature");
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  
  let isValid = false;

  // Check QStash signature if present
  if (signature && process.env.QSTASH_CURRENT_SIGNING_KEY) {
    try {
      const body = await request.text();
      isValid = await receiver.verify({
        signature,
        body,
      });
    } catch (e) {
      console.error("QStash verification failed:", e);
    }
  } 
  
  // Fallback to CRON_SECRET (for GitHub Actions)
  if (!isValid && cronSecret && authHeader === `Bearer ${cronSecret}`) {
    isValid = true;
  }

  if (!isValid) {
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

    // Build a connectivity map: haId -> connected (boolean)
    const connectivityMap = {};
    for (const dw of dishwashers) {
      connectivityMap[dw.haId] = dw.connected !== false; // treat missing field as connected
    }

    const results = [];

    // 3. Process each schedule
    for (const schedule of pendingSchedules) {
      try {
        // Mark as processing immediately to prevent duplicate runs (atomic check)
        const { data: updated, error: updateError } = await supabase
          .from('schedules')
          .update({ status: 'processing' })
          .eq('id', schedule.id)
          .eq('status', 'pending')
          .select();

        if (updateError || !updated || updated.length === 0) {
          console.log(`Schedule ${schedule.id} already being processed or failed update. Skipping.`);
          continue;
        }

        // Find the specific dishwasher or fallback to the first one
        const targetHaId = schedule.appliance_id || dishwashers[0].haId;
        const dishwasherName = APPLIANCE_NAMES[targetHaId] || targetHaId;
        
        console.log(`Attempting to start schedule ${schedule.id} on ${dishwasherName}...`);
        
        // Call the appropriate API based on the device type/ID
        if (targetHaId === '9103117a-3163-4aa6-a4fb-b0a50acf832a') {
          console.log(`Starting ROBUST COFFEE SEQUENCE for ${dishwasherName}...`);
          
          const switchbotDeviceId = process.env.SWITCHBOT_COFFEE_DEVICE_ID || 'E8158ABAA498';

          // 1. Power ON (Tuya / Smart Life Fingerbot)
          console.log('Step 1: Power ON via Tuya Fingerbot...');
          await triggerFingerbot();
          
          // 2. Wait for heating (60 seconds)
          console.log('Step 2: Waiting 60 seconds for heating...');
          await sleep(60000);
          
          // 3. Press Coffee Button (SwitchBot)
          console.log('Step 3: Pressing coffee button via SwitchBot...');
          await pressBot(switchbotDeviceId);
          
          // 4. Wait for fallback (60 seconds)
          console.log('Step 4: Waiting 60 seconds for fallback...');
          await sleep(60000);

          // 5. Fallback Press (SwitchBot)
          console.log('Step 5: Fallback press via SwitchBot...');
          await pressBot(switchbotDeviceId);

          // 6. Wait for coffee to finish (3 minutes)
          console.log('Step 6: Waiting 3 minutes for coffee to finish...');
          await sleep(180000);

          // 7. Power OFF (Tuya / Smart Life Fingerbot)
          console.log('Step 7: Power OFF via Tuya Fingerbot to reset state...');
          await triggerFingerbot();
          
        } else {
          console.log(`Starting Bosch program for ${dishwasherName}...`);

          // 1. Check connectivity
          if (connectivityMap[targetHaId] === false) {
            const offlineErr = new Error(`המכשיר ${dishwasherName} אינו מחובר (אופליין). לא ניתן להפעיל מרחוק.`);
            offlineErr.errorType = 'DEVICE_OFFLINE';
            throw offlineErr;
          }

          // 2. Always send power-on (idempotent — safe to call even if already on)
          console.log('Step 1: Sending power-on command...');
          await setDishwasherPowerState(targetHaId, true);

          // 3. Short wait then get status (3s keeps us well under Netlify timeout)
          await sleep(3000);
          console.log('Step 2: Checking status after power-on...');
          const statusResponse = await getDishwasherStatus(targetHaId);

          if (!statusResponse) {
            const offlineErr = new Error(`המכשיר ${dishwasherName} אינו מגיב. ייתכן שהוא אופליין.`);
            offlineErr.errorType = 'DEVICE_OFFLINE';
            throw offlineErr;
          }

          const statusList = statusResponse.status || [];
          const remoteStartAllowed = statusList.find(s => s.key === 'BSH.Common.Status.RemoteControlStartAllowed')?.value;
          const doorState = statusList.find(s => s.key === 'BSH.Common.Status.DoorState')?.value;
          const operationState = statusList.find(s => s.key === 'BSH.Common.Status.OperationState')?.value;

          console.log(`Status: operation=${operationState}, remoteStart=${remoteStartAllowed}, door=${doorState}`);

          // Already running — nothing to do
          if (operationState === 'BSH.Common.EnumType.OperationState.Run') {
            console.log('Already running — marking completed.');
          } else {
            // Door check
            if (doorState === 'BSH.Common.EnumType.DoorState.Open') {
              const doorErr = new Error(`דלת ${dishwasherName} פתוחה. יש לסגור את הדלת כדי להפעיל מרחוק.`);
              doorErr.errorType = 'DOOR_OPEN';
              throw doorErr;
            }

            // Remote Start not ready yet → reschedule +45s instead of waiting inline
            if (remoteStartAllowed !== true) {
              console.warn(`Remote Start not ready (${remoteStartAllowed}). Rescheduling +45s...`);
              const retryTime = new Date(Date.now() + 45000).toISOString();
              await supabase
                .from('schedules')
                .update({ status: 'pending', scheduled_time: retryTime, last_error: `[WAITING_REMOTE_START] got=${remoteStartAllowed}` })
                .eq('id', schedule.id);
              results.push({ id: schedule.id, status: 'rescheduled', reason: 'waiting_remote_start' });
              continue;
            }

            // 4. Get available programs
            console.log('Step 3: Getting available programs...');
            const availablePrograms = await getAvailablePrograms(targetHaId);

            if (!availablePrograms || availablePrograms.length === 0) {
              console.warn('No programs available yet. Rescheduling +30s...');
              const retryTime = new Date(Date.now() + 30000).toISOString();
              await supabase
                .from('schedules')
                .update({ status: 'pending', scheduled_time: retryTime, last_error: `[NO_PROGRAMS] programs list empty` })
                .eq('id', schedule.id);
              results.push({ id: schedule.id, status: 'rescheduled', reason: 'no_programs' });
              continue;
            }

            let finalProgramKey = schedule.program_key;
            const isSupported = availablePrograms.some(p => p.key === finalProgramKey);

            if (!isSupported) {
              console.warn(`Program ${finalProgramKey} not found. Finding match...`);
              const requestedBase = finalProgramKey.split('.').pop().replace(/[0-9]/g, '');
              const match = availablePrograms.find(p => p.key.includes(requestedBase));
              if (match) {
                finalProgramKey = match.key;
                console.log(`Using matched program: ${finalProgramKey}`);
              } else {
                const fallback = availablePrograms.find(p => p.key.includes('Eco50')) || availablePrograms[0];
                finalProgramKey = fallback?.key;
                console.log(`Fallback program: ${finalProgramKey}`);
              }
            }

            // 5. Start program
            console.log(`Step 4: Starting program ${finalProgramKey}...`);
            await startDishwasherProgram(targetHaId, finalProgramKey, schedule.options || {});
          }
        }

        // Mark as completed
        await supabase
          .from('schedules')
          .update({ status: 'completed', last_error: null })
          .eq('id', schedule.id);
          
        results.push({ id: schedule.id, status: 'completed' });

      } catch (error) {
        const errorType = error.errorType || 'UNKNOWN';
        console.error(`Failed to execute schedule ${schedule.id} [${errorType}]:`, error.message);

        const newRetryCount = schedule.retry_count + 1;
        const isFatal = errorType === 'DOOR_OPEN' || errorType === 'REMOTE_START_DISABLED';
        // Fatal errors (door open, no remote start) don't benefit from retrying — mark failed immediately
        const newStatus = isFatal || newRetryCount >= 5 ? 'failed' : 'pending';

        // Save structured error info to DB for dashboard display
        const logMessage = `[${new Date().toISOString()}] [${errorType}] ${error.message}`;
        await supabase
          .from('schedules')
          .update({ 
            retry_count: newRetryCount,
            last_error: logMessage,
            status: newStatus
          })
          .eq('id', schedule.id);
          
        results.push({ id: schedule.id, status: newStatus, error: error.message, errorType });
      }
    }

    return NextResponse.json({ message: 'Queue processed', results });

  } catch (error) {
    console.error('Process queue fatal error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
