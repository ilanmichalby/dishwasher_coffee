
const API_URL = 'https://api.switch-bot.com/v1.0';

/**
 * Sends a command to a SwitchBot device
 */
export async function sendSwitchBotCommand(deviceId, command, parameter = 'default', commandType = 'command') {
  const token = process.env.SWITCHBOT_TOKEN;
  
  if (!token) {
    throw new Error('SWITCHBOT_TOKEN is not configured');
  }

  const response = await fetch(`${API_URL}/devices/${deviceId}/commands`, {
    method: 'POST',
    headers: {
      'Authorization': token,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      command: command,
      parameter: parameter,
      commandType: commandType
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`SwitchBot API error: ${response.status} - ${JSON.stringify(errorData)}`);
  }

  return await response.json();
}

/**
 * Specifically triggers a 'press' on a Bot
 */
export async function pressBot(deviceId) {
  return await sendSwitchBotCommand(deviceId, 'press');
}
