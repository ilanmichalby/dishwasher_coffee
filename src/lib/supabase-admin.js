import { createClient } from '@supabase/supabase-js';

// Server-only Supabase client using the service role key (bypasses RLS).
// Never import this from client components — the key must stay on the server.
// Lazily initialized so `next build` doesn't require env vars at module load.
let client = null;

function getClient() {
  if (client) return client;

  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  if (!serviceRoleKey) {
    console.error(
      'CRITICAL: SUPABASE_SERVICE_ROLE_KEY is not set. Falling back to the anon key — ' +
      'server DB access will stop working once the open policies on bosch_auth are removed. ' +
      'Set it in Netlify environment variables.'
    );
  }

  client = createClient(
    supabaseUrl,
    serviceRoleKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
    {
      auth: { persistSession: false, autoRefreshToken: false },
    }
  );
  return client;
}

export const supabaseAdmin = new Proxy({}, {
  get(_target, prop) {
    const value = getClient()[prop];
    return typeof value === 'function' ? value.bind(client) : value;
  },
});
