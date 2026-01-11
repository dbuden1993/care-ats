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

// Helper to convert Dialpad timestamp to ISO date
function parseDialpadDate(timestamp: any): string | null {
  if (!timestamp) return null;
  try {
    if (typeof timestamp === 'number' || /^\d+$/.test(timestamp)) {
      const ms = parseInt(timestamp);
      if (ms > 946684800000 && ms < 4102444800000) {
        return new Date(ms).toISOString();
      }
    }
    const d = new Date(timestamp);
    if (!isNaN(d.getTime())) {
      return d.toISOString();
    }
  } catch (e) {}
  return null;
}

// Normalize phone to E.164
function normalizePhone(phone: string): string {
  let cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('0')) cleaned = '44' + cleaned.slice(1);
  if (!cleaned.startsWith('+')) cleaned = '+' + cleaned;
  return cleaned;
}

// Analyze recording with Claude
async function analyzeRecording(audioBase64: string, mediaType: string, phone: string, direction: string) {
  console.log('🤖 Analyzing recording with Claude...');
  
  const prompt = `You are analyzing a recruitment phone call recording for a healthcare staffing agency.

PHONE: ${phone}
DIRECTION: ${direction}

Listen to this call and extract the following information in JSON format:

{
  "call_type": "RECRUITMENT_CALL" | "SPAM_CALL" | "SALES_CALL" | "WRONG_NUMBER" | "VOICEMAIL" | "BRIEF_CALL" | "CALLBACK_REQUEST",
  "candidate_name": "Full name or null if not mentioned",
  "experience_summary": "Detailed 12-15 sentence summary of their care experience, qualifications, and background",
  "call_summary": "20-30 bullet points covering everything discussed",
  "energy_score": 1-5 (1=very low energy/disinterested, 5=very enthusiastic),
  "quality_assessment": "HIGH" | "MEDIUM" | "LOW" | "UNQUALIFIED",
  "roles": ["Array of care roles they're interested in or experienced with"],
  "driver": "Yes" | "No" | "Learning" | "Unknown",
  "dbs_status": "Update Service" | "Has DBS" | "Needs DBS" | "Unknown",
  "mandatory_training": "Complete" | "Partial" | "None" | "Unknown",
  "earliest_start_date": "YYYY-MM-DD or null",
  "weekly_rota": "e.g. 'Mon-Fri days' or 'Flexible' or null",
  "follow_up_questions": ["Questions to ask in next call"],
  "extraction_confidence": 0-100,
  "transcript": "Full transcript of the call"
}

Be thorough and extract as much information as possible. For care workers, pay attention to:
- Types of care experience (dementia, palliative, learning disabilities, etc.)
- Settings worked in (domiciliary, residential, hospital)
- Qualifications (NVQ, QCF, Care Certificate)
- Availability and flexibility
- Attitude and communication skills`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'audio',
            source: {
              type: 'base64',
              media_type: mediaType as any,
              data: audioBase64,
            },
          },
          { type: 'text', text: prompt }
        ],
      }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return null;
  } catch (err: any) {
    console.error('Claude analysis error:', err.message);
    return null;
  }
}

// Download recording from Dialpad
async function downloadRecording(url: string): Promise<{ base64: string; mediaType: string } | null> {
  try {
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${process.env.DIALPAD_API_KEY}`,
      },
    });
    
    if (!response.ok) return null;
    
    const buffer = await response.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');
    const contentType = response.headers.get('content-type') || 'audio/mpeg';
    
    return { base64, mediaType: contentType };
  } catch (err) {
    console.error('Download error:', err);
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    console.log('📞 Dialpad webhook received:', payload.state);
    
    // Only process recording events
    if (payload.state !== 'recording') {
      return NextResponse.json({ status: 'ignored', reason: 'not a recording event' });
    }
    
    const callId = payload.call_id?.toString();
    const phone = payload.contact?.phone || payload.external_number;
    const direction = payload.direction || 'unknown';
    const recordingUrls = payload.recording_url;
    
    if (!callId || !phone) {
      return NextResponse.json({ status: 'ignored', reason: 'missing call_id or phone' });
    }
    
    // Check if already processed
    const { data: existing } = await supabase
      .from('processed_dialpad_calls')
      .select('id')
      .eq('call_id', callId)
      .limit(1);
    
    if (existing && existing.length > 0) {
      return NextResponse.json({ status: 'ignored', reason: 'already processed' });
    }
    
    // Get recording URL (can be array)
    const recordingUrl = Array.isArray(recordingUrls) ? recordingUrls[0] : recordingUrls;
    
    if (!recordingUrl) {
      // Mark as processed but no recording
      await supabase.from('processed_dialpad_calls').insert([{
        call_id: callId,
        phone: phone,
        status: 'no_recording',
        processed_at: new Date().toISOString(),
      }]);
      return NextResponse.json({ status: 'ignored', reason: 'no recording URL' });
    }
    
    console.log('🎙️ Downloading recording...');
    const audio = await downloadRecording(recordingUrl);
    
    if (!audio) {
      await supabase.from('processed_dialpad_calls').insert([{
        call_id: callId,
        phone: phone,
        status: 'download_failed',
        processed_at: new Date().toISOString(),
      }]);
      return NextResponse.json({ status: 'error', reason: 'failed to download recording' });
    }
    
    console.log('🤖 Analyzing with Claude...');
    const analysis = await analyzeRecording(audio.base64, audio.mediaType, phone, direction);
    
    if (!analysis) {
      await supabase.from('processed_dialpad_calls').insert([{
        call_id: callId,
        phone: phone,
        status: 'analysis_failed',
        processed_at: new Date().toISOString(),
      }]);
      return NextResponse.json({ status: 'error', reason: 'failed to analyze recording' });
    }
    
    // Skip non-recruitment calls from unknown numbers
    if (analysis.call_type !== 'RECRUITMENT_CALL' && analysis.call_type !== 'BRIEF_CALL') {
      const phoneE164 = normalizePhone(phone);
      const { data: known } = await supabase
        .from('candidates')
        .select('id')
        .eq('phone_e164', phoneE164)
        .limit(1);
      
      if (!known || known.length === 0) {
        await supabase.from('processed_dialpad_calls').insert([{
          call_id: callId,
          phone: phone,
          status: 'skipped',
          error_message: `Non-recruitment: ${analysis.call_type}`,
          processed_at: new Date().toISOString(),
        }]);
        return NextResponse.json({ status: 'skipped', reason: `${analysis.call_type} from unknown number` });
      }
    }
    
    // Find or create candidate
    const phoneE164 = normalizePhone(phone);
    let candidateId: string | null = null;
    
    const { data: existingCandidate } = await supabase
      .from('candidates')
      .select('id, name, energy_ratio')
      .eq('phone_e164', phoneE164)
      .limit(1);
    
    if (existingCandidate && existingCandidate.length > 0) {
      candidateId = existingCandidate[0].id;
      
      // Update candidate with new info (only if better)
      const updates: any = {
        last_called_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      
      if (analysis.candidate_name && analysis.candidate_name !== 'Unknown' && !existingCandidate[0].name) {
        updates.name = analysis.candidate_name;
      }
      if (analysis.experience_summary) updates.experience_summary = analysis.experience_summary;
      if (analysis.roles?.length) updates.roles = analysis.roles.join(', ');
      if (analysis.driver && analysis.driver !== 'Unknown') updates.driver = analysis.driver;
      if (analysis.dbs_status && analysis.dbs_status !== 'Unknown') updates.dbs_update_service = analysis.dbs_status;
      if (analysis.mandatory_training && analysis.mandatory_training !== 'Unknown') updates.mandatory_training = analysis.mandatory_training;
      if (analysis.earliest_start_date) updates.earliest_start_date = analysis.earliest_start_date;
      
      // Update energy ratio (running average)
      if (analysis.energy_score) {
        const oldRatio = existingCandidate[0].energy_ratio || analysis.energy_score;
        updates.energy_ratio = (oldRatio + analysis.energy_score) / 2;
      }
      
      await supabase.from('candidates').update(updates).eq('id', candidateId);
    } else {
      // Create new candidate
      const { data: newCandidate, error } = await supabase
        .from('candidates')
        .insert([{
          phone_e164: phoneE164,
          name: analysis.candidate_name || null,
          status: 'new',
          source: 'Dialpad Call',
          experience_summary: analysis.experience_summary,
          roles: analysis.roles?.join(', '),
          driver: analysis.driver !== 'Unknown' ? analysis.driver : null,
          dbs_update_service: analysis.dbs_status !== 'Unknown' ? analysis.dbs_status : null,
          mandatory_training: analysis.mandatory_training !== 'Unknown' ? analysis.mandatory_training : null,
          earliest_start_date: analysis.earliest_start_date,
          energy_ratio: analysis.energy_score,
          last_called_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
        }])
        .select('id')
        .single();
      
      if (newCandidate) {
        candidateId = newCandidate.id;
      }
    }
    
    // Save to calls table
    const callTime = parseDialpadDate(payload.date_started);
    await supabase.from('calls').insert([{
      call_id: callId,
      candidate_id: candidateId,
      candidate_phone_e164: phoneE164,
      call_time: callTime,
      direction: direction,
      duration_ms: payload.duration ? Math.round(payload.duration * 1000) : null,
      transcript: analysis.transcript,
      ai_recap: analysis.call_summary,
      energy_score: analysis.energy_score,
      extracted_json: analysis,
    }]);
    
    // Save to call_history table
    await supabase.from('call_history').insert([{
      candidate_id: candidateId,
      phone_e164: phoneE164,
      call_id: callId,
      call_time: callTime,
      direction: direction,
      duration_ms: payload.duration ? Math.round(payload.duration * 1000) : null,
      candidate_name: analysis.candidate_name,
      experience_summary: analysis.experience_summary,
      call_summary: analysis.call_summary,
      roles: analysis.roles,
      driver: analysis.driver,
      dbs_status: analysis.dbs_status,
      mandatory_training: analysis.mandatory_training,
      earliest_start_date: analysis.earliest_start_date,
      weekly_rota: analysis.weekly_rota,
      energy_score: analysis.energy_score,
      quality_assessment: analysis.quality_assessment,
      follow_up_questions: analysis.follow_up_questions,
      call_type: analysis.call_type,
      extraction_confidence: analysis.extraction_confidence,
      transcript: analysis.transcript,
    }]);
    
    // Mark as processed
    await supabase.from('processed_dialpad_calls').insert([{
      call_id: callId,
      phone: phone,
      status: 'processed',
      has_recording: true,
      call_date: callTime,
      processed_at: new Date().toISOString(),
    }]);
    
    console.log('✅ Call processed successfully:', callId);
    return NextResponse.json({ 
      status: 'success', 
      call_id: callId,
      candidate_id: candidateId,
      call_type: analysis.call_type,
    });
    
  } catch (err: any) {
    console.error('Webhook error:', err);
    return NextResponse.json({ status: 'error', message: err.message }, { status: 500 });
  }
}

// Also handle GET for webhook verification
export async function GET(req: NextRequest) {
  return NextResponse.json({ status: 'ok', message: 'Dialpad webhook endpoint active' });
}
