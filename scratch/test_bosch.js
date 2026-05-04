
// removed dotenv require

const { createClient } = require('@supabase/supabase-js');

async function testBosch() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log('Checking bosch_auth table...');
  const { data, error } = await supabase
    .from('bosch_auth')
    .select('*')
    .single();

  if (error) {
    console.error('Supabase error:', error.message);
    return;
  }

  if (!data) {
    console.log('No auth data found in bosch_auth table.');
    return;
  }

  console.log('Found auth data. Expires at:', data.expires_at);
  
  const API_URL = process.env.HOME_CONNECT_API_URL || 'https://api.home-connect.com';
  const token = data.access_token;

  console.log('Fetching appliances from Home Connect...');
  try {
    const response = await fetch(`${API_URL}/api/homeappliances`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.bsh.sdk.v1+json'
      }
    });

    console.log('Response status:', response.status, response.statusText);
    const body = await response.json();
    console.log('Response body:', JSON.stringify(body, null, 2));
  } catch (e) {
    console.error('Fetch error:', e.message);
  }
}

testBosch();
