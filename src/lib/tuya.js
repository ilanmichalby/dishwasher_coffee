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
  : 800;

/**
 * Presses the Fingerbot once as a real momentary click: arm DOWN, hold briefly,
 * arm UP.
 *
 * A Fingerbot in "switch mode" only moves when the boolean DP *changes*. The
 * previous version always sent `true`, so it pressed once and then did nothing
 * on every later call once the arm was already down — which is why power on/off
 * stopped pressing. Toggling true -> false guarantees a physical press+release
 * on every call, regardless of the arm's current position. (If the device is in
 * "click mode" the trailing `false` is a harmless no-op.)
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
  const path = `/v1.0/iot-03/devices/${deviceId}/commands`;

  // Arm DOWN — the actual press. If this fails, no press happened: surface it.
  const result = await tuyaRequest('POST', path, {
    commands: [{ code: dpCode, value: true }],
  });

  // Hold, then arm UP so the NEXT press has a state change to act on. A failure
  // here still means the press landed, so don't fail the whole step over it.
  await wait(FINGERBOT_SUSTAIN_MS);
  try {
    await tuyaRequest('POST', path, {
      commands: [{ code: dpCode, value: false }],
    });
  } catch (err) {
    console.warn('Fingerbot arm-up (release) failed; press landed, will release next cycle:', err?.message || err);
  }

  return result;
}
