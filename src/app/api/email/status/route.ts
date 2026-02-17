import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Check if Outlook is connected and token is still valid
export async function GET() {
  try {
    const { data } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'outlook_tokens')
      .single();

    if (!data?.value) {
      return NextResponse.json({ connected: false });
    }

    const tokens = JSON.parse(data.value);
    const isExpired = tokens.expires_at && Date.now() > tokens.expires_at - 60000;

    if (isExpired && tokens.refresh_token) {
      // Attempt to refresh
      const refreshed = await refreshAccessToken(tokens.refresh_token);
      if (refreshed) {
        return NextResponse.json({ connected: true, email: tokens.email, displayName: tokens.display_name });
      }
      return NextResponse.json({ connected: false, reason: 'Token expired' });
    }

    return NextResponse.json({
      connected: !!tokens.access_token,
      email: tokens.email,
      displayName: tokens.display_name,
      connectedAt: tokens.connected_at,
    });
  } catch {
    return NextResponse.json({ connected: false });
  }
}

async function refreshAccessToken(refreshToken: string): Promise<boolean> {
  try {
    const supabaseClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const res = await fetch(
      `https://login.microsoftonline.com/${process.env.MICROSOFT_TENANT_ID || 'common'}/oauth2/v2.0/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: process.env.MICROSOFT_CLIENT_ID!,
          client_secret: process.env.MICROSOFT_CLIENT_SECRET!,
          refresh_token: refreshToken,
          grant_type: 'refresh_token',
          scope: 'openid offline_access https://graph.microsoft.com/Mail.Read https://graph.microsoft.com/Mail.Send',
        }),
      }
    );

    if (!res.ok) return false;

    const tokens = await res.json();

    const { data: existing } = await supabaseClient
      .from('settings')
      .select('value')
      .eq('key', 'outlook_tokens')
      .single();

    const current = existing?.value ? JSON.parse(existing.value) : {};
    await supabaseClient
      .from('settings')
      .upsert({
        key: 'outlook_tokens',
        value: JSON.stringify({
          ...current,
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token || refreshToken,
          expires_at: Date.now() + (tokens.expires_in || 3600) * 1000,
        }),
      }, { onConflict: 'key' });

    return true;
  } catch {
    return false;
  }
}
