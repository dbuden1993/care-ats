import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const anthropic = new Anthropic({
  apiKey: process.env.CLAUDE_API_KEY!,
});

interface SMSAnalysis {
  sentiment: 'positive' | 'negative' | 'neutral';
  intent: 'interested' | 'not_interested' | 'question' | 'callback_request' | 'stop_request' | 'unclear';
  availability: string | null;
  summary: string;
  suggested_action: 'call_back' | 'send_info' | 'remove_from_list' | 'schedule_interview' | 'answer_question' | 'no_action';
  confidence: number;
  is_opt_out: boolean;
  extracted_info: {
    preferred_call_time?: string;
    questions?: string[];
    concerns?: string[];
    experience_mentioned?: string;
  };
}

async function analyzeWithClaude(
  incomingMessage: string,
  outboundMessage: string | null,
  candidateName: string | null
): Promise<SMSAnalysis> {
  const prompt = `You are an AI assistant helping a healthcare recruitment agency analyze SMS responses from candidates.

CONTEXT:
${outboundMessage ? `Our outbound message was: "${outboundMessage}"` : 'This is an unprompted incoming message.'}
${candidateName ? `Candidate name: ${candidateName}` : 'Unknown candidate'}

INCOMING SMS FROM CANDIDATE:
"${incomingMessage}"

Analyze this SMS response and provide a JSON analysis. Consider:
- Healthcare/care work recruitment context
- UK-based candidates
- Common responses to job outreach

Respond ONLY with valid JSON in this exact format:
{
  "sentiment": "positive" | "negative" | "neutral",
  "intent": "interested" | "not_interested" | "question" | "callback_request" | "stop_request" | "unclear",
  "availability": "extracted availability info or null",
  "summary": "brief 1-2 sentence summary of what the candidate is saying",
  "suggested_action": "call_back" | "send_info" | "remove_from_list" | "schedule_interview" | "answer_question" | "no_action",
  "confidence": 0.0-1.0,
  "is_opt_out": true/false,
  "extracted_info": {
    "preferred_call_time": "if mentioned",
    "questions": ["any questions they asked"],
    "concerns": ["any concerns mentioned"],
    "experience_mentioned": "if they mention experience"
  }
}

INTENT DEFINITIONS:
- interested: They want to know more, are available, or express positive interest
- not_interested: Politely declining, already employed, not looking
- question: Asking about the role, pay, location, hours etc
- callback_request: Asking to be called, giving a time to call
- stop_request: Asking to stop messages, "STOP", "unsubscribe", rude refusal
- unclear: Can't determine intent (single word, gibberish, etc)

OPT-OUT DETECTION:
Set is_opt_out to true if the message contains: STOP, UNSUBSCRIBE, REMOVE, "don't text", "stop texting", "leave me alone", or similar.`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type');
    }

    // Parse the JSON response
    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }

    const analysis = JSON.parse(jsonMatch[0]) as SMSAnalysis;
    return analysis;
  } catch (error) {
    console.error('Claude analysis error:', error);
    // Return a default analysis if Claude fails
    return {
      sentiment: 'neutral',
      intent: 'unclear',
      availability: null,
      summary: 'Unable to analyze message automatically',
      suggested_action: 'no_action',
      confidence: 0,
      is_opt_out: incomingMessage.toUpperCase().includes('STOP'),
      extracted_info: {},
    };
  }
}

// POST - Receive and analyze incoming SMS
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Support multiple SMS gateway formats
    const phoneNumber = body.from || body.phone || body.sender || body.phoneNumber;
    const messageText = body.message || body.text || body.body || body.smsMessage;
    const timestamp = body.timestamp || body.receivedAt || new Date().toISOString();

    if (!phoneNumber || !messageText) {
      return NextResponse.json(
        { error: 'Missing phone number or message text' },
        { status: 400 }
      );
    }

    // Normalize phone number to E.164
    let normalizedPhone = phoneNumber.replace(/\s+/g, '');
    if (normalizedPhone.startsWith('0')) {
      normalizedPhone = '+44' + normalizedPhone.slice(1);
    } else if (!normalizedPhone.startsWith('+')) {
      normalizedPhone = '+' + normalizedPhone;
    }

    // Find the candidate by phone number
    const { data: candidate } = await supabase
      .from('candidates')
      .select('id, name')
      .eq('phone_e164', normalizedPhone)
      .single();

    // Find the most recent outbound message to this number (for context)
    const { data: lastOutbound } = await supabase
      .from('sms_messages')
      .select('message_text, campaign_id')
      .eq('phone_e164', normalizedPhone)
      .eq('direction', 'outbound')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    // Analyze the message with Claude
    const analysis = await analyzeWithClaude(
      messageText,
      lastOutbound?.message_text || null,
      candidate?.name || null
    );

    // Store the incoming message with analysis
    const { data: smsRecord, error: insertError } = await supabase
      .from('sms_messages')
      .insert({
        candidate_id: candidate?.id || null,
        phone_e164: normalizedPhone,
        direction: 'inbound',
        message_text: messageText,
        campaign_id: lastOutbound?.campaign_id || null,
        ai_sentiment: analysis.sentiment,
        ai_intent: analysis.intent,
        ai_availability: analysis.availability,
        ai_summary: analysis.summary,
        ai_suggested_action: analysis.suggested_action,
        ai_confidence: analysis.confidence,
        status: 'received',
        received_at: timestamp,
        analyzed_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error storing SMS:', insertError);
      return NextResponse.json({ error: 'Failed to store message' }, { status: 500 });
    }

    // If opt-out detected, update candidate
    if (analysis.is_opt_out && candidate?.id) {
      await supabase
        .from('candidates')
        .update({ 
          sms_opt_out: true,
          sms_interest_level: 'not_interested',
          updated_at: new Date().toISOString()
        })
        .eq('id', candidate.id);
    }

    return NextResponse.json({
      success: true,
      message_id: smsRecord.id,
      analysis: {
        sentiment: analysis.sentiment,
        intent: analysis.intent,
        summary: analysis.summary,
        suggested_action: analysis.suggested_action,
        is_opt_out: analysis.is_opt_out,
      },
      candidate_matched: !!candidate,
    });

  } catch (error) {
    console.error('SMS webhook error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET - Fetch SMS conversations with analysis
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const phone = searchParams.get('phone');
  const intent = searchParams.get('intent');
  const campaign_id = searchParams.get('campaign_id');
  const limit = parseInt(searchParams.get('limit') || '50');

  try {
    let query = supabase
      .from('sms_messages')
      .select(`
        *,
        candidates (
          id,
          name,
          roles,
          status
        )
      `)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (phone) {
      query = query.eq('phone_e164', phone);
    }

    if (intent) {
      query = query.eq('ai_intent', intent);
    }

    if (campaign_id) {
      query = query.eq('campaign_id', campaign_id);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ messages: data });
  } catch (error) {
    console.error('Error fetching SMS:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
