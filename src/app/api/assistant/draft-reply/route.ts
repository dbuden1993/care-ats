import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY || '' });

export async function POST(request: NextRequest) {
  try {
    const { candidateName, message, intent, suggestedAction, type } = await request.json();

    const actionContext: Record<string, string> = {
      call_back: 'They want a callback — acknowledge and propose a time.',
      send_info: 'They need more information — offer to send details.',
      schedule_interview: 'They seem interview-ready — suggest scheduling.',
      add_to_pool: 'They are interested but not quite ready — keep warm.',
      urgent_response: 'This needs an immediate, helpful response.',
      no_action: 'A brief friendly acknowledgement is fine.',
    };

    const context = actionContext[suggestedAction] || 'Reply helpfully and professionally.';

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      system: `You are a recruitment coordinator at a UK care staffing agency. Draft concise, warm, professional WhatsApp reply messages. Keep replies short (2-4 sentences max). Use casual but professional UK English. Never use emojis unless the candidate used them. Sign off as "Care Team".`,
      messages: [{
        role: 'user',
        content: `Draft a ${type === 'whatsapp' ? 'WhatsApp' : 'email'} reply to ${candidateName}.

Their message: "${message}"
Their intent: ${intent || 'general'}
What to do: ${context}

Write ONLY the reply text, nothing else.`
      }]
    });

    const content = response.content[0];
    const reply = content.type === 'text' ? content.text.trim() : '';

    return NextResponse.json({ reply });
  } catch (error: any) {
    console.error('[Draft Reply] Error:', error);
    return NextResponse.json({ reply: '', error: error.message }, { status: 500 });
  }
}
