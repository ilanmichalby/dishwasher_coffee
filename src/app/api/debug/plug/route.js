import { NextResponse } from 'next/server';
import { getTuyaDevices, getPlugDiagnostics, cycleCoffeePlug, isPlugConfigured } from '@/lib/tuya';

// Coffee-machine plug diagnostics, meant to be opened from a phone browser:
//   /api/debug/plug?key=YOUR_CRON_SECRET
// Add &cycle=1 to actually cut and restore mains once. That switches the
// coffee machine's power off for a few seconds — run it only when you are
// standing next to it, to see that it stays off when power returns.
//
// Without TUYA_PLUG_DEVICE_ID set — or with &list=1 — it lists every device on
// the Tuya project (id, name, online), so you can copy the plug's id into that
// env var, or spot a stale duplicate left behind by re-pairing.
//
// Gated behind CRON_SECRET. No secrets are returned.
export const dynamic = 'force-dynamic';

export async function GET(request) {
  const url = new URL(request.url);
  const key = url.searchParams.get('key');
  const authHeader = request.headers.get('authorization');
  const secret = process.env.CRON_SECRET;

  const authorized = secret && (key === secret || authHeader === `Bearer ${secret}`);
  if (!authorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = { plug_configured: isPlugConfigured() };

    if (!isPlugConfigured() || url.searchParams.get('list') === '1') {
      const result = await getTuyaDevices();
      const list = Array.isArray(result) ? result : (result?.devices || []);
      body.devices = list.map((d) => ({
        id: d.id,
        name: d.name,
        product: d.product_name,
        category: d.category,
        online: d.online,
      }));
    }

    if (!isPlugConfigured()) {
      body.hint = 'Find the Wifi Plug in "devices" and set its id as TUYA_PLUG_DEVICE_ID in the environment, then reload this page.';
      return NextResponse.json(body);
    }

    const diag = await getPlugDiagnostics();
    body.plug = { id: diag.deviceId, name: diag.name, online: diag.online, status: diag.status };

    if (url.searchParams.get('cycle') === '1') {
      body.cycle_test = await cycleCoffeePlug()
        .then((r) => (r.reset ? 'mains cut and restored — did the machine stay off?' : `plug unreachable, nothing changed: ${r.reason}`))
        .catch((e) => `FAILED — power was cut and NOT restored, switch the plug back on now: ${e.message}`);
    }

    body.hint = diag.online === false
      ? 'Plug is OFFLINE to the cloud — the mains reset will be skipped and the sequence runs as before. Check its WiFi (2.4GHz).'
      : 'Plug is online. Use &cycle=1 once, next to the machine, to confirm it stays off when mains returns.';
    return NextResponse.json(body);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
