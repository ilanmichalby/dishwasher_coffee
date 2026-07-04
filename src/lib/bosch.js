import { supabaseAdmin } from './supabase-admin';

const API_URL = process.env.HOME_CONNECT_API_URL || 'https://api.home-connect.com';

// Refresh whenever less than 10 minutes remain — a schedule run that starts
// just before expiry must never hit the Bosch API with a dead token.
const REFRESH_WINDOW_MS = 10 * 60 * 1000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchAuthRow() {
  const { data, error } = await supabaseAdmin
    .from('bosch_auth')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to read Bosch auth from DB: ${error.message}`);
  }
  return data;
}

async function requestTokenRefresh(refreshToken) {
  const tokenResponse = await fetch(`${API_URL}/security/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.HOME_CONNECT_CLIENT_ID,
      client_secret: process.env.HOME_CONNECT_CLIENT_SECRET,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  });

  if (!tokenResponse.ok) {
    const errBody = await tokenResponse.json().catch(() => ({}));
    console.error('Bosch token refresh failed:', tokenResponse.status, errBody);
    const err = new Error(`Failed to refresh Bosch token (${tokenResponse.status}): ${errBody.error || 'unknown'}`);
    err.invalidGrant = errBody.error === 'invalid_grant';
    throw err;
  }

  return tokenResponse.json();
}

// Home Connect rotates the refresh token on every refresh, so losing the new
// one to a transient DB error would force a manual re-login. Retry the save.
async function saveRefreshedTokens(row, tokenData) {
  const newExpiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();
  const updates = {
    access_token: tokenData.access_token,
    refresh_token: tokenData.refresh_token,
    expires_at: newExpiresAt,
    updated_at: new Date().toISOString(),
  };

  for (let attempt = 1; attempt <= 3; attempt++) {
    // Conditional on the old refresh_token so a concurrent refresher's newer
    // tokens are never overwritten by this (equally valid) result.
    const { data, error } = await supabaseAdmin
      .from('bosch_auth')
      .update(updates)
      .eq('id', row.id)
      .eq('refresh_token', row.refresh_token)
      .select('id');

    if (!error) {
      if (!data || data.length === 0) {
        console.log('Bosch tokens were already refreshed by a concurrent request — keeping stored tokens.');
      }
      return;
    }

    console.error(`Failed to save refreshed Bosch tokens (attempt ${attempt}/3):`, error.message);
    if (attempt < 3) await sleep(500 * attempt);
  }

  // Don't fail the current run — the in-memory token is valid — but future
  // runs may need a re-login, so shout about it in the logs.
  console.error('CRITICAL: refreshed Bosch tokens could not be persisted. The stored refresh token may now be invalid — re-login might be required.');
}

/**
 * Gets a valid access token, refreshing it if necessary.
 * Safe to call from concurrent invocations.
 */
export async function getValidAccessToken() {
  const row = await fetchAuthRow();

  if (!row) {
    throw new Error('No Bosch authentication found. Please login first.');
  }

  const msLeft = new Date(row.expires_at).getTime() - Date.now();
  if (msLeft > REFRESH_WINDOW_MS) {
    return row.access_token;
  }

  console.log(`Bosch token expires in ${Math.round(msLeft / 1000)}s — refreshing...`);

  try {
    const tokenData = await requestTokenRefresh(row.refresh_token);
    await saveRefreshedTokens(row, tokenData);
    return tokenData.access_token;
  } catch (refreshError) {
    // A concurrent invocation may have refreshed first, rotating the refresh
    // token we just tried to use. Re-read — if the stored tokens are newer
    // and valid, use them instead of failing.
    const fresh = await fetchAuthRow();
    if (
      fresh &&
      fresh.refresh_token !== row.refresh_token &&
      new Date(fresh.expires_at).getTime() > Date.now()
    ) {
      console.log('Bosch token was refreshed by a concurrent request — using stored token.');
      return fresh.access_token;
    }
    throw refreshError;
  }
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
    if (response.status === 409) {
      console.log(`Power state is already in the requested state (409 Conflict).`);
      return true;
    }
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

