import crypto from 'crypto';

const API_URL = 'https://api.switch-bot.com/v1.1';

/**
 * Generates SwitchBot API v1.1 authentication headers.
 * Requires SWITCHBOT_TOKEN and SWITCHBOT_SECRET env vars.
 */
function getAuthHeaders() {
  const token = process.env.SWITCHBOT_TOKEN;
  const secret = process.env.SWITCHBOT_SECRET;

  if (!token || !secret) {
    throw new Error('SWITCHBOT_TOKEN or SWITCHBOT_SECRET is not configured');
  }

  const t = Date.now().toString();
  const nonce = crypto.randomUUID();
  const data = token + t + nonce;
  const sign = crypto
    .createHmac('sha256', secret)
    .update(data)
    .digest('base64');

  return {
    'Authorization': token,
    'sign': sign,
    't': t,
    'nonce': nonce,
    'Content-Type': 'application/json',
  };
}

/**
 * Sends a command to a SwitchBot device (API v1.1)
 */
export async function sendSwitchBotCommand(deviceId, command, parameter = 'default', commandType = 'command') {
  const headers = getAuthHeaders();

  const response = await fetch(`${API_URL}/devices/${deviceId}/commands`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      command,
      parameter,
      commandType,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const err = new Error(`SwitchBot API error: ${response.status} - ${JSON.stringify(errorData)}`);
    // HTTP-level failure means the command was not executed — safe to retry.
    err.errorType = 'SWITCHBOT_COMMAND_FAILED';
    err.switchbotResponse = errorData;
    throw err;
  }

  const data = await response.json();

  if (data.statusCode !== 100) {
    const err = new Error(`SwitchBot command failed: statusCode=${data.statusCode}, message=${data.message || 'unknown'}`);
    err.errorType = 'SWITCHBOT_COMMAND_FAILED';
    err.switchbotResponse = data;
    throw err;
  }

  return data;
}

/**
 * Triggers a 'press' on a SwitchBot Bot device
 */
export async function pressBot(deviceId) {
  return await sendSwitchBotCommand(deviceId, 'press');
}

/**
 * Gets the list of devices from SwitchBot (useful for debugging)
 */
export async function getSwitchBotDevices() {
  const headers = getAuthHeaders();

  const response = await fetch(`${API_URL}/devices`, {
    method: 'GET',
    headers,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`SwitchBot API error: ${response.status} - ${JSON.stringify(errorData)}`);
  }

  return await response.json();
}
