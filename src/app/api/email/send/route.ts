import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function getAccessToken(): Promise<string | null> {
  const { data } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'outlook_tokens')
    .single();
  if (!data?.value) return null;
  const tokens = JSON.parse(data.value);
  return tokens.access_token || null;
}

export async function POST(request: NextRequest) {
  const { to, subject, body, replyToMessageId } = await request.json();

  if (!to || !subject || !body) {
    return NextResponse.json({ error: 'Missing required fields: to, subject, body' }, { status: 400 });
  }

  const accessToken = await getAccessToken();
  if (!accessToken) {
    return NextResponse.json({ error: 'Outlook not connected' }, { status: 401 });
  }

  const endpoint = replyToMessageId
    ? `https://graph.microsoft.com/v1.0/me/messages/${replyToMessageId}/reply`
    : 'https://graph.microsoft.com/v1.0/me/sendMail';

  const payload = replyToMessageId
    ? { comment: body }
    : {
        message: {
          subject,
          body: { contentType: 'Text', content: body },
          toRecipients: [{ emailAddress: { address: to } }],
        },
        saveToSentItems: true,
      };

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error('[Email Send] Graph API error:', errText);
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
