import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

// Connection-status check for the frontend. Never returns tokens —
// the client must not read bosch_auth directly.
export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('bosch_auth')
    .select('expires_at, updated_at')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('Bosch status check failed:', error.message);
    return NextResponse.json({ connected: false, error: 'Status check failed' }, { status: 500 });
  }

  return NextResponse.json({
    connected: !!data,
    expires_at: data?.expires_at ?? null,
  });
}
