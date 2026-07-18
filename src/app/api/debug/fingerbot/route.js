import { NextResponse } from 'next/server';
import { getFingerbotDiagnostics, triggerFingerbot } from '@/lib/tuya';

// Read-only Fingerbot diagnostics, meant to be opened from a phone browser:
//   /api/debug/fingerbot?key=YOUR_CRON_SECRET
// Add &press=1 to actually send one test click.
//
// Tells you the two things that matter when "the app can't move the arm":
//   - online:  can the Tuya cloud (and therefore our automation) reach it?
//   - dp_codes_you_can_send: which code the device accepts (switch vs switch_1)
//
// Gated behind CRON_SECRET so it isn't public. No secrets are returned.
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
    const diag = await getFingerbotDiagnostics();

    // The DP codes the device actually accepts, trimmed to what matters.
    const dpCodes = (diag.specifications?.functions || []).map((f) => ({
      code: f.code,
      type: f.type,
      values: f.values,
    }));

    let pressTest = null;
    if (url.searchParams.get('press') === '1') {
      pressTest = await triggerFingerbot()
        .then(() => 'click sent — watch the arm')
        .catch((e) => `failed: ${e.message}`);
    }

    const configuredDp = process.env.TUYA_FINGERBOT_DP_CODE || 'switch_1';
    const dpIsValid = dpCodes.some((d) => d.code === configuredDp);

    return NextResponse.json({
      deviceId: diag.deviceId,
      online: diag.online,
      configured_dp_code: configuredDp,
      configured_dp_code_is_accepted_by_device: dpIsValid,
      dp_codes_you_can_send: dpCodes,
      current_status: diag.status,
      press_test: pressTest,
      hint:
        diag.online === false
          ? 'OFFLINE to the cloud — the automation cannot reach it. Check the Bluetooth gateway / that this is the right device.'
          : dpIsValid
            ? 'Online and the configured DP code is valid. If the arm still does not move, deploy the click fix (PR #1) and test with &press=1.'
            : `Online, but the configured DP code "${configuredDp}" is NOT in the accepted list above — set TUYA_FINGERBOT_DP_CODE to the correct one (likely "switch").`,
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
