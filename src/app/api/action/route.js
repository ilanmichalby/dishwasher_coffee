import { NextResponse } from 'next/server';
import { setDishwasherPowerState, startDishwasherProgram, stopDishwasherProgram } from '@/lib/bosch';
import { triggerFingerbot } from '@/lib/smartthings';
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
        result = await setDishwasherPowerState(applianceId, true);
        break;
      case 'powerOff':
        result = await setDishwasherPowerState(applianceId, false);
        break;
      case 'startQuick':
        result = await startDishwasherProgram(applianceId, 'Dishcare.Dishwasher.Program.Kurz60');
        break;
      case 'stop':
        result = await stopDishwasherProgram(applianceId);
        break;
      
      // --- Coffee Machine ---
      case 'coffeeOn':
        result = await triggerFingerbot(applianceId);
        break;
      case 'coffeePress':
        // Hardcoded SwitchBot device ID as per existing logic in process-queue
        result = await pressBot('E8158ABAA498'); 
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
