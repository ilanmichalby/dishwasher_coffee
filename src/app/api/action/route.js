import { NextResponse } from 'next/server';
import { setDishwasherPowerState, startDishwasherProgram, stopDishwasherProgram } from '@/lib/bosch';
import { triggerFingerbot } from '@/lib/tuya';
import { pressBot } from '@/lib/switchbot';

export async function POST(request) {
  try {
    const { action, applianceId } = await request.json();

    if (!action || !applianceId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    let result = false;

    switch (action) {
      // --- Dishwashers ---
      case 'powerOn':
      case 'power-on':
        result = await setDishwasherPowerState(applianceId, true);
        break;
      case 'powerOff':
      case 'power-off':
        result = await setDishwasherPowerState(applianceId, false);
        break;
      case 'startQuick':
      case 'start':
        {
          const { getAvailablePrograms } = require('@/lib/bosch');
          const programs = await getAvailablePrograms(applianceId);
          // Try to find a quick program, fallback to Eco50, fallback to first available
          let programKey = 'Dishcare.Dishwasher.Program.Eco50';
          const quickProg = programs.find(p => p.key.includes('Quick') || p.key.includes('Kurz'));
          if (quickProg) {
            programKey = quickProg.key;
          } else if (programs.length > 0 && !programs.find(p => p.key === programKey)) {
            programKey = programs[0].key;
          }
          result = await startDishwasherProgram(applianceId, programKey);
        }
        break;
      case 'stop':
        result = await stopDishwasherProgram(applianceId);
        break;
      
      // --- Coffee Machine ---
      case 'coffeeOn':
        // Toggle power via Fingerbot (Tuya/Smart Life)
        result = await triggerFingerbot();
        break;
      case 'coffeePress':
        // Press coffee button via SwitchBot Bot
        result = await pressBot(process.env.SWITCHBOT_COFFEE_DEVICE_ID || 'E8158ABAA498'); 
        break;
        
      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }

    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error(`Action API Error:`, error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
