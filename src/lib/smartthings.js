const API_URL = 'https://api.smartthings.com/v1';

/**
 * Sends a command to a SmartThings device
 */
export async function sendDeviceCommand(deviceId, capability, command, args = []) {
  const token = process.env.SMARTTHINGS_TOKEN;
  
  if (!token || token === 'PASTE_YOUR_TOKEN_HERE') {
    throw new Error('SMARTTHINGS_TOKEN is not configured. Please add it to .env.local');
  }

  const response = await fetch(`${API_URL}/devices/${deviceId}/commands`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      commands: [
        {
          component: 'main',
          capability: capability,
          command: command,
          arguments: args
        }
      ]
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`SmartThings API error: ${response.status} - ${JSON.stringify(errorData)}`);
  }

  return await response.json();
}

/**
 * Triggers the Fingerbot (Coffee Machine power button).
 * Uses SMARTTHINGS_FINGERBOT_DEVICE_ID from env — ignores the passed applianceId
 * since the SmartThings device ID is different from the app's internal coffee machine UUID.
 */
export async function triggerFingerbot() {
  const deviceId = process.env.SMARTTHINGS_FINGERBOT_DEVICE_ID;
  
  if (!deviceId) {
    throw new Error('SMARTTHINGS_FINGERBOT_DEVICE_ID is not configured');
  }

  // Fingerbot responds to 'switch' capability — 'on' triggers a push
  return await sendDeviceCommand(deviceId, 'switch', 'on');
}
