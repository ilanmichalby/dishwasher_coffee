
async function listSmartThingsDevices() {
  const token = 'b64a4fac-85e7-47fa-9361-bb8bd4671498';
  
  try {
    const response = await fetch('https://api.smartthings.com/v1/devices', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!response.ok) {
      throw new Error(`Error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log('Devices found:');
    data.items.forEach(device => {
      console.log(`- Name: ${device.label || device.name}`);
      console.log(`  ID: ${device.deviceId}`);
      console.log(`  Type: ${device.deviceTypeName || 'N/A'}`);
      console.log('---');
    });
  } catch (error) {
    console.error('Failed to list devices:', error.message);
  }
}

listSmartThingsDevices();
