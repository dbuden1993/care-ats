// src/app/api/dialpad/dialpad-webhook-route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const anthropic = new Anthropic({
  apiKey: process.env.CLAUDE_API_KEY || '',
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    console.log('Dialpad webhook received:', JSON.stringify(body, null, 2));

    // Handle different event types
    const eventType = body.event_type || body.type;
    
    if (eventType === 'call.hangup' || eventType === 'hangup') {
      return handleCallHangup(body);
    }
    
    if (eventType === 'call.recording' || eventType === 'recording') {
      return handleRecording(body);
    }

    if (eventType === 'call.transcription' || eventType === 'transcription') {
      return handleTranscription(body);
    }

    // Log unhandled events
    console.log('Unhandled Dialpad event type:', eventType);
    return NextResponse.json({ status: 'ok', message: 'Event received' });
    
  } catch (error) {
    console.error('Dialpad webhook error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function handleCallHangup(data: any) {
  const callId = data.call_id || data.id;
  const phone = data.external_number || data.contact?.phone_number;
  
  console.log(`Call ended: ${callId}, phone: ${phone}`);
  
  // Store basic call info
  try {
    await supabase.from('call_history').upsert({
      call_id: callId,
      phone_e164: phone,
      call_time: new Date().toISOString(),
      direction: data.direction || 'unknown',
      duration_ms: data.duration_seconds ? data.duration_seconds * 1000 : null,
    }, { onConflict: 'call_id' });
  } catch (e) {
    console.error('Error storing call:', e);
  }
  
  return NextResponse.json({ status: 'ok' });
}

async function handleRecording(data: any) {
  const callId = data.call_id || data.id;
  const recordingUrl = data.recording_url || data.url;
  
  console.log(`Recording available for call ${callId}: ${recordingUrl}`);
  
  // Note: Dialpad admin recordings are not accessible via API
  // This webhook may not provide downloadable URLs for admin recordings
  // The recording URL is stored for reference but may require manual download
  
  if (recordingUrl) {
    try {
      await supabase.from('call_history').upsert({
        call_id: callId,
        recording_url: recordingUrl,
      }, { onConflict: 'call_id' });
    } catch (e) {
      console.error('Error storing recording URL:', e);
    }
  }
  
  return NextResponse.json({ status: 'ok' });
}

async function handleTranscription(data: any) {
  const callId = data.call_id || data.id;
  const transcript = data.transcript || data.text || data.transcription;
  const phone = data.external_number || data.contact?.phone_number;
  
  console.log(`Transcription for call ${callId}`);
  
  if (!transcript) {
    console.log('No transcript in webhook data');
    return NextResponse.json({ status: 'ok', message: 'No transcript' });
  }
  
  // Analyze transcript with Claude
  let analysis = null;
  try {
    analysis = await analyzeTranscriptWithClaude(transcript, phone);
  } catch (e) {
    console.error('Claude analysis failed:', e);
  }
  
  // Store in database
  try {
    const record: any = {
      call_id: callId,
      phone_e164: phone,
      transcript: transcript,
      call_time: new Date().toISOString(),
    };
    
    if (analysis) {
      record.candidate_name = analysis.candidate_name;
      record.experience_summary = analysis.experience_summary;
      record.call_summary = analysis.call_summary;
      record.roles = analysis.roles;
      record.energy_score = analysis.energy_score;
      record.quality_assessment = analysis.quality_assessment?.rating;
      record.dbs_status = analysis.compliance?.dbs_status;
      record.driver = analysis.compliance?.driving?.has_license ? 'Yes' : 'Unknown';
      record.earliest_start_date = analysis.availability?.earliest_start_date;
      record.weekly_rota = analysis.availability?.hours_wanted;
      record.follow_up_questions = analysis.follow_up_actions;
      record.call_type = analysis.call_type;
    }
    
    await supabase.from('call_history').upsert(record, { onConflict: 'call_id' });
    console.log('Call history saved for', callId);
  } catch (e) {
    console.error('Error storing call history:', e);
  }
  
  return NextResponse.json({ status: 'ok', analyzed: !!analysis });
}

async function analyzeTranscriptWithClaude(transcript: string, phone: string | null) {
  const today = new Date().toISOString().split('T')[0];
  
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 3000,
    messages: [{
      role: 'user',
      content: `You are an expert UK healthcare recruitment consultant analyzing a phone screening call for Curevita Care.

TODAY'S DATE: ${today}
PHONE NUMBER: ${phone || 'Unknown'}

TRANSCRIPT:
${transcript}

Analyze this call and return ONLY valid JSON:
{
  "candidate_name": "Full name or null",
  "phone_e164": "${phone || null}",
  "experience_summary": "Summary of care experience",
  "roles": ["Care roles mentioned"],
  "compliance": {
    "dbs_status": "DBS status or null",
    "driving": { "has_license": true/false/null }
  },
  "availability": {
    "earliest_start_date": "YYYY-MM-DD format or null",
    "hours_wanted": "Hours preference or null"
  },
  "call_summary": "2-3 sentence summary",
  "energy_score": 1-10,
  "quality_assessment": { "rating": "A/B/C/D/F" },
  "follow_up_actions": ["Actions needed"],
  "call_type": "initial_screening/follow_up/other"
}`
    }]
  });
  
  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    return JSON.parse(jsonMatch[0]);
  }
  return null;
}

export async function GET() {
  return NextResponse.json({ 
    status: 'ok', 
    message: 'Dialpad webhook endpoint active',
    timestamp: new Date().toISOString()
  });
}
