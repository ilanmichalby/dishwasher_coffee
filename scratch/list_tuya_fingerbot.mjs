// Prints the Tuya Fingerbot's supported DP codes + current status, so you can
// confirm which `code` triggerFingerbot() should send (switch_1 vs switch vs …)
// and see whether the arm is currently stuck "down" (value: true).
//
// Run locally with your Tuya creds in the env:
//   TUYA_CLIENT_ID=... TUYA_CLIENT_SECRET=... TUYA_FINGERBOT_DEVICE_ID=... \
//     node scratch/list_tuya_fingerbot.mjs
//
// (Same values you set in Netlify. Uses the EU data center, like src/lib/tuya.js.)

import crypto from 'crypto';

const TUYA_API_URL = 'https://openapi.tuyaeu.com';
const clientId = process.env.TUYA_CLIENT_ID;
const clientSecret = process.env.TUYA_CLIENT_SECRET;
const deviceId = process.env.TUYA_FINGERBOT_DEVICE_ID;

if (!clientId || !clientSecret || !deviceId) {
  console.error('Set TUYA_CLIENT_ID, TUYA_CLIENT_SECRET and TUYA_FINGERBOT_DEVICE_ID in the env.');
  process.exit(1);
}

async function getToken() {
  const t = Date.now().toString();
  const contentHash = crypto.createHash('sha256').update('').digest('hex');
  const urlStr = '/v1.0/token?grant_type=1';
  const stringToSign = ['GET', contentHash, '', urlStr].join('\n');
  const sign = crypto.createHmac('sha256', clientSecret)
    .update(clientId + t + stringToSign).digest('hex').toUpperCase();

  const res = await fetch(`${TUYA_API_URL}${urlStr}`, {
    headers: { client_id: clientId, sign, t, sign_method: 'HMAC-SHA256' },
  });
  const data = await res.json();
  if (!data.success) throw new Error(`auth failed: ${data.msg} (${data.code})`);
  return data.result.access_token;
}

async function tuyaGet(token, path) {
  const t = Date.now().toString();
  const contentHash = crypto.createHash('sha256').update('').digest('hex');
  const signStr = [clientId, token, t, ['GET', contentHash, '', path].join('\n')].join('');
  const sign = crypto.createHmac('sha256', clientSecret).update(signStr).digest('hex').toUpperCase();

  const res = await fetch(`${TUYA_API_URL}${path}`, {
    headers: { client_id: clientId, access_token: token, sign, t, sign_method: 'HMAC-SHA256' },
  });
  return res.json();
}

const token = await getToken();

console.log('\n=== SPECIFICATIONS (valid DP codes to send) ===');
const specs = await tuyaGet(token, `/v1.0/devices/${deviceId}/specifications`);
console.log(JSON.stringify(specs, null, 2));

console.log('\n=== CURRENT STATUS (is the arm stuck "true"?) ===');
const status = await tuyaGet(token, `/v1.0/devices/${deviceId}/status`);
console.log(JSON.stringify(status, null, 2));
