import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

interface SuggestRepliesRequest {
  candidateName: string | null;
  incomingMessage: string;
  intent: string | null;
  sentiment: string | null;
  conversationHistory?: { direction: string; text: string; timestamp: string }[];
  candidateInfo?: {
    roles?: string;
    location?: string;
    lastCalledAt?: string;
    status?: string;
  };
}

export async function POST(request: NextRequest) {
  try {
    const body: SuggestRepliesRequest = await request.json();
    
    const {
      candidateName,
      incomingMessage,
      intent,
      sentiment,
      conversationHistory = [],
      candidateInfo = {}
    } = body;

    const historyText = conversationHistory
      .slice(-5) // Last 5 messages for context
      .map(m => `${m.direction === 'outbound' ? 'You' : 'Candidate'}: ${m.text}`)
      .join('\n');

    const prompt = `You are an AI assistant helping a healthcare recruitment agency respond to candidate SMS messages.

CANDIDATE INFO:
- Name: ${candidateName || 'Unknown'}
- Roles interested in: ${candidateInfo.roles || 'Care work'}
- Location: ${candidateInfo.location || 'Unknown'}
- Status: ${candidateInfo.status || 'New'}
- Last called: ${candidateInfo.lastCalledAt || 'Never'}

CONVERSATION HISTORY:
${historyText || 'No previous messages'}

LATEST MESSAGE FROM CANDIDATE:
"${incomingMessage}"

AI ANALYSIS:
- Intent: ${intent || 'unclear'}
- Sentiment: ${sentiment || 'neutral'}

Generate 3 appropriate reply options for the recruiter to send. Each reply should be:
- Professional but friendly
- Under 160 characters (1 SMS)
- Appropriate for the detected intent
- Include the candidate's first name if known

For different intents, consider:
- INTERESTED: Confirm interest, ask about availability or schedule a call
- CALLBACK_REQUEST: Confirm you'll call, ask for preferred time
- QUESTION: Answer common questions about care work (pay £11-14/hr, flexible hours, DBS required)
- NOT_INTERESTED: Thank them politely, leave door open
- STOP_REQUEST: Confirm removal, apologize for inconvenience

Respond ONLY with valid JSON in this exact format:
{
  "replies": [
    {
      "text": "Reply text here",
      "tone": "friendly|professional|urgent",
      "purpose": "Brief description of what this reply aims to achieve"
    },
    {
      "text": "Second reply option",
      "tone": "friendly|professional|urgent",
      "purpose": "Brief description"
    },
    {
      "text": "Third reply option",
      "tone": "friendly|professional|urgent", 
      "purpose": "Brief description"
    }
  ],
  "recommended": 0,
  "shouldCall": true|false,
  "callUrgency": "high|medium|low|none",
  "notes": "Any additional context or suggestions for the recruiter"
}`;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type');
    }

    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }

    const suggestions = JSON.parse(jsonMatch[0]);
    
    return NextResponse.json({
      success: true,
      suggestions
    });

  } catch (error) {
    console.error('AI reply suggestion error:', error);
    
    // Fallback suggestions if AI fails
    return NextResponse.json({
      success: true,
      suggestions: {
        replies: [
          { text: "Thanks for your message! When would be a good time to call you?", tone: "friendly", purpose: "Schedule a call" },
          { text: "Hi! I'd love to chat about opportunities. Are you free for a quick call today?", tone: "friendly", purpose: "Immediate callback" },
          { text: "Thanks for getting back to me. I'll give you a call shortly to discuss.", tone: "professional", purpose: "Confirm callback" }
        ],
        recommended: 0,
        shouldCall: true,
        callUrgency: "medium",
        notes: "Default suggestions - AI analysis unavailable"
      }
    });
  }
}
