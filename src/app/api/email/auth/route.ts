import { NextResponse } from 'next/server';

// Redirects user to Microsoft OAuth2 consent screen
export async function GET() {
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const tenantId = process.env.MICROSOFT_TENANT_ID || 'common';
  const redirectUri = process.env.MICROSOFT_REDIRECT_URI || `${process.env.NEXT_PUBLIC_APP_URL || 'https://care-ats.vercel.app'}/api/email/callback`;

  if (!clientId) {
    return NextResponse.json(
      { error: 'Microsoft OAuth not configured. Set MICROSOFT_CLIENT_ID in environment variables.' },
      { status: 500 }
    );
  }

  const scopes = [
    'openid',
    'offline_access',
    'https://graph.microsoft.com/Mail.Read',
    'https://graph.microsoft.com/Mail.Send',
    'https://graph.microsoft.com/User.Read',
  ].join(' ');

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirectUri,
    scope: scopes,
    response_mode: 'query',
    state: 'carerecruit-email-oauth',
  });

  const authUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize?${params.toString()}`;

  return NextResponse.redirect(authUrl);
}
