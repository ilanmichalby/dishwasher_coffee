
async function getDeviceDetails() {
  const token = 'b64a4fac-85e7-47fa-9361-bb8bd4671498';
  const deviceId = '9103117a-3163-4aa6-a4fb-b0a50acf832a';
  
  try {
    const response = await fetch(`https://api.smartthings.com/v1/devices/${deviceId}/status`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    const data = await response.json();
    console.log('Device Status:', JSON.stringify(data, null, 2));
    
    const detailsResponse = await fetch(`https://api.smartthings.com/v1/devices/${deviceId}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    const detailsData = await detailsResponse.json();
    console.log('Device Details:', JSON.stringify(detailsData, null, 2));

  } catch (error) {
    console.error('Failed to get device details:', error.message);
  }
}

getDeviceDetails();
