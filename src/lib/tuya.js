import crypto from 'crypto';

const TUYA_API_URL = 'https://openapi.tuyaeu.com'; // EU Data Center (closest to Israel)

let cachedToken = null;
let tokenExpiry = 0;

/**
 * Gets a Tuya Cloud access token (cached until expiry)
 */
async function getTuyaAccessToken() {
  const now = Date.now();
  if (cachedToken && now < tokenExpiry) {
    return cachedToken;
  }

  const clientId = process.env.TUYA_CLIENT_ID;
  const clientSecret = process.env.TUYA_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('TUYA_CLIENT_ID or TUYA_CLIENT_SECRET is not configured');
  }

  const t = now.toString();
  const httpMethod = 'GET';
  const contentHash = crypto.createHash('sha256').update('').digest('hex');
  const headersStr = '';
  const urlStr = '/v1.0/token?grant_type=1';
  const stringToSign = [httpMethod, contentHash, headersStr, urlStr].join('\n');
  const signStr = clientId + t + stringToSign;
  const sign = crypto
    .createHmac('sha256', clientSecret)
    .update(signStr)
    .digest('hex')
    .toUpperCase();

  const response = await fetch(`${TUYA_API_URL}/v1.0/token?grant_type=1`, {
    method: 'GET',
    headers: {
      client_id: clientId,
      sign: sign,
      t: t,
      sign_method: 'HMAC-SHA256',
    },
  });

  const data = await response.json();

  if (!data.success) {
    throw new Error(`Tuya auth failed: ${data.msg} (code: ${data.code})`);
  }

  cachedToken = data.result.access_token;
  tokenExpiry = now + (data.result.expire_time * 1000) - 60000; // refresh 1min before expiry

  return cachedToken;
}

/**
 * Makes an authenticated Tuya Cloud API request
 */
async function tuyaRequest(method, path, body = null) {
  const clientId = process.env.TUYA_CLIENT_ID;
  const clientSecret = process.env.TUYA_CLIENT_SECRET;
  const token = await getTuyaAccessToken();

  const t = Date.now().toString();
  const bodyStr = body ? JSON.stringify(body) : '';
  const contentHash = crypto.createHash('sha256').update(bodyStr).digest('hex');
  const signStr = [clientId, token, t, [method, contentHash, '', path].join('\n')].join('');
  const sign = crypto
    .createHmac('sha256', clientSecret)
    .update(signStr)
    .digest('hex')
    .toUpperCase();

  const response = await fetch(`${TUYA_API_URL}${path}`, {
    method,
    headers: {
      client_id: clientId,
      access_token: token,
      sign: sign,
      t: t,
      sign_method: 'HMAC-SHA256',
      'Content-Type': 'application/json',
    },
    body: body ? bodyStr : undefined,
  });

  const data = await response.json();

  if (!data.success) {
    throw new Error(`Tuya API error: ${data.msg} (code: ${data.code})`);
  }

  return data.result;
}

/**
 * Lists all devices linked to the Tuya project
 */
export async function getTuyaDevices() {
  return await tuyaRequest('GET', '/v1.0/iot-01/associated-users/devices');
}

/**
 * Diagnostics for the configured Fingerbot: whether the cloud can reach it
 * (online) and which DP codes it actually accepts. Used by the debug endpoint
 * so it can be read from a phone browser without running anything locally.
 */
export async function getFingerbotDiagnostics() {
  const deviceId = process.env.TUYA_FINGERBOT_DEVICE_ID;
  if (!deviceId) {
    throw new Error('TUYA_FINGERBOT_DEVICE_ID is not configured');
  }
  const [info, specifications, status] = await Promise.all([
    tuyaRequest('GET', `/v1.0/devices/${deviceId}`),
    tuyaRequest('GET', `/v1.0/devices/${deviceId}/specifications`),
    tuyaRequest('GET', `/v1.0/devices/${deviceId}/status`),
  ]);
  return { deviceId, online: info?.online, info, specifications, status };
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// How long the arm stays pressed down before releasing (a real "click").
const FINGERBOT_SUSTAIN_MS = Number(process.env.TUYA_FINGERBOT_SUSTAIN_MS) > 0
  ? Number(process.env.TUYA_FINGERBOT_SUSTAIN_MS)
  : 2000;

/**
 * Reads a single DP value from the device's current status.
 */
async function readDpValue(deviceId, dpCode) {
  const status = await tuyaRequest('GET', `/v1.0/devices/${deviceId}/status`);
  return (status || []).find((s) => s.code === dpCode)?.value;
}

async function sendDp(deviceId, dpCode, value) {
  return await tuyaRequest('POST', `/v1.0/iot-03/devices/${deviceId}/commands`, {
    commands: [{ code: dpCode, value }],
  });
}

// --- Coffee machine power plug ------------------------------------------------
//
// The Fingerbot "power" press is a TOGGLE and nothing reads the machine's real
// state back, so one physical press that silently didn't land (the cloud still
// answers success) inverts every later run: power-on switches it OFF, the brew
// press hits a dead machine, and the power-off switches it back ON.
//
// The machine stays off when mains returns, so cutting and restoring power
// forces it into a KNOWN state (off) before each full sequence. After that the
// single Fingerbot press always means "turn on". The plug has no metering, so
// this cannot DETECT a missed press — it stops one miss from cascading.
//
// Optional: with no TUYA_PLUG_DEVICE_ID everything below is skipped and the
// sequence behaves exactly as before.

export function isPlugConfigured() {
  return Boolean(process.env.TUYA_PLUG_DEVICE_ID);
}

const plugDpCode = () => process.env.TUYA_PLUG_DP_CODE || 'switch_1';

// How long mains stays cut. Long enough for the machine to drop its state.
const PLUG_OFF_MS = Number(process.env.TUYA_PLUG_OFF_MS) > 0
  ? Number(process.env.TUYA_PLUG_OFF_MS)
  : 3000;

async function sendPlug(value) {
  const deviceId = process.env.TUYA_PLUG_DEVICE_ID;
  try {
    return await sendDp(deviceId, plugDpCode(), value);
  } catch (err) {
    err.errorType = 'PLUG_COMMAND_FAILED';
    throw err;
  }
}

/**
 * Cuts mains to the coffee machine and restores it.
 *
 * Returns { reset: true } when the cycle completed, or
 * { reset: false, reason } when the plug was not touched — it is offline to the
 * cloud, or could not even be switched OFF. Nothing changed (the machine still
 * has power), so the caller may carry on exactly as it did before the plug
 * existed.
 *
 * Why the offline check comes first: Tuya's command API answers "success" for a
 * device it cannot reach, and the command is simply lost. Trusting that would
 * log a mains reset that never happened — or cut power and lose the restore.
 *
 * Throws only when power was cut and could NOT be restored: the machine is
 * dead until the plug is switched back on, so that must be retried loudly.
 */
export async function cycleCoffeePlug() {
  try {
    const info = await tuyaRequest('GET', `/v1.0/devices/${process.env.TUYA_PLUG_DEVICE_ID}`);
    if (info?.online !== true) {
      return { reset: false, reason: 'the plug is offline to the Tuya cloud' };
    }
  } catch (err) {
    return { reset: false, reason: `could not confirm the plug is online: ${err?.message || err}` };
  }

  try {
    await sendPlug(false);
  } catch (err) {
    return { reset: false, reason: err?.message || String(err) };
  }

  await wait(PLUG_OFF_MS);

  let lastErr = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await sendPlug(true);
      return { reset: true };
    } catch (err) {
      lastErr = err;
      console.warn(`Plug restore attempt ${attempt} failed:`, err?.message || err);
      await wait(1000);
    }
  }
  throw lastErr;
}

/**
 * Best-effort "make sure the machine has mains". A serverless timeout landing
 * inside the few seconds the plug is OFF would leave the machine dead with
 * nothing to switch it back on; the power-on step calls this first. Switching
 * an already-on plug on is a no-op, and a failure here changes nothing.
 */
export async function ensureCoffeePlugOn() {
  try {
    await sendPlug(true);
  } catch (err) {
    console.warn('Could not confirm the plug is on:', err?.message || err);
  }
}

/**
 * Plug diagnostics: whether the cloud can reach it, and its switch state.
 */
export async function getPlugDiagnostics() {
  const deviceId = process.env.TUYA_PLUG_DEVICE_ID;
  if (!deviceId) {
    throw new Error('TUYA_PLUG_DEVICE_ID is not configured');
  }
  const [info, status] = await Promise.all([
    tuyaRequest('GET', `/v1.0/devices/${deviceId}`),
    tuyaRequest('GET', `/v1.0/devices/${deviceId}/status`),
  ]);
  return { deviceId, online: info?.online, name: info?.name, status };
}

/**
 * Presses the Fingerbot once as a real momentary click: arm DOWN, hold briefly,
 * arm UP.
 *
 * A Fingerbot in "switch mode" only moves when the boolean DP *changes*. So the
 * arm MUST be up before we can press: sending `true` to a device already at
 * `true` moves nothing at all, while the API happily reports success. That is
 * how the machine ended up "powered on, no coffee, everything green in the log"
 * — an earlier release had failed and left the arm parked down, so every later
 * press was a silent no-op.
 *
 * Hence: read the arm's real position first and raise it if it is down, then
 * click, then VERIFY the release actually took and retry it if it didn't.
 *
 * The DP code defaults to `switch_1`; override with TUYA_FINGERBOT_DP_CODE if the
 * device exposes a different code (run scratch/list_tuya_fingerbot.mjs to check).
 */
export async function triggerFingerbot() {
  const deviceId = process.env.TUYA_FINGERBOT_DEVICE_ID;

  if (!deviceId) {
    throw new Error('TUYA_FINGERBOT_DEVICE_ID is not configured');
  }

  const dpCode = process.env.TUYA_FINGERBOT_DP_CODE || 'switch_1';

  // 1. The arm must start UP, or the press below changes nothing.
  let armDown = null;
  try {
    armDown = await readDpValue(deviceId, dpCode) === true;
  } catch (err) {
    console.warn('Could not read Fingerbot arm position; pressing blind:', err?.message || err);
  }

  if (armDown) {
    console.warn('Fingerbot arm was parked DOWN — raising it before the press.');
    await sendDp(deviceId, dpCode, false);
    await wait(FINGERBOT_SUSTAIN_MS);
  }

  // 2. Arm DOWN — the actual press. If this fails, no press happened: surface it.
  const result = await sendDp(deviceId, dpCode, true);

  // 3. Hold, then arm UP. A failed release leaves the arm down and turns every
  // FUTURE press into a no-op, so it is worth retrying and verifying.
  await wait(FINGERBOT_SUSTAIN_MS);

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await sendDp(deviceId, dpCode, false);
      await wait(300);
      const stillDown = await readDpValue(deviceId, dpCode) === true;
      if (!stillDown) return result;
      console.warn(`Fingerbot still reports the arm DOWN after release attempt ${attempt}.`);
    } catch (err) {
      console.warn(`Fingerbot arm-up (release) attempt ${attempt} failed:`, err?.message || err);
    }
    await wait(500);
  }

  // The press itself landed, so don't fail the step — but this device now needs
  // attention: until the arm comes up, the next press will do nothing.
  console.error('Fingerbot arm could not be raised after 3 attempts — the NEXT press will be a no-op.');
  return result;
}
