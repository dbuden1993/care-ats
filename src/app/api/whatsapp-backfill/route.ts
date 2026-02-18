// POST /api/whatsapp-backfill
// Re-analyses inbound WhatsApp messages that have no AI tags (ai_intent = null)
// Runs through last 7 days, calls Haiku per message, updates the row
// Processes 30 at a time — call repeatedly until pending count reaches 0

import { NextResponse } from 'next/server';

export const maxDuration = 60; // Vercel max for Hobby plan
import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const anthropic = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY || '' });

async function analyzeMessage(text: string): Promise<{
  intent: string; sentiment: string; keyInfo: string[]; suggestedAction: string;
} | null> {
  if (!text || text.trim().length < 3) return null;

  // Skip media placeholders
  const SKIP = ['[Image]', '[Video]', '[Audio]', '[Document]', '[Sticker]', '<Media omitted>'];
  if (SKIP.some(p => text.trim() === p)) return null;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      system: 'You analyze WhatsApp messages from care worker candidates. Return JSON only.',
      messages: [{
        role: 'user',
        content: `Analyze: "${text.slice(0, 300)}"
Return JSON:
{"intent":"interested|not_interested|question|availability_update|callback_request|document_sent|general","sentiment":"positive|neutral|negative","keyInfo":["key fact"],"suggestedAction":"call_back|send_info|schedule_interview|add_to_pool|no_action|urgent_response"}`,
      }],
    });
    const block = response.content[0];
    if (block.type !== 'text') return null;
    let json = block.text.trim();
    if (json.startsWith('```')) json = json.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export async function POST() {
  try {
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    // Find inbound messages from the last 7 days with no AI analysis
    const { data: messages, error } = await supabase
      .from('whatsapp_messages')
      .select('id, message_text, candidate_id, chat_name')
      .eq('direction', 'inbound')
      .is('ai_intent', null)
      .gte('captured_at', cutoff)
      .order('captured_at', { ascending: true })
      .limit(30); // Keep well within 60s timeout (~30 × ~1s per Haiku call)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!messages?.length) return NextResponse.json({ ok: true, analysed: 0, message: 'Nothing to backfill — all messages already have AI tags.' });

    let analysed = 0;
    let skipped = 0;

    for (const msg of messages) {
      const analysis = await analyzeMessage(msg.message_text);
      if (!analysis) { skipped++; continue; }

      await supabase
        .from('whatsapp_messages')
        .update({
          ai_intent: analysis.intent,
          ai_sentiment: analysis.sentiment,
          ai_suggested_action: analysis.suggestedAction,
        })
        .eq('id', msg.id);

      analysed++;
    }

    return NextResponse.json({
      ok: true,
      total: messages.length,
      analysed,
      skipped,
      message: `Done — ${analysed} analysed, ${skipped} skipped. Click again if more remain.`,
    });

  } catch (error: any) {
    console.error('[Backfill] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// GET — just returns how many messages need backfilling
export async function GET() {
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { count } = await supabase
    .from('whatsapp_messages')
    .select('*', { count: 'exact', head: true })
    .eq('direction', 'inbound')
    .is('ai_intent', null)
    .gte('captured_at', cutoff);

  return NextResponse.json({ pending: count ?? 0 });
}
