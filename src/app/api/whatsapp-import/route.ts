import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import { createHash } from 'crypto';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const anthropic = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY || '' });

// ─────────────────────────────────────────────────────────────────────────────
// Parser
// ─────────────────────────────────────────────────────────────────────────────

interface ParsedMessage {
  sender: string;
  text: string;
  timestamp: string;     // ISO string
  direction: 'inbound' | 'outbound';
}

// Texts that indicate a non-human system message — skip these
const SKIP_PATTERNS = [
  /^<Media omitted>$/i,
  /^<video omitted>$/i,
  /^image omitted$/i,
  /^audio omitted$/i,
  /^sticker omitted$/i,
  /^document omitted$/i,
  /^GIF omitted$/i,
  /^Contact card omitted$/i,
  /^Messages and calls are end-to-end encrypted/i,
  /^This message was deleted/i,
  /^You deleted this message/i,
  /^Missed voice call/i,
  /^Missed video call/i,
];

function shouldSkip(text: string): boolean {
  const t = text.trim();
  if (!t || t.length < 2) return true;
  return SKIP_PATTERNS.some(p => p.test(t));
}

/**
 * Parse WhatsApp export .txt file.
 * Handles Android format: [DD/MM/YYYY, HH:MM:SS] Sender: message text
 * Multi-line messages are joined with \n.
 * myName identifies outbound messages (case-insensitive).
 */
export function parseWhatsAppExport(text: string, myName: string): ParsedMessage[] {
  // Android: [15/01/2024, 09:23:45] Name: text
  const MSG_REGEX = /^\[(\d{1,2})\/(\d{1,2})\/(\d{4}), (\d{1,2}:\d{2}:\d{2})\] ([^:]+): (.*)/;

  const lines = text.split('\n');
  const messages: ParsedMessage[] = [];
  let current: { sender: string; text: string; timestamp: string } | null = null;

  const flush = () => {
    if (!current) return;
    const t = current.text.trim();
    if (!shouldSkip(t)) {
      messages.push({
        sender: current.sender,
        text: t,
        timestamp: current.timestamp,
        direction: current.sender.toLowerCase() === myName.toLowerCase() ? 'outbound' : 'inbound',
      });
    }
    current = null;
  };

  for (const line of lines) {
    const match = line.match(MSG_REGEX);
    if (match) {
      flush();
      const [, day, month, year, time, sender, msgText] = match;
      const isoDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${time}.000Z`;
      current = { sender: sender.trim(), text: msgText, timestamp: isoDate };
    } else if (current) {
      // Continuation of previous message
      if (line.trim()) current.text += '\n' + line.trim();
    }
  }
  flush();

  return messages;
}

/** Detect the contact name (non-myName sender that appears most often) */
function detectContactName(messages: ParsedMessage[], myName: string): string | null {
  const counts: Record<string, number> = {};
  for (const m of messages) {
    if (m.sender.toLowerCase() !== myName.toLowerCase()) {
      counts[m.sender] = (counts[m.sender] || 0) + 1;
    }
  }
  const entries = Object.entries(counts);
  if (!entries.length) return null;
  entries.sort((a, b) => b[1] - a[1]);
  return entries[0][0];
}

/** Stable message ID for deduplication */
function generateMessageId(sender: string, timestamp: string, text: string): string {
  return 'imp_' + createHash('md5')
    .update(sender + '|' + timestamp + '|' + text.slice(0, 80))
    .digest('hex')
    .slice(0, 20);
}

// ─────────────────────────────────────────────────────────────────────────────
// DB helpers (reuse pattern from webhook)
// ─────────────────────────────────────────────────────────────────────────────

function normalizePhone(phone: string | null): string | null {
  if (!phone) return null;
  let cleaned = phone.replace(/[\s\-\(\)\.]/g, '');
  if (cleaned.startsWith('0')) cleaned = '+44' + cleaned.slice(1);
  else if (!cleaned.startsWith('+')) cleaned = '+' + cleaned;
  if (!/^\+\d{7,15}$/.test(cleaned)) return null;
  return cleaned;
}

async function findOrCreateCandidate(chatName: string, phone: string | null) {
  const normalizedPhone = normalizePhone(phone);

  // Try by phone
  if (normalizedPhone) {
    const { data } = await supabase
      .from('candidates')
      .select('id, name, phone_e164')
      .eq('phone_e164', normalizedPhone)
      .single();
    if (data) return data;
  }

  // Try by name
  const looksLikeName = chatName && !/^\+?\d+$/.test(chatName);
  if (looksLikeName) {
    const { data } = await supabase
      .from('candidates')
      .select('id, name, phone_e164')
      .ilike('name', `%${chatName}%`)
      .limit(1)
      .single();
    if (data) return data;
  }

  // Create new candidate — need org_id and phone_e164 (NOT NULL)
  const { data: existing } = await supabase
    .from('candidates')
    .select('org_id')
    .limit(1)
    .single();
  const orgId = existing?.org_id;
  if (!orgId) {
    console.error('[WA Import] Cannot create candidate — no org_id found');
    return null;
  }

  // If no phone, generate a placeholder so NOT NULL is satisfied.
  // The placeholder won't match any real phone so it won't conflict.
  const phoneToStore = normalizedPhone ?? `+000import${Date.now()}`;

  const { data: newCandidate, error } = await supabase
    .from('candidates')
    .insert({
      org_id: orgId,
      name: looksLikeName ? chatName : 'Unknown',
      phone_e164: phoneToStore,
      status: 'new',
      source: 'whatsapp',
    })
    .select()
    .single();

  if (error) {
    console.error('[WA Import] Failed to create candidate:', error.message);
    return null;
  }
  return newCandidate;
}

// ─────────────────────────────────────────────────────────────────────────────
// AI analysis (same as webhook, analyzes a single message)
// ─────────────────────────────────────────────────────────────────────────────

async function analyzeMessage(text: string): Promise<{
  intent: string; sentiment: string; keyInfo: string[]; suggestedAction: string;
} | null> {
  if (text.length < 5) return null;
  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      system: `You analyze WhatsApp messages from care worker candidates. Extract key information quickly. Return JSON only.`,
      messages: [{
        role: 'user',
        content: `Analyze: "${text.slice(0, 300)}"
Return JSON:
{"intent":"interested|not_interested|question|availability_update|callback_request|document_sent|general","sentiment":"positive|neutral|negative","keyInfo":["key fact"],"suggestedAction":"call_back|send_info|schedule_interview|add_to_pool|no_action|urgent_response"}`,
      }],
    });
    const content = response.content[0];
    if (content.type !== 'text') return null;
    let json = content.text.trim();
    if (json.startsWith('```')) json = json.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    return JSON.parse(json);
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/whatsapp-import
// Body: { chatText: string, myName: string, contactPhone?: string }
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const { chatText, myName, contactPhone } = await request.json() as {
      chatText: string;
      myName: string;
      contactPhone?: string;
    };

    if (!chatText || !myName) {
      return NextResponse.json({ error: 'chatText and myName are required' }, { status: 400 });
    }

    // 1. Parse the export
    const parsed = parseWhatsAppExport(chatText, myName);
    if (!parsed.length) {
      return NextResponse.json({ error: 'No messages found. Check the file format and your WhatsApp name.' }, { status: 400 });
    }

    // 2. Detect contact name
    const contactName = detectContactName(parsed, myName);
    if (!contactName) {
      return NextResponse.json({ error: 'Could not detect contact name — are all messages from you?' }, { status: 400 });
    }

    // 3. Find or create candidate
    const candidate = await findOrCreateCandidate(contactName, contactPhone || null);

    // 4. Bulk upsert all messages (dedup by generated ID)
    const rows = parsed.map(m => ({
      message_id: generateMessageId(m.sender, m.timestamp, m.text),
      candidate_id: candidate?.id || null,
      chat_name: contactName,
      phone_e164: normalizePhone(contactPhone || null),
      direction: m.direction,
      message_text: m.text,
      message_timestamp: m.timestamp,
      captured_at: m.timestamp,   // use original timestamp, not now()
    }));

    // Insert in batches of 100 to avoid payload limits
    let inserted = 0;
    let skipped = 0;
    for (let i = 0; i < rows.length; i += 100) {
      const batch = rows.slice(i, i + 100);
      const { data, error } = await supabase
        .from('whatsapp_messages')
        .upsert(batch, { onConflict: 'message_id', ignoreDuplicates: true })
        .select('id');
      if (error && !error.message.includes('duplicate')) {
        console.error('[WA Import] Batch error:', error.message);
      }
      const batchInserted = data?.length ?? 0;
      inserted += batchInserted;
      skipped += batch.length - batchInserted;
    }

    // 5. AI-analyze last 5 inbound messages — only those not already tagged
    const recentInbound = parsed
      .filter(m => m.direction === 'inbound')
      .slice(-5);

    // Check which of these already have ai_intent in DB (avoid re-analysis on re-import)
    const recentIds = recentInbound.map(m => generateMessageId(m.sender, m.timestamp, m.text));
    const { data: untaggedRows } = await supabase
      .from('whatsapp_messages')
      .select('message_id')
      .in('message_id', recentIds)
      .is('ai_intent', null);
    const untaggedSet = new Set((untaggedRows || []).map(r => r.message_id));

    let analysisCount = 0;
    const keyInfoAccumulator: string[] = [];
    let lastSuggestedAction = 'no_action';

    for (const m of recentInbound) {
      const msgId = generateMessageId(m.sender, m.timestamp, m.text);
      if (!untaggedSet.has(msgId)) continue; // Already analysed — skip

      const analysis = await analyzeMessage(m.text);
      if (!analysis) continue;
      analysisCount++;
      keyInfoAccumulator.push(...analysis.keyInfo);
      lastSuggestedAction = analysis.suggestedAction;

      // Update the stored message row with AI tags
      await supabase
        .from('whatsapp_messages')
        .update({
          ai_intent: analysis.intent,
          ai_sentiment: analysis.sentiment,
          ai_suggested_action: analysis.suggestedAction,
        })
        .eq('message_id', msgId);
    }

    // 6. Update / create candidate intelligence
    if (candidate && keyInfoAccumulator.length > 0) {
      const { data: existingIntel } = await supabase
        .from('candidate_intelligence')
        .select('id, skills')
        .eq('candidate_id', candidate.id)
        .single();

      const mergedSkills = [...new Set([...(existingIntel?.skills || []), ...keyInfoAccumulator])];

      if (existingIntel) {
        await supabase
          .from('candidate_intelligence')
          .update({ skills: mergedSkills, last_analyzed: new Date().toISOString(), updated_at: new Date().toISOString() })
          .eq('id', existingIntel.id);
      } else {
        await supabase
          .from('candidate_intelligence')
          .insert({
            candidate_id: candidate.id,
            name: contactName,
            phone_e164: normalizePhone(contactPhone || null),
            skills: mergedSkills,
            ai_summary: `Imported chat history. Key facts: ${keyInfoAccumulator.slice(0, 5).join('. ')}`,
            last_analyzed: new Date().toISOString(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
      }
    }

    return NextResponse.json({
      success: true,
      contactName,
      candidateId: candidate?.id || null,
      candidateCreated: !!candidate,
      total: parsed.length,
      inserted,
      skipped,
      analysed: analysisCount,
    });

  } catch (error: any) {
    console.error('[WA Import] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
