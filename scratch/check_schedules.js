
// removed dotenv require

const { createClient } = require('@supabase/supabase-js');

async function checkSchedules() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log('Checking schedules table...');
  const { data, error } = await supabase
    .from('schedules')
    .select('*')
    .order('scheduled_time', { ascending: false })
    .limit(10);

  if (error) {
    console.error('Supabase error:', error.message);
    return;
  }

  if (!data || data.length === 0) {
    console.log('No schedules found.');
    return;
  }

  console.log('Last 10 schedules:');
  data.forEach(s => {
    console.log(`- ID: ${s.id}`);
    console.log(`  Appliance: ${s.appliance_id}`);
    console.log(`  Time: ${s.scheduled_time}`);
    console.log(`  Status: ${s.status}`);
    console.log(`  Retries: ${s.retry_count}`);
    console.log(`  Last Error: ${s.last_error || 'None'}`);
    console.log('---');
  });
}

checkSchedules();
