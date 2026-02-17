import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const anthropic = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY || '' });

async function getAccessToken(): Promise<string | null> {
  const { data } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'outlook_tokens')
    .single();

  if (!data?.value) return null;
  const tokens = JSON.parse(data.value);

  // Refresh if expired
  if (tokens.expires_at && Date.now() > tokens.expires_at - 60000) {
    const refreshed = await refreshToken(tokens.refresh_token);
    return refreshed;
  }

  return tokens.access_token;
}

async function refreshToken(refreshTokenValue: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://login.microsoftonline.com/${process.env.MICROSOFT_TENANT_ID || 'common'}/oauth2/v2.0/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: process.env.MICROSOFT_CLIENT_ID!,
          client_secret: process.env.MICROSOFT_CLIENT_SECRET!,
          refresh_token: refreshTokenValue,
          grant_type: 'refresh_token',
          scope: 'openid offline_access https://graph.microsoft.com/Mail.Read https://graph.microsoft.com/Mail.Send',
        }),
      }
    );
    if (!res.ok) return null;
    const tokens = await res.json();
    const { data: existing } = await supabase.from('settings').select('value').eq('key', 'outlook_tokens').single();
    const current = existing?.value ? JSON.parse(existing.value) : {};
    await supabase.from('settings').upsert({
      key: 'outlook_tokens',
      value: JSON.stringify({
        ...current,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token || refreshTokenValue,
        expires_at: Date.now() + (tokens.expires_in || 3600) * 1000,
      }),
    }, { onConflict: 'key' });
    return tokens.access_token;
  } catch {
    return null;
  }
}

async function findCandidateByEmail(fromEmail: string, fromName: string) {
  // Try matching by email field on candidates (if it exists)
  const { data: byEmail } = await supabase
    .from('candidates')
    .select('id, name, status')
    .eq('email', fromEmail)
    .single();
  if (byEmail) return byEmail;

  // Try fuzzy name match
  if (fromName && fromName.length > 2) {
    const { data: byName } = await supabase
      .from('candidates')
      .select('id, name, status')
      .ilike('name', `%${fromName.split(' ')[0]}%`)
      .limit(1)
      .single();
    if (byName) return byName;
  }

  return null;
}

async function analyzeEmail(subject: string, bodyPreview: string, fromName: string) {
  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 300,
      messages: [{
        role: 'user',
        content: `Analyze this recruitment email:

Subject: ${subject}
From: ${fromName}
Preview: ${bodyPreview.slice(0, 500)}

Return JSON only:
{
  "intent": "interested|not_interested|question|availability_update|callback_request|document_sent|general",
  "summary": "1-2 sentence plain English summary",
  "suggestedAction": "call_back|send_info|schedule_interview|add_to_pool|no_action|urgent_response"
}`
      }]
    });
    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    const clean = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
    return JSON.parse(clean);
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  const accessToken = await getAccessToken();
  if (!accessToken) {
    return NextResponse.json({ error: 'Outlook not connected. Please authenticate first.' }, { status: 401 });
  }

  try {
    // Fetch last 50 emails from inbox
    const emailsRes = await fetch(
      'https://graph.microsoft.com/v1.0/me/messages?$select=id,subject,from,receivedDateTime,bodyPreview,conversationId,isDraft&$filter=isDraft eq false&$orderby=receivedDateTime desc&$top=50',
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!emailsRes.ok) {
      const errText = await emailsRes.text();
      console.error('[Email Sync] Graph API error:', errText);
      return NextResponse.json({ error: 'Failed to fetch emails from Microsoft Graph' }, { status: 500 });
    }

    const emailData = await emailsRes.json();
    const emails = emailData.value || [];
    let processed = 0;
    let matched = 0;

    for (const email of emails) {
      const fromEmail = email.from?.emailAddress?.address || '';
      const fromName = email.from?.emailAddress?.name || '';
      const subject = email.subject || '(no subject)';
      const bodyPreview = email.bodyPreview || '';
      const receivedAt = email.receivedDateTime;
      const messageId = email.id;
      const threadId = email.conversationId;

      // Skip emails from self (outbound)
      const { data: selfData } = await supabase.from('settings').select('value').eq('key', 'outlook_tokens').single();
      const selfEmail = selfData?.value ? JSON.parse(selfData.value).email : '';
      const direction = fromEmail.toLowerCase() === selfEmail.toLowerCase() ? 'outbound' : 'inbound';

      // Find matching candidate
      const candidate = await findCandidateByEmail(fromEmail, fromName);
      if (candidate) matched++;

      // Analyze with AI (only inbound messages worth analysing)
      let analysis = null;
      if (direction === 'inbound' && bodyPreview.length > 10) {
        analysis = await analyzeEmail(subject, bodyPreview, fromName);
      }

      // Upsert into email_messages table
      await supabase.from('email_messages').upsert({
        candidate_id: candidate?.id || null,
        message_id: messageId,
        subject,
        from_email: fromEmail,
        from_name: fromName,
        body_preview: bodyPreview.slice(0, 500),
        received_at: receivedAt,
        direction,
        thread_id: threadId,
        ai_summary: analysis?.summary || null,
        ai_intent: analysis?.intent || null,
        ai_suggested_action: analysis?.suggestedAction || null,
      }, { onConflict: 'message_id', ignoreDuplicates: false });

      processed++;
    }

    return NextResponse.json({
      success: true,
      processed,
      matched,
      total: emails.length,
    });

  } catch (err: any) {
    console.error('[Email Sync] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// GET: return stored emails
export async function GET() {
  const { data, error } = await supabase
    .from('email_messages')
    .select('*, candidates(name, status)')
    .order('received_at', { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ emails: data || [] });
}
