import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabase-admin';
import { getDishwashers, startDishwasherProgram, setDishwasherPowerState, getAvailablePrograms, getDishwasherStatus } from '@/lib/bosch';
import { triggerFingerbot } from '@/lib/tuya';
import { pressBot } from '@/lib/switchbot';
import { scheduleWebhook } from '@/lib/qstash';
import { APPLIANCE_NAMES } from '@/lib/constants';
import { Receiver } from "@upstash/qstash";

const receiver = new Receiver({
  currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY || "",
  nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY || "",
});


const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const COFFEE_ID = '9103117a-3163-4aa6-a4fb-b0a50acf832a';
// 3 retries, 15 minutes apart → attempts at ~+15/+30/+45 min after the failure
const DISHWASHER_MAX_RETRIES = 3;
const COFFEE_MAX_RETRIES = 20;

function envNumber(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

const COFFEE_PRESS_RETRY_INTERVAL_MS = envNumber('COFFEE_PRESS_INTERVAL_MS', 60000);
const COFFEE_POWER_OFF_DELAY_MS = envNumber('COFFEE_POWER_OFF_DELAY_MS', 120000);
const DISHWASHER_RETRY_INTERVAL_MS = envNumber('DISHWASHER_RETRY_INTERVAL_MS', 15 * 60 * 1000);

async function logScheduleEvent(scheduleId, eventType, details = {}) {
  const { error } = await supabase
    .from('schedule_events')
    .insert([{ schedule_id: scheduleId, event_type: eventType, details }]);

  if (error) {
    console.warn(`Schedule event log skipped (${eventType}):`, error.message);
  }
}

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
    // 0. Cleanup: reset stuck 'processing' rows back to 'pending'
    // (covers cases where a previous run timed out mid-step on Netlify).
    // The claim below bumps scheduled_time to the claim moment, so this only
    // catches rows claimed >2 minutes ago — NOT rows another invocation
    // claimed seconds ago whose original schedule time is old. (That race is
    // what caused the duplicate 02:00 runs.)
    const stuckCutoff = new Date(Date.now() - 2 * 60 * 1000).toISOString();
    await supabase
      .from('schedules')
      .update({ status: 'pending' })
      .eq('status', 'processing')
      .lt('scheduled_time', stuckCutoff);

    // 1. Fetch pending schedules whose time has passed
    const now = new Date().toISOString();
    
    const { data: pendingSchedules, error: dbError } = await supabase
      .from('schedules')
      .select('*')
      .eq('status', 'pending')
      .lte('scheduled_time', now)
      .lt('retry_count', COFFEE_MAX_RETRIES);

    if (dbError) {
      console.error('Error fetching schedules:', dbError);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    if (!pendingSchedules || pendingSchedules.length === 0) {
      return NextResponse.json({ message: 'No pending schedules to process.' });
    }

    // 2. Split schedules: coffee vs dishwasher
    const coffeeSchedules = pendingSchedules.filter(s => s.appliance_id === COFFEE_ID);
    const dishwasherSchedules = pendingSchedules.filter(s => s.appliance_id !== COFFEE_ID && s.retry_count < DISHWASHER_MAX_RETRIES);

    // 3. Fetch dishwashers only if there are dishwasher schedules
    let dishwashers = [];
    const connectivityMap = {};

    if (dishwasherSchedules.length > 0) {
      try {
        dishwashers = await getDishwashers();
      } catch (boschError) {
        console.error('Failed to connect to Bosch API:', boschError);
        // Don't bail — still process coffee schedules below
      }

      if (dishwashers && dishwashers.length > 0) {
        for (const dw of dishwashers) {
          connectivityMap[dw.haId] = dw.connected !== false;
        }
      }
    }

    const results = [];
    const allSchedules = [...coffeeSchedules, ...dishwasherSchedules];

    // 4. Process each schedule
    for (const schedule of allSchedules) {
      try {
        // Mark as processing immediately to prevent duplicate runs (atomic check).
        // scheduled_time is bumped to "now" so the stuck-row cleanup measures
        // time since the claim, not since the original schedule time.
        const { data: updated, error: updateError } = await supabase
          .from('schedules')
          .update({ status: 'processing', scheduled_time: new Date().toISOString() })
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
        await logScheduleEvent(schedule.id, 'schedule.processing', {
          appliance_id: targetHaId,
          program_key: schedule.program_key,
          scheduled_time: schedule.scheduled_time,
        });
        
        // Call the appropriate API based on the device type/ID
        if (targetHaId === COFFEE_ID) {
          const isBrewOnly = schedule.program_key === 'coffee.brew_only';
          const switchbotDeviceId = process.env.SWITCHBOT_COFFEE_DEVICE_ID || 'E8158ABAA498';

          // Determine current step from marker in last_error; default = first step.
          const stepMatch = schedule.last_error?.match(/\[COFFEE_STEP=(\w+)\]/);
          const rawStep = stepMatch ? stepMatch[1] : (isBrewOnly ? 'PRESS' : 'POWER_ON');
          const step = rawStep === 'PRESS_RETRY' ? 'PRESS' : rawStep;
          console.log(`COFFEE SEQUENCE (${isBrewOnly ? 'brew_only' : 'full'}) step=${step} for ${dishwasherName}...`);

          const protocol = process.env.NODE_ENV === 'development' ? 'http' : 'https';
          const host = request.headers.get('host');
          const webhookUrl = `${protocol}://${host}/api/process-queue`;

          // IMPORTANT: persist next-step state BEFORE the slow device call,
          // so a Netlify timeout mid-call doesn't strand the row in 'processing'.
          if (step === 'POWER_ON') {
            const nextTime = new Date(Date.now() + 60000).toISOString();
            const { error: rescheduleErr } = await supabase
              .from('schedules')
              .update({ status: 'pending', scheduled_time: nextTime, last_error: '[COFFEE_STEP=PRESS]' })
              .eq('id', schedule.id);
            if (rescheduleErr) console.error('Coffee POWER_ON reschedule DB error:', rescheduleErr);
            const qres = await scheduleWebhook(webhookUrl, nextTime, { schedule_id: schedule.id, source: 'qstash' });
            console.log(`Coffee step 1: scheduled PRESS at ${nextTime}. QStash:`, qres ? 'scheduled' : 'skipped');
            await logScheduleEvent(schedule.id, 'coffee.power_on.next_scheduled', { next_step: 'PRESS', next_time: nextTime });

            console.log('Coffee step 1: Power ON via Tuya Fingerbot...');
            await triggerFingerbot();
            await logScheduleEvent(schedule.id, 'coffee.power_on.success');

            results.push({ id: schedule.id, status: 'rescheduled', step: 'PRESS' });
            continue;
          }

          if (step === 'PRESS') {
            // Exactly ONE press. Every extra press = an extra (wasted) cup.
            // Persist the next step BEFORE the slow SwitchBot call so a
            // Netlify timeout or QStash retry can never trigger a second
            // press. If the API call itself fails, the catch below reverts
            // the row to PRESS for a retry.
            const powerOffTime = new Date(Date.now() + COFFEE_POWER_OFF_DELAY_MS).toISOString();
            if (!isBrewOnly) {
              const { error: preErr } = await supabase
                .from('schedules')
                .update({ status: 'pending', scheduled_time: powerOffTime, last_error: '[COFFEE_STEP=POWER_OFF]' })
                .eq('id', schedule.id);
              if (preErr) console.error('Coffee PRESS pre-persist DB error:', preErr);
            }

            console.log('Coffee step 2: single press via SwitchBot...');
            const switchbotResult = await pressBot(switchbotDeviceId);
            await logScheduleEvent(schedule.id, 'coffee.press.success', {
              device_id: switchbotDeviceId,
              switchbot_status: switchbotResult?.statusCode,
              switchbot_message: switchbotResult?.message,
            });

            if (!isBrewOnly) {
              await scheduleWebhook(webhookUrl, powerOffTime, { schedule_id: schedule.id, source: 'qstash' });
              console.log(`Coffee press done: scheduled POWER_OFF at ${powerOffTime}.`);
              await logScheduleEvent(schedule.id, 'coffee.power_off.next_scheduled', {
                next_step: 'POWER_OFF',
                next_time: powerOffTime,
              });

              results.push({ id: schedule.id, status: 'rescheduled', step: 'POWER_OFF' });
              continue;
            }
            // brew_only: fall through to mark completed after the single press
          } else if (step === 'POWER_OFF') {
            // 3. Power OFF via Tuya Fingerbot
            console.log('Coffee step 3: Power OFF via Tuya Fingerbot...');
            await triggerFingerbot();
            await logScheduleEvent(schedule.id, 'coffee.power_off.success');
            // fall through to mark completed
          }

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
        await logScheduleEvent(schedule.id, 'schedule.completed');
          
        results.push({ id: schedule.id, status: 'completed' });

      } catch (error) {
        const errorType = error.errorType || 'UNKNOWN';
        console.error(`Failed to execute schedule ${schedule.id} [${errorType}]:`, error.message);
        await logScheduleEvent(schedule.id, 'schedule.failed', {
          error_type: errorType,
          message: error.message,
          switchbot_response: error.switchbotResponse,
        });

        const newRetryCount = schedule.retry_count + 1;
        const isCoffee = schedule.appliance_id === COFFEE_ID;
        const maxRetries = isCoffee ? COFFEE_MAX_RETRIES : DISHWASHER_MAX_RETRIES;
        // Door open / device offline are recoverable — someone may close the
        // door or the connection may return — so every dishwasher failure gets
        // the full retry budget before being marked failed.
        const newStatus = newRetryCount >= maxRetries ? 'failed' : 'pending';

        // Save structured error info to DB for dashboard display
        const logMessage = `[${new Date().toISOString()}] [${errorType}] ${error.message}`;
        const updates = {
          retry_count: newRetryCount,
          last_error: logMessage,
          status: newStatus
        };

        if (isCoffee && newStatus === 'pending') {
          // Always keep the current step marker on coffee errors — losing it
          // restarts the sequence from POWER_ON, which toggles power again.
          const currentStepMatch = schedule.last_error?.match(/\[COFFEE_STEP=(\w+)\]/);
          const isBrewOnly = schedule.program_key === 'coffee.brew_only';
          const currentStep = currentStepMatch ? currentStepMatch[1] : (isBrewOnly ? 'PRESS' : 'POWER_ON');
          updates.last_error = `[COFFEE_STEP=${currentStep}] ${logMessage}`;

          // Retry the press only when the SwitchBot API call itself failed —
          // in that case no coffee was made, so a re-press is safe.
          if (errorType === 'SWITCHBOT_COMMAND_FAILED') {
            const retryTime = new Date(Date.now() + COFFEE_PRESS_RETRY_INTERVAL_MS).toISOString();
            updates.scheduled_time = retryTime;

            const protocol = process.env.NODE_ENV === 'development' ? 'http' : 'https';
            const host = request.headers.get('host');
            const webhookUrl = `${protocol}://${host}/api/process-queue`;
            await scheduleWebhook(webhookUrl, retryTime, { schedule_id: schedule.id, source: 'qstash_switchbot_retry' });
            await logScheduleEvent(schedule.id, 'coffee.switchbot.retry_scheduled', {
              step: currentStep,
              next_time: retryTime,
              retry_count: newRetryCount,
            });
          }
        } else if (!isCoffee && newStatus === 'pending') {
          // Dishwasher retry: try again in 15 minutes (→ ~+15/+30/+45 min
          // after the original failure). Without bumping scheduled_time the
          // row would be retried on the very next queue run instead.
          const retryTime = new Date(Date.now() + DISHWASHER_RETRY_INTERVAL_MS).toISOString();
          updates.scheduled_time = retryTime;

          try {
            const protocol = process.env.NODE_ENV === 'development' ? 'http' : 'https';
            const host = request.headers.get('host');
            const webhookUrl = `${protocol}://${host}/api/process-queue`;
            await scheduleWebhook(webhookUrl, retryTime, { schedule_id: schedule.id, source: 'qstash_dishwasher_retry' });
          } catch (qstashError) {
            // The row stays 'pending' with the retry time, so a later queue
            // run still picks it up even if QStash scheduling failed.
            console.error('Dishwasher retry QStash scheduling failed:', qstashError);
          }

          await logScheduleEvent(schedule.id, 'dishwasher.retry_scheduled', {
            error_type: errorType,
            attempt: newRetryCount,
            max_attempts: maxRetries,
            next_time: retryTime,
          });
        }

        await supabase
          .from('schedules')
          .update(updates)
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
