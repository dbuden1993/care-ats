import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.CLAUDE_API_KEY || '',
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { conversationText, contactName, messageCount, dateRange } = body;

    if (!conversationText) {
      return NextResponse.json({ error: 'No conversation text provided' }, { status: 400 });
    }

    // Truncate very long conversations to stay within token limits
    const maxChars = 15000;
    const truncatedText = conversationText.length > maxChars 
      ? conversationText.substring(0, maxChars) + '\n\n[... conversation truncated ...]'
      : conversationText;

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1000,
      system: `You are an expert recruitment assistant analyzing WhatsApp conversations between a recruiter and a care worker candidate. 
Extract useful information that would help the recruiter understand this candidate's availability, skills, preferences, and reliability.

Be specific and practical. Focus on information that helps match this candidate to care jobs.`,
      messages: [
        {
          role: 'user',
          content: `Analyze this WhatsApp conversation with "${contactName}" (${messageCount} messages from ${dateRange?.from} to ${dateRange?.to}):

${truncatedText}

Extract and return a JSON object with the following fields (use null for any information not found):

{
  "availability": ["list of specific availability mentioned, e.g., 'Weekends only', 'Monday to Friday', 'Nights available'"],
  "preferred_days": ["list of preferred working days mentioned"],
  "preferred_shifts": ["list of preferred shift types, e.g., 'day shifts', 'night shifts', 'live-in'"],
  "skills": ["list of care skills mentioned, e.g., 'dementia care', 'medication administration', 'personal care'"],
  "qualifications": ["list of qualifications mentioned, e.g., 'NVQ Level 2', 'RGN', 'First Aid'"],
  "experience_years": number or null,
  "experience_details": "brief description of their care experience",
  "location_preferences": ["list of areas/locations they can work in"],
  "travel_distance": "how far they're willing to travel, e.g., '30 minutes by car'",
  "rate_expectations": "their expected pay rate if mentioned",
  "transport": "their transport situation, e.g., 'owns car', 'uses public transport'",
  "dbs_status": "DBS certificate status if mentioned",
  "communication_style": "brief note on how they communicate, e.g., 'responsive', 'professional', 'slow to reply'",
  "reliability_score": number from 1-10 based on their responsiveness and follow-through,
  "red_flags": ["any concerns, e.g., 'frequently cancelled', 'unrealistic expectations'"],
  "positive_signals": ["good signs, e.g., 'very enthusiastic', 'flexible', 'reliable history'"],
  "summary": "2-3 sentence summary of this candidate for a recruiter"
}

Return ONLY the JSON object, no other text.`
        }
      ]
    });

    // Parse the response
    const content = response.content[0];
    if (content.type !== 'text') {
      return NextResponse.json({ error: 'Unexpected response format' }, { status: 500 });
    }

    try {
      // Clean up the response - remove markdown code blocks if present
      let jsonText = content.text.trim();
      if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
      }
      
      const analysis = JSON.parse(jsonText);
      return NextResponse.json(analysis);
    } catch (parseError) {
      console.error('Error parsing AI response:', content.text);
      // Return a basic analysis if parsing fails
      return NextResponse.json({
        summary: `Conversation with ${contactName} containing ${messageCount} messages. Full analysis unavailable.`,
        availability: [],
        skills: [],
        red_flags: [],
        positive_signals: []
      });
    }
  } catch (error: any) {
    console.error('WhatsApp analysis error:', error);
    return NextResponse.json(
      { error: 'Analysis failed', details: error.message },
      { status: 500 }
    );
  }
}
