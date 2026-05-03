import { NextResponse } from 'next/server';

export async function GET() {
  const clientId = process.env.HOME_CONNECT_CLIENT_ID;
  const redirectUri = process.env.HOME_CONNECT_REDIRECT_URI;
  
  if (!clientId || !redirectUri) {
    return NextResponse.json({ error: 'Missing HOME_CONNECT configuration' }, { status: 500 });
  }

  // Define scopes: IdentifyAppliance (to get devices), Monitor (to check status), Control (to start programs)
  const scope = 'IdentifyAppliance Monitor Control';
  const responseType = 'code';

  const authUrl = new URL('https://api.home-connect.com/security/oauth/authorize');
  authUrl.searchParams.append('client_id', clientId);
  authUrl.searchParams.append('response_type', responseType);
  authUrl.searchParams.append('redirect_uri', redirectUri);
  authUrl.searchParams.append('scope', scope);

  return NextResponse.redirect(authUrl.toString());
}
