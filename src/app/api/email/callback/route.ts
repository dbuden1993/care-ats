import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Handles the OAuth callback from Microsoft, exchanges code for tokens
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://care-ats.vercel.app';

  if (error) {
    console.error('[Email OAuth] Error from Microsoft:', error, searchParams.get('error_description'));
    return NextResponse.redirect(`${appUrl}?outlook_error=${encodeURIComponent(error)}`);
  }

  if (!code) {
    return NextResponse.redirect(`${appUrl}?outlook_error=no_code`);
  }

  const clientId = process.env.MICROSOFT_CLIENT_ID!;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET!;
  const tenantId = process.env.MICROSOFT_TENANT_ID || 'common';
  const redirectUri = process.env.MICROSOFT_REDIRECT_URI || `${appUrl}/api/email/callback`;

  try {
    // Exchange code for tokens
    const tokenRes = await fetch(
      `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          code,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
          scope: 'openid offline_access https://graph.microsoft.com/Mail.Read https://graph.microsoft.com/Mail.Send https://graph.microsoft.com/User.Read',
        }),
      }
    );

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      console.error('[Email OAuth] Token exchange failed:', errText);
      return NextResponse.redirect(`${appUrl}?outlook_error=token_exchange_failed`);
    }

    const tokens = await tokenRes.json();

    // Get user info
    const userRes = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const userInfo = userRes.ok ? await userRes.json() : {};

    // Store tokens in Supabase settings table
    const tokenData = {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: Date.now() + (tokens.expires_in || 3600) * 1000,
      email: userInfo.mail || userInfo.userPrincipalName || '',
      display_name: userInfo.displayName || '',
      connected_at: new Date().toISOString(),
    };

    await supabase
      .from('settings')
      .upsert({ key: 'outlook_tokens', value: JSON.stringify(tokenData) }, { onConflict: 'key' });

    console.log('[Email OAuth] Successfully connected Outlook for:', tokenData.email);
    return NextResponse.redirect(`${appUrl}?outlook_connected=true`);

  } catch (err: any) {
    console.error('[Email OAuth] Unexpected error:', err);
    return NextResponse.redirect(`${appUrl}?outlook_error=${encodeURIComponent(err.message)}`);
  }
}
