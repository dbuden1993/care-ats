// src/app/api/dialpad/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const anthropic = new Anthropic({
  apiKey: process.env.CLAUDE_API_KEY || '',
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

const DIALPAD_API_KEY = process.env.DIALPAD_API_KEY || '';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    console.log('Dialpad webhook received:', JSON.stringify(body, null, 2));

    const eventType = body.event_type || body.type || body.state;

    // Handle recording state from call events
    if (eventType === 'recording' || body.state === 'recording') {
      return handleRecordingEvent(body);
    }

    // Handle hangup with recording details
    if ((eventType === 'hangup' || body.state === 'hangup') && body.recording_details?.length > 0) {
      return handleCallWithRecording(body);
    }

    // Handle regular hangup without recording
    if (eventType === 'hangup' || body.state === 'hangup') {
      return handleCallHangup(body);
    }

    console.log('Unhandled event type:', eventType);
    return NextResponse.json({ status: 'ok', message: 'Event received' });

  } catch (error) {
    console.error('Dialpad webhook error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function handleCallHangup(data: any) {
  const callId = data.call_id || data.id;
  const phone = data.external_number || data.contact?.phone;

  console.log(`Call ended without recording: ${callId}`);

  try {
    await supabase.from('call_history').upsert({
      call_id: callId,
      phone_e164: phone,
      call_time: new Date().toISOString(),
      direction: data.direction || 'unknown',
      duration_ms: data.duration ? Math.round(data.duration) : null,
    }, { onConflict: 'call_id' });
  } catch (e) {
    console.error('Error storing call:', e);
  }

  return NextResponse.json({ status: 'ok' });
}

async function handleRecordingEvent(data: any) {
  console.log('Recording event received, waiting for hangup with full details');
  return NextResponse.json({ status: 'ok', message: 'Recording event noted' });
}

async function handleCallWithRecording(data: any) {
  const callId = data.call_id || data.id;
  const phone = data.external_number || data.contact?.phone;
  const recordingDetails = data.recording_details?.[0];

  if (!recordingDetails) {
    console.log('No recording details found');
    return handleCallHangup(data);
  }

  const recordingId = recordingDetails.id;
  const recordingType = recordingDetails.recording_type || 'admincallrecording';

  console.log(`Processing call ${callId} with recording ${recordingId}`);

  try {
    // Step 1: Create a share link to get downloadable URL
    console.log('Creating share link...');
    const shareLink = await createShareLink(recordingId, recordingType);
    
    if (!shareLink) {
      console.error('Failed to create share link');
      await storeBasicCallInfo(callId, phone, data, recordingDetails.url);
      return NextResponse.json({ status: 'ok', message: 'Share link creation failed, URL stored' });
    }

    // Step 2: Download the recording
    console.log('Downloading recording from:', shareLink);
    const audioBuffer = await downloadRecording(shareLink);

    if (!audioBuffer) {
      console.error('Failed to download recording');
      await storeBasicCallInfo(callId, phone, data, recordingDetails.url);
      return NextResponse.json({ status: 'ok', message: 'Download failed, URL stored' });
    }

    console.log(`Downloaded ${audioBuffer.byteLength} bytes`);

    // Step 3: Transcribe with Whisper
    console.log('Transcribing with Whisper...');
    const transcript = await transcribeWithWhisper(audioBuffer);

    if (!transcript) {
      console.error('Whisper transcription failed');
      await storeBasicCallInfo(callId, phone, data, recordingDetails.url);
      return NextResponse.json({ status: 'ok', message: 'Transcription failed, URL stored' });
    }

    console.log('Transcript length:', transcript.length);

    // Step 4: Analyze with Claude
    console.log('Analyzing with Claude...');
    const analysis = await analyzeTranscriptWithClaude(transcript, phone);

    // Step 5: Save everything to database
    const record: any = {
      call_id: callId,
      phone_e164: phone,
      recording_url: recordingDetails.url,
      transcript: transcript,
      call_time: new Date(parseInt(data.date_started || Date.now())).toISOString(),
      direction: data.direction || 'unknown',
      duration_ms: data.duration ? Math.round(data.duration) : null,
    };

    if (analysis) {
      record.candidate_name = analysis.candidate_name;
      record.experience_summary = analysis.experience_summary;
      record.call_summary = analysis.call_summary;
      record.roles = analysis.roles || [];
      record.energy_score = analysis.energy_score;
      record.quality_assessment = analysis.quality_assessment?.rating || analysis.quality_assessment;
      record.dbs_status = analysis.compliance?.dbs_status;
      record.driver = analysis.compliance?.driving?.has_license === true ? 'Yes' : 
                      analysis.compliance?.driving?.has_license === false ? 'No' : 'Unknown';
      record.earliest_start_date = analysis.availability?.earliest_start_date;
      record.weekly_rota = analysis.availability?.hours_wanted;
      record.follow_up_questions = analysis.follow_up_actions || [];
      record.call_type = (analysis.call_type || 'SCREENING').toUpperCase();
    }

    // Upsert candidate
    if (phone && analysis?.candidate_name) {
      await upsertCandidate(phone, analysis);
    }

    await supabase.from('call_history').upsert(record, { onConflict: 'call_id' });
    console.log(`✅ Call ${callId} fully processed: ${analysis?.candidate_name || 'Unknown'}, Energy: ${analysis?.energy_score || 'N/A'}`);

    return NextResponse.json({ 
      status: 'ok', 
      message: 'Recording processed successfully',
      candidate_name: analysis?.candidate_name,
      energy_score: analysis?.energy_score
    });

  } catch (e) {
    console.error('Error processing recording:', e);
    await storeBasicCallInfo(callId, phone, data, recordingDetails?.url);
    return NextResponse.json({ status: 'error', message: 'Processing failed' });
  }
}

async function createShareLink(recordingId: string, recordingType: string): Promise<string | null> {
  try {
    const response = await fetch('https://dialpad.com/api/v2/recordingsharelink', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DIALPAD_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        recording_id: recordingId,
        recording_type: recordingType
      })
    });

    if (!response.ok) {
      console.error('Share link API error:', response.status);
      return null;
    }

    const data = await response.json();
    return data.access_link || null;
  } catch (e) {
    console.error('Share link error:', e);
    return null;
  }
}

async function downloadRecording(shareLink: string): Promise<Buffer | null> {
  try {
    const response = await fetch(shareLink, {
      headers: {
        'Authorization': `Bearer ${DIALPAD_API_KEY}`
      }
    });

    if (!response.ok) {
      console.error(`Download failed: ${response.status}`);
      return null;
    }

    const contentType = response.headers.get('content-type');
    if (!contentType?.includes('audio')) {
      console.error('Response is not audio:', contentType);
      return null;
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (e) {
    console.error('Download error:', e);
    return null;
  }
}

async function transcribeWithWhisper(audioBuffer: Buffer): Promise<string | null> {
  try {
    const audioFile = new File([audioBuffer], 'recording.mp3', { type: 'audio/mpeg' });

    const response = await openai.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
      language: 'en',
    });

    return response.text;
  } catch (e) {
    console.error('Whisper error:', e);
    return null;
  }
}

async function storeBasicCallInfo(callId: string, phone: string | null, data: any, recordingUrl?: string) {
  try {
    await supabase.from('call_history').upsert({
      call_id: callId,
      phone_e164: phone,
      recording_url: recordingUrl,
      call_time: new Date().toISOString(),
      direction: data.direction || 'unknown',
      duration_ms: data.duration ? Math.round(data.duration) : null,
    }, { onConflict: 'call_id' });
  } catch (e) {
    console.error('Error storing basic call info:', e);
  }
}

async function upsertCandidate(phone: string, analysis: any) {
  try {
    const { data: existing } = await supabase
      .from('candidates')
      .select('id')
      .eq('phone_e164', phone)
      .single();

    const candidateData: any = {
      phone_e164: phone,
      name: analysis.candidate_name || 'Unknown',
      status: 'new',
      source: 'dialpad',
      last_called_at: new Date().toISOString(),
    };

    if (analysis.roles?.length > 0) candidateData.roles = analysis.roles;
    if (analysis.experience_summary) candidateData.experience_summary = analysis.experience_summary;
    if (analysis.compliance?.dbs_status) candidateData.dbs_update_service = analysis.compliance.dbs_status;
    if (analysis.compliance?.driving?.has_license !== null) {
      candidateData.driver = analysis.compliance.driving.has_license ? 'Yes' : 'No';
    }
    if (analysis.availability?.earliest_start_date) {
      candidateData.earliest_start_date = analysis.availability.earliest_start_date;
    }
    if (analysis.availability?.hours_wanted) {
      candidateData.weekly_rota = analysis.availability.hours_wanted;
    }

    if (existing) {
      await supabase.from('candidates').update({
        ...candidateData,
        last_called_at: new Date().toISOString(),
      }).eq('id', existing.id);
    } else {
      await supabase.from('candidates').insert(candidateData);
    }

    console.log(`Candidate ${analysis.candidate_name} upserted`);
  } catch (e) {
    console.error('Error upserting candidate:', e);
  }
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

Analyze this call and return ONLY valid JSON (no markdown, no backticks):
{
  "candidate_name": "Full name or null if not mentioned",
  "experience_summary": "Brief summary of their care experience",
  "roles": ["Array of care roles they're interested in or experienced with"],
  "compliance": {
    "dbs_status": "DBS status mentioned or null",
    "driving": { "has_license": true/false/null }
  },
  "availability": {
    "earliest_start_date": "YYYY-MM-DD format - calculate actual date if they say 'next week', '2 weeks', 'immediately' (use ${today}), etc. Or null if not discussed",
    "hours_wanted": "Hours/shift preference or null"
  },
  "call_summary": "2-3 sentence summary of the call outcome",
  "energy_score": 1-10,
  "quality_assessment": { "rating": "A/B/C/D/F" },
  "follow_up_actions": ["List of next steps or follow-up actions needed"],
  "call_type": "initial_screening/follow_up/reference_check/other"
}`
    }]
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]);
    } catch (e) {
      console.error('JSON parse error:', e);
      return null;
    }
  }
  return null;
}

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: 'Dialpad webhook - FULLY AUTOMATED: Creates share links, downloads recordings, transcribes with Whisper, analyzes with Claude',
    timestamp: new Date().toISOString()
  });
}
