import { supabase } from './supabase';

const API_URL = process.env.HOME_CONNECT_API_URL || 'https://api.home-connect.com';

/**
 * Gets a valid access token, refreshing it if necessary.
 */
export async function getValidAccessToken() {
  const { data, error } = await supabase
    .from('bosch_auth')
    .select('*')
    .single();

  if (error || !data) {
    throw new Error('No Bosch authentication found. Please login first.');
  }

  const { access_token, refresh_token, expires_at, id } = data;
  const expiresAtDate = new Date(expires_at);
  const now = new Date();

  // If token expires in less than 5 minutes, refresh it
  if (expiresAtDate.getTime() - now.getTime() < 5 * 60 * 1000) {
    console.log('Token expired or expiring soon, refreshing...');
    const clientId = process.env.HOME_CONNECT_CLIENT_ID;
    const clientSecret = process.env.HOME_CONNECT_CLIENT_SECRET;

    const tokenResponse = await fetch(`${API_URL}/security/oauth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'refresh_token',
        refresh_token: refresh_token,
      }),
    });

    if (!tokenResponse.ok) {
      const err = await tokenResponse.json();
      console.error('Failed to refresh token', err);
      throw new Error('Failed to refresh Bosch token');
    }

    const tokenData = await tokenResponse.json();
    const newExpiresAt = new Date();
    newExpiresAt.setSeconds(newExpiresAt.getSeconds() + tokenData.expires_in);

    // Update in database
    await supabase
      .from('bosch_auth')
      .update({
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        expires_at: newExpiresAt.toISOString()
      })
      .eq('id', id);

    return tokenData.access_token;
  }

  return access_token;
}

/**
 * Gets the user's home appliances (specifically dishwashers)
 */
export async function getDishwashers() {
  const token = await getValidAccessToken();
  
  const response = await fetch(`${API_URL}/api/homeappliances`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.bsh.sdk.v1+json'
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch appliances: ${response.statusText}`);
  }

  const data = await response.json();
  // Filter only dishwashers
  return data.data.homeappliances.filter(appliance => appliance.type === 'Dishwasher');
}

/**
 * Starts a program on the dishwasher
 */
export async function startDishwasherProgram(haId, programKey, options = {}) {
  const token = await getValidAccessToken();
  
  const payload = {
    data: {
      key: programKey,
      options: Object.entries(options).map(([key, value]) => ({
        key,
        value
      }))
    }
  };

  const response = await fetch(`${API_URL}/api/homeappliances/${haId}/programs/active`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/vnd.bsh.sdk.v1+json',
      'Accept': 'application/vnd.bsh.sdk.v1+json'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`Failed to start program: ${response.status} - ${JSON.stringify(errorData)}`);
  }

  return true;
}

/**
 * Sets the power state of the dishwasher
 */
export async function setDishwasherPowerState(haId, isOn) {
  const token = await getValidAccessToken();
  
  const payload = {
    data: {
      key: 'BSH.Common.Setting.PowerState',
      value: isOn ? 'BSH.Common.EnumType.PowerState.On' : 'BSH.Common.EnumType.PowerState.Off'
    }
  };

  const response = await fetch(`${API_URL}/api/homeappliances/${haId}/settings/BSH.Common.Setting.PowerState`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/vnd.bsh.sdk.v1+json',
      'Accept': 'application/vnd.bsh.sdk.v1+json'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`Failed to set power state: ${response.status} - ${JSON.stringify(errorData)}`);
  }

  return true;
}

/**
 * Stops the currently active program on the dishwasher
 */
export async function stopDishwasherProgram(haId) {
  const token = await getValidAccessToken();
  
  const response = await fetch(`${API_URL}/api/homeappliances/${haId}/programs/active`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.bsh.sdk.v1+json'
    }
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    // 404 means no active program, which is not necessarily an error we need to throw loudly
    if (response.status === 404) return true;
    
    throw new Error(`Failed to stop program: ${response.status} - ${JSON.stringify(errorData)}`);
  }

  return true;
}

/**
 * Gets the detailed status of a dishwasher
 */
export async function getDishwasherStatus(haId) {
  const token = await getValidAccessToken();
  
  try {
    // 1. Get basic status (Power, Operation State, Door)
    const statusResponse = await fetch(`${API_URL}/api/homeappliances/${haId}/status`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.bsh.sdk.v1+json'
      }
    });

    // 2. Get active program (if any) to see remaining time
    const activeProgramResponse = await fetch(`${API_URL}/api/homeappliances/${haId}/programs/active`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.bsh.sdk.v1+json'
      }
    });

    let statusData = [];
    if (statusResponse.ok) {
      const data = await statusResponse.json();
      statusData = data.data.status;
    }

    let activeProgram = null;
    if (activeProgramResponse.ok) {
      const data = await activeProgramResponse.json();
      activeProgram = data.data;
    }

    return {
      status: statusData,
      activeProgram: activeProgram
    };
  } catch (error) {
    console.error(`Error fetching status for ${haId}:`, error);
    return null;
  }
}

/**
 * Gets the available programs for a dishwasher
 */
export async function getAvailablePrograms(haId) {
  const token = await getValidAccessToken();
  
  try {
    const response = await fetch(`${API_URL}/api/homeappliances/${haId}/programs/available`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.bsh.sdk.v1+json'
      }
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error(`Failed to get available programs for ${haId}: ${response.status}`, errorData);
      return [];
    }

    const data = await response.json();
    return data.data.programs || [];
  } catch (error) {
    console.error(`Error fetching available programs for ${haId}:`, error);
    return [];
  }
}

