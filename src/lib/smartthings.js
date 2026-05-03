
const API_URL = 'https://api.smartthings.com/v1';

/**
 * Sends a command to a SmartThings device
 */
export async function sendDeviceCommand(deviceId, capability, command, args = []) {
  const token = process.env.SMARTTHINGS_TOKEN;
  
  if (!token) {
    throw new Error('SMARTTHINGS_TOKEN is not configured');
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
 * Specific function to trigger the Fingerbot (Coffee Machine)
 */
export async function triggerFingerbot(deviceId) {
  // Most Fingerbots respond to 'on' command to perform a push
  return await sendDeviceCommand(deviceId, 'switch', 'on');
}
