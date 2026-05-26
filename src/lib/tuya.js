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
 * Triggers the Fingerbot (sends a 'click' / switch on command)
 */
export async function triggerFingerbot() {
  const deviceId = process.env.TUYA_FINGERBOT_DEVICE_ID;

  if (!deviceId) {
    throw new Error('TUYA_FINGERBOT_DEVICE_ID is not configured');
  }

  // Fingerbot supports 'click' mode (single press) via 'switch' DP
  return await tuyaRequest('POST', `/v1.0/iot-03/devices/${deviceId}/commands`, {
    commands: [{ code: 'switch_1', value: true }],
  });
}
