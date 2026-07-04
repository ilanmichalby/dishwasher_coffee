import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

// Single-user app: tokens always live in one fixed row (upserted, never duplicated).
const AUTH_ROW_ID = '00000000-0000-0000-0000-000000000001';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  if (error) {
    return NextResponse.json({ error }, { status: 400 });
  }

  if (!code) {
    return NextResponse.json({ error: 'No authorization code provided' }, { status: 400 });
  }

  const clientId = process.env.HOME_CONNECT_CLIENT_ID;
  const clientSecret = process.env.HOME_CONNECT_CLIENT_SECRET;
  const redirectUri = process.env.HOME_CONNECT_REDIRECT_URI;
  
  if (!clientId || !clientSecret || !redirectUri) {
    return NextResponse.json({ error: 'Missing HOME_CONNECT configuration' }, { status: 500 });
  }

  try {
    // Exchange the authorization code for an access token
    const tokenResponse = await fetch('https://api.home-connect.com/security/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json();
      console.error('Token exchange failed:', errorData);
      return NextResponse.json({ error: 'Token exchange failed', details: errorData }, { status: tokenResponse.status });
    }

    const tokenData = await tokenResponse.json();
    const { access_token, refresh_token, expires_in } = tokenData;

    // Calculate expiry date
    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + expires_in);

    // Upsert into the single fixed row — no new row per login.
    const { error: dbError } = await supabaseAdmin.from('bosch_auth').upsert({
      id: AUTH_ROW_ID,
      access_token,
      refresh_token,
      expires_at: expiresAt.toISOString(),
      updated_at: new Date().toISOString()
    }, { onConflict: 'id' });

    if (dbError) {
      console.error('Failed to save token to database:', dbError);
      return NextResponse.json({ error: 'Failed to save token', details: dbError }, { status: 500 });
    }

    // Clean up any legacy rows from before the fixed-row scheme (after the
    // upsert, so there is never a moment with zero rows).
    await supabaseAdmin.from('bosch_auth').delete().neq('id', AUTH_ROW_ID);

    // Redirect to the home page on success
    return NextResponse.redirect(new URL('/', request.url));
  } catch (error) {
    console.error('OAuth callback error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
