import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const anthropic = new Anthropic({
  apiKey: process.env.CLAUDE_API_KEY || '',
});

interface WhatsAppMessage {
  id: string;
  chatName: string;
  phone: string | null;
  direction: 'inbound' | 'outbound';
  text: string;
  timestamp: string;
  rawTimestamp: string;
  capturedAt: string;
}

interface WebhookPayload {
  source: string;
  messages: WhatsAppMessage[];
  capturedAt: string;
}

// Normalize phone number to E.164 format
function normalizePhone(phone: string | null): string | null {
  if (!phone) return null;
  
  let cleaned = phone.replace(/[\s\-\(\)\.]/g, '');
  
  // UK numbers
  if (cleaned.startsWith('0')) {
    cleaned = '+44' + cleaned.slice(1);
  } else if (!cleaned.startsWith('+')) {
    cleaned = '+' + cleaned;
  }
  
  return cleaned;
}

// Find or create candidate by phone/name
async function findOrCreateCandidate(chatName: string, phone: string | null) {
  const normalizedPhone = normalizePhone(phone);
  
  // Try to find by phone first
  if (normalizedPhone) {
    const { data: byPhone } = await supabase
      .from('candidates')
      .select('id, name, phone_e164')
      .eq('phone_e164', normalizedPhone)
      .single();
    
    if (byPhone) return byPhone;
  }
  
  // Try to find by name (if it looks like a name, not a number)
  const looksLikeName = chatName && !/^\+?\d+$/.test(chatName);
  if (looksLikeName) {
    const { data: byName } = await supabase
      .from('candidates')
      .select('id, name, phone_e164')
      .ilike('name', `%${chatName}%`)
      .limit(1)
      .single();
    
    if (byName) return byName;
  }
  
  // Create new candidate if we have a phone number
  if (normalizedPhone) {
    const { data: newCandidate } = await supabase
      .from('candidates')
      .insert({
        name: looksLikeName ? chatName : null,
        phone_e164: normalizedPhone,
        status: 'new',
        source: 'whatsapp'
      })
      .select()
      .single();
    
    return newCandidate;
  }
  
  return null;
}

// Store message in database
async function storeMessage(message: WhatsAppMessage, candidateId: string | null) {
  const { data, error } = await supabase
    .from('whatsapp_messages')
    .insert({
      candidate_id: candidateId,
      chat_name: message.chatName,
      phone_e164: normalizePhone(message.phone),
      direction: message.direction,
      message_text: message.text,
      message_id: message.id,
      message_timestamp: message.timestamp,
      captured_at: message.capturedAt
    })
    .select()
    .single();
  
  if (error) {
    console.error('Error storing message:', error);
    return null;
  }
  
  return data;
}

// Analyze message with AI for quick insights
async function analyzeMessage(message: WhatsAppMessage): Promise<{
  intent: string;
  sentiment: string;
  keyInfo: string[];
  suggestedAction: string;
} | null> {
  // Only analyze inbound messages
  if (message.direction !== 'inbound') return null;
  
  // Skip very short messages
  if (message.text.length < 5) return null;
  
  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      system: `You analyze WhatsApp messages from care worker candidates. Extract key information quickly.`,
      messages: [{
        role: 'user',
        content: `Analyze this WhatsApp message from a candidate:

"${message.text}"

Return JSON only:
{
  "intent": "interested|not_interested|question|availability_update|callback_request|document_sent|general",
  "sentiment": "positive|neutral|negative",
  "keyInfo": ["list of key facts mentioned, e.g., 'available weekends', 'has car', 'NVQ2 qualified'"],
  "suggestedAction": "call_back|send_info|schedule_interview|add_to_pool|no_action|urgent_response"
}`
      }]
    });

    const content = response.content[0];
    if (content.type !== 'text') return null;

    let jsonText = content.text.trim();
    if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }

    return JSON.parse(jsonText);
  } catch (error) {
    console.error('Error analyzing message:', error);
    return null;
  }
}

// Update candidate intelligence with new information
async function updateIntelligence(
  candidateId: string, 
  chatName: string,
  phone: string | null,
  analysis: { intent: string; sentiment: string; keyInfo: string[]; suggestedAction: string }
) {
  const normalizedPhone = normalizePhone(phone);
  
  // Get existing intelligence
  const { data: existing } = await supabase
    .from('candidate_intelligence')
    .select('*')
    .eq('candidate_id', candidateId)
    .single();
  
  if (existing) {
    // Merge new key info with existing
    const existingInfo = existing.skills || [];
    const newInfo = [...new Set([...existingInfo, ...analysis.keyInfo])];
    
    await supabase
      .from('candidate_intelligence')
      .update({
        skills: newInfo,
        last_analyzed: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', existing.id);
  } else {
    // Create new intelligence record
    await supabase
      .from('candidate_intelligence')
      .insert({
        candidate_id: candidateId,
        phone_e164: normalizedPhone,
        name: chatName,
        skills: analysis.keyInfo,
        ai_summary: `Latest intent: ${analysis.intent}. ${analysis.keyInfo.join('. ')}`,
        last_analyzed: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload: WebhookPayload = await request.json();
    
    if (!payload.messages || payload.messages.length === 0) {
      return NextResponse.json({ success: true, processed: 0 });
    }

    console.log(`[WhatsApp Webhook] Received ${payload.messages.length} messages`);

    const results = [];

    for (const message of payload.messages) {
      try {
        // Find or create candidate
        const candidate = await findOrCreateCandidate(message.chatName, message.phone);
        
        // Store the message
        const stored = await storeMessage(message, candidate?.id || null);
        
        // Analyze inbound messages
        if (message.direction === 'inbound') {
          const analysis = await analyzeMessage(message);
          
          if (analysis && candidate) {
            // Update message with analysis
            if (stored) {
              await supabase
                .from('whatsapp_messages')
                .update({
                  ai_intent: analysis.intent,
                  ai_sentiment: analysis.sentiment,
                  ai_suggested_action: analysis.suggestedAction
                })
                .eq('id', stored.id);
            }
            
            // Update candidate intelligence
            await updateIntelligence(candidate.id, message.chatName, message.phone, analysis);
          }
          
          results.push({
            messageId: message.id,
            candidateId: candidate?.id,
            analysis: analysis
          });
        } else {
          results.push({
            messageId: message.id,
            candidateId: candidate?.id,
            analysis: null
          });
        }
      } catch (msgError) {
        console.error(`Error processing message ${message.id}:`, msgError);
        results.push({
          messageId: message.id,
          error: String(msgError)
        });
      }
    }

    return NextResponse.json({
      success: true,
      processed: results.length,
      results
    });

  } catch (error: any) {
    console.error('[WhatsApp Webhook] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// GET endpoint to check webhook is working
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'CareRecruit WhatsApp Webhook',
    timestamp: new Date().toISOString()
  });
}
