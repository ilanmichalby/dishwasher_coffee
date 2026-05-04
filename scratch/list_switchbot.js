
async function listSwitchBotDevices() {
  const token = '40db86a232d6a085338a879f8fa9eeebbd3e991fb7bf12f6deb72bd372494887fc23d88bdf20cc0e0ca2aada3bf318f9';
  
  try {
    const response = await fetch('https://api.switch-bot.com/v1.0/devices', {
      headers: {
        'Authorization': token
      }
    });
    
    const data = await response.json();
    console.log('SwitchBot Devices:', JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Failed to list SwitchBot devices:', error.message);
  }
}

listSwitchBotDevices();
