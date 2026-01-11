// dialpad-sync.js
// Replaces Zapier - Polls Dialpad for new calls, analyzes with Claude AI, saves to Supabase
// Run with: node dialpad-sync.js

const path = require('path');
const fs = require('fs');
const os = require('os');
require('dotenv').config({ path: path.join(__dirname, '.env.local') });

const Anthropic = require('@anthropic-ai/sdk');
const { createClient } = require('@supabase/supabase-js');
const OpenAI = require('openai');

// ============ CONFIGURATION ============
const DIALPAD_API_KEY = process.env.DIALPAD_API_KEY;
const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Validate config
if (!DIALPAD_API_KEY) throw new Error('Missing DIALPAD_API_KEY in .env.local');
if (!CLAUDE_API_KEY) throw new Error('Missing CLAUDE_API_KEY in .env.local');
if (!OPENAI_API_KEY) throw new Error('Missing OPENAI_API_KEY in .env.local');
if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error('Missing Supabase config in .env.local');

// Initialize clients
const anthropic = new Anthropic({ apiKey: CLAUDE_API_KEY });
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

console.log('🔧 Configuration loaded');
console.log('   Dialpad API:', DIALPAD_API_KEY ? '✅' : '❌');
console.log('   Claude API:', CLAUDE_API_KEY ? '✅' : '❌');
console.log('   OpenAI API:', OPENAI_API_KEY ? '✅' : '❌');
console.log('   Supabase:', SUPABASE_URL ? '✅' : '❌');

// ============ DIALPAD API ============
const DIALPAD_BASE = 'https://dialpad.com/api/v2';

async function dialpadRequest(endpoint, params = {}, method = 'GET', body = null) {
  const url = new URL(`${DIALPAD_BASE}${endpoint}`);
  
  if (method === 'GET') {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null) url.searchParams.append(k, v);
    });
  }
  
  const options = {
    method,
    headers: {
      'Authorization': `Bearer ${DIALPAD_API_KEY}`,
      'Accept': 'application/json'
    }
  };
  
  if (body && method !== 'GET') {
    options.headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(body);
  }
  
  const res = await fetch(url.toString(), options);
  
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Dialpad API error ${res.status}: ${text.slice(0, 200)}`);
  }
  
  return res.json();
}

// Fetch ALL calls with pagination
async function fetchAllCalls() {
  console.log(`\n📞 Fetching ALL calls from Dialpad...`);
  
  let allCalls = [];
  let cursor = null;
  let pageNum = 1;
  let retries = 0;
  const maxRetries = 3;
  
  try {
    while (true) {
      const params = {
        limit: 50, // Reduced to avoid rate limits
        state: 'hangup'
      };
      
      if (cursor) {
        params.cursor = cursor;
      }
      
      console.log(`   📄 Fetching page ${pageNum}...`);
      
      try {
        const data = await dialpadRequest('/call', params);
        
        const calls = data.items || data.calls || [];
        console.log(`      Found ${calls.length} calls on this page`);
        
        if (calls.length === 0) break;
        
        allCalls = allCalls.concat(calls);
        
        // Check for next page cursor
        cursor = data.cursor || data.next_cursor || data.nextCursor;
        if (!cursor) break;
        
        pageNum++;
        retries = 0; // Reset retries on success
        
        // Safety limit
        if (allCalls.length >= 1000) {
          console.log(`   ⚠️ Reached 1000 call limit, stopping pagination`);
          break;
        }
        
        // Longer delay between pages to avoid rate limiting
        console.log(`      Waiting 2s before next page...`);
        await new Promise(r => setTimeout(r, 2000));
        
      } catch (pageErr) {
        retries++;
        console.error(`   ⚠️ Page ${pageNum} failed (attempt ${retries}/${maxRetries}):`, pageErr.message);
        
        if (retries >= maxRetries) {
          console.log(`   ❌ Max retries reached, stopping pagination`);
          break;
        }
        
        // Wait longer before retry
        console.log(`   ⏳ Waiting 5s before retry...`);
        await new Promise(r => setTimeout(r, 5000));
      }
    }
    
    console.log(`   ✅ Total calls fetched: ${allCalls.length}`);
    
    if (allCalls.length > 0) {
      console.log('   📋 Sample call structure:', JSON.stringify(allCalls[0], null, 2).slice(0, 800));
    }
    
    return allCalls;
  } catch (err) {
    console.error('   ❌ Error fetching calls:', err.message);
    return allCalls; // Return what we have so far
  }
}

// Fetch call details including recording URL
async function fetchCallDetails(callId) {
  try {
    const call = await dialpadRequest(`/call/${callId}`);
    return call;
  } catch (err) {
    console.error(`   ❌ Error fetching call ${callId}:`, err.message);
    return null;
  }
}

// Fetch recording URL for a call - try multiple methods
async function fetchRecordingUrl(callId) {
  console.log(`   🔍 Looking for recording...`);
  
  try {
    const callDetails = await fetchCallDetails(callId);
    
    if (!callDetails) {
      console.log(`   ❌ Could not fetch call details`);
      return null;
    }
    
    // Method 1: Check admin_recording_urls (most common)
    if (callDetails.admin_recording_urls?.length > 0) {
      const url = callDetails.admin_recording_urls[0];
      console.log(`   ✅ Found admin_recording_url:`, url);
      return url;
    }
    
    // Method 2: Check recording_details array
    if (callDetails.recording_details?.length > 0) {
      const url = callDetails.recording_details[0].url;
      console.log(`   ✅ Found recording in recording_details:`, url);
      return url;
    }
    
    // Method 3: Check recording_url field
    if (callDetails.recording_url) {
      const url = Array.isArray(callDetails.recording_url) ? callDetails.recording_url[0] : callDetails.recording_url;
      console.log(`   ✅ Found recording_url:`, url);
      return url;
    }
    
    console.log(`   ❌ No recording found for this call`);
    return null;
    
  } catch (err) {
    console.log(`   ⚠️ Error getting recording:`, err.message);
    return null;
  }
}

// Download audio file and convert to base64
async function downloadAudio(url) {
  try {
    console.log('   📥 Downloading recording...');
    
    // Add authorization header for Dialpad URLs
    const headers = {};
    if (url.includes('dialpad.com')) {
      headers['Authorization'] = `Bearer ${DIALPAD_API_KEY}`;
    }
    
    const response = await fetch(url, { headers });
    
    if (!response.ok) {
      throw new Error(`Failed to download: ${response.status}`);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');
    
    // Determine media type from URL or response
    const contentType = response.headers.get('content-type') || 'audio/mpeg';
    
    console.log(`   ✅ Downloaded (${Math.round(arrayBuffer.byteLength / 1024)} KB)`);
    return { base64, mediaType: contentType };
  } catch (err) {
    console.error('   ❌ Error downloading audio:', err.message);
    return null;
  }
}

// ============ AI ANALYSIS WITH AUDIO (via Whisper + Claude) ============

// Transcribe audio using OpenAI Whisper API
async function transcribeWithWhisper(audioBase64, mediaType) {
  console.log('   🎤 Transcribing with Whisper...');
  
  // Convert base64 to buffer and save to temp file
  const audioBuffer = Buffer.from(audioBase64, 'base64');
  const ext = mediaType.includes('mp3') ? 'mp3' : mediaType.includes('wav') ? 'wav' : 'mp3';
  const tempFile = path.join(os.tmpdir(), `dialpad_audio_${Date.now()}.${ext}`);
  
  try {
    // Write to temp file
    fs.writeFileSync(tempFile, audioBuffer);
    
    // Use OpenAI SDK
    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(tempFile),
      model: 'whisper-1',
      language: 'en',
      response_format: 'text'
    });
    
    // Clean up temp file
    fs.unlinkSync(tempFile);
    
    console.log(`   ✅ Transcribed (${transcription?.length || 0} chars)`);
    return transcription;
  } catch (err) {
    // Clean up temp file on error
    try { fs.unlinkSync(tempFile); } catch (e) {}
    console.error('   ❌ Whisper transcription failed:', err.message);
    return null;
  }
}

async function analyzeRecording(audioBase64, mediaType, phone, direction) {
  console.log('   🤖 Analyzing recording with Whisper + Claude...');
  
  // Step 1: Transcribe with Whisper (much better than Dialpad's transcript)
  const whisperTranscript = await transcribeWithWhisper(audioBase64, mediaType);
  
  if (!whisperTranscript) {
    console.log('   ❌ Could not transcribe audio');
    return null;
  }
  
  // Step 2: Analyze transcript with Claude
  const prompt = `You are an AI assistant analyzing a recruitment phone call transcript for a healthcare staffing agency.

CALL METADATA:
- Phone: ${phone}
- Direction: ${direction}

TRANSCRIPT (from audio recording):
${whisperTranscript}

Analyze this call and extract the following information. Be accurate - only extract information that is explicitly stated. If something is not discussed, say "Not discussed" or "Unknown".

Respond in JSON format only:

{
  "call_type": "RECRUITMENT_CALL" | "SALES_CALL" | "ADMIN_CALL" | "SPAM_CALL" | "BRIEF_CALL",
  "candidate_name": "extracted name or null (ignore recruiter names like Dario/Daria)",
  "experience_summary": "12-15 sentences summarizing the candidate's healthcare experience, qualifications, and background. Facts only, no inferences.",
  "call_summary": "20-30 bullet points of key information discussed",
  "energy_score": 1-5 (1=very low energy/uninterested, 5=very high energy/enthusiastic),
  "quality_assessment": "HIGH" | "MEDIUM" | "LOW",
  "roles": ["array of job roles discussed - e.g. Carer, Support Worker, HCA, Nurse"],
  "driver": "Yes" | "No" | "Unknown",
  "dbs_status": "Yes" | "No" | "Unknown", 
  "mandatory_training": "Yes" | "No" | "Partial" | "Unknown",
  "earliest_start_date": "YYYY-MM-DD or null",
  "weekly_rota": "availability details or null",
  "follow_up_questions": ["4-5 suggested follow-up questions based on gaps in information"],
  "extraction_confidence": 0-100,
  "transcript": "The full transcript as provided"
}`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    });
    
    const text = response.content[0]?.text || '';
    
    // Parse JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const analysis = JSON.parse(jsonMatch[0]);
      // Include the Whisper transcript
      analysis.transcript = whisperTranscript;
      console.log('   ✅ Analysis complete');
      return analysis;
    } else {
      console.log('   ❌ Could not parse AI response as JSON');
      return null;
    }
  } catch (err) {
    console.error('   ❌ AI analysis failed:', err.message);
    return null;
  }
}

// Fallback: Analyze transcript text if audio fails
async function analyzeTranscript(transcript, phone, direction) {
  if (!transcript || transcript.length < 50) {
    return {
      call_type: 'BRIEF_CALL',
      candidate_name: null,
      experience_summary: 'BRIEF CALL - Limited data available. Not discussed.',
      call_summary: 'Brief call with minimal content.',
      energy_score: 3,
      quality_assessment: 'LOW',
      roles: [],
      driver: 'Unknown',
      dbs_status: 'Unknown',
      mandatory_training: 'Unknown',
      earliest_start_date: null,
      weekly_rota: null,
      follow_up_questions: [],
      extraction_confidence: 20
    };
  }

  console.log('   🤖 Analyzing transcript with Claude AI...');
  
  const prompt = `You are an AI assistant analyzing recruitment phone call transcripts for a healthcare staffing agency.

TRANSCRIPT:
${transcript}

CALL METADATA:
- Phone: ${phone}
- Direction: ${direction}

Analyze this call and extract the following information. Be accurate - only extract information that is explicitly stated. If something is not discussed, say "Not discussed".

Respond in JSON format only:

{
  "call_type": "RECRUITMENT_CALL" | "SALES_CALL" | "ADMIN_CALL" | "SPAM_CALL" | "BRIEF_CALL",
  "candidate_name": "extracted name or null (ignore recruiter names like Dario/Daria)",
  "experience_summary": "12-15 sentences summarizing the candidate's healthcare experience, qualifications, and background. Facts only, no inferences.",
  "call_summary": "20-30 bullet points of key information discussed",
  "energy_score": 1-5 (1=very low energy/uninterested, 5=very high energy/enthusiastic),
  "quality_assessment": "HIGH" | "MEDIUM" | "LOW",
  "roles": ["array of job roles discussed - e.g. Carer, Support Worker, HCA, Nurse"],
  "driver": "Yes" | "No" | "Unknown",
  "dbs_status": "Yes" | "No" | "Unknown", 
  "mandatory_training": "Yes" | "No" | "Partial" | "Unknown",
  "earliest_start_date": "YYYY-MM-DD or null",
  "weekly_rota": "availability details or null",
  "follow_up_questions": ["4-5 suggested follow-up questions based on gaps in information"],
  "extraction_confidence": 0-100
}`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }]
    });

    const text = response.content[0].text;
    
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      console.log('   ✅ Analysis complete');
      return parsed;
    }
    
    throw new Error('No JSON found in response');
  } catch (err) {
    console.error('   ❌ AI analysis failed:', err.message);
    return null;
  }
}

// ============ SUPABASE OPERATIONS ============

// Check if call already processed (using tracking table)
async function isCallProcessed(callId) {
  if (!callId) return false;
  
  const { data } = await supabase
    .from('processed_dialpad_calls')
    .select('id')
    .eq('call_id', callId.toString())
    .limit(1);
  
  return data && data.length > 0;
}

// Mark call as processed in tracking table
async function markCallProcessed(callId, phone, status, errorMessage = null, hasRecording = false, callDate = null) {
  if (!callId) return;
  
  // Safely parse the call date
  let parsedDate = null;
  if (callDate) {
    try {
      const d = new Date(callDate);
      if (!isNaN(d.getTime())) {
        parsedDate = d.toISOString();
      }
    } catch (e) {
      // Invalid date, leave as null
    }
  }
  
  try {
    const { data, error } = await supabase
      .from('processed_dialpad_calls')
      .upsert([{
        call_id: callId.toString(),
        phone: phone,
        status: status,
        error_message: errorMessage,
        has_recording: hasRecording,
        call_date: parsedDate,
        processed_at: new Date().toISOString()
      }], { onConflict: 'call_id' })
      .select();
    
    if (error) {
      console.log(`   ⚠️ DB Error marking call: ${error.message}`);
    } else {
      console.log(`   💾 Marked as: ${status}`);
    }
  } catch (err) {
    console.log('   ⚠️ Could not mark call as processed:', err.message);
  }
}

// Find or create candidate by phone
async function findOrCreateCandidate(phone, analysis) {
  if (!phone) return null;
  
  // Normalize phone to E.164
  let phoneE164 = phone.replace(/\D/g, '');
  if (phoneE164.startsWith('0')) phoneE164 = '44' + phoneE164.slice(1);
  if (!phoneE164.startsWith('+')) phoneE164 = '+' + phoneE164;
  
  // Check if candidate exists
  const { data: existing } = await supabase
    .from('candidates')
    .select('*')
    .eq('phone_e164', phoneE164)
    .limit(1);
  
  if (existing && existing.length > 0) {
    const candidate = existing[0];
    
    // Update candidate with new info (don't overwrite good data with unknowns)
    const updates = {};
    
    if (analysis.candidate_name && !candidate.name) {
      updates.name = analysis.candidate_name;
    }
    if (analysis.roles?.length && (!candidate.roles || candidate.roles.length === 0)) {
      updates.roles = analysis.roles;
    }
    if (analysis.driver !== 'Unknown' && candidate.driver === 'Unknown') {
      updates.driver = analysis.driver;
    }
    if (analysis.dbs_status !== 'Unknown' && candidate.dbs_update_service === 'Unknown') {
      updates.dbs_update_service = analysis.dbs_status;
    }
    if (analysis.mandatory_training !== 'Unknown' && candidate.mandatory_training === 'Unknown') {
      updates.mandatory_training = analysis.mandatory_training;
    }
    if (analysis.earliest_start_date && !candidate.earliest_start_date) {
      updates.earliest_start_date = analysis.earliest_start_date;
    }
    if (analysis.weekly_rota && !candidate.weekly_rota) {
      updates.weekly_rota = analysis.weekly_rota;
    }
    
    // Always update energy score and last called
    if (analysis.energy_score) {
      const totalCalls = (candidate.total_calls_scored || 0) + 1;
      const totalEnergy = (candidate.energy_count || 0) + analysis.energy_score;
      updates.energy_count = totalEnergy;
      updates.total_calls_scored = totalCalls;
      updates.energy_ratio = totalEnergy / totalCalls;
    }
    updates.last_called_at = new Date().toISOString();
    
    // Update most recent experience summary
    if (analysis.experience_summary && analysis.quality_assessment !== 'LOW') {
      updates.experience_summary = analysis.experience_summary;
    }
    
    if (Object.keys(updates).length > 0) {
      await supabase
        .from('candidates')
        .update(updates)
        .eq('id', candidate.id);
      console.log(`   📝 Updated candidate: ${candidate.name || phoneE164}`);
    }
    
    return candidate.id;
  }
  
  // Create new candidate
  if (analysis.call_type === 'RECRUITMENT_CALL') {
    const { data: newCandidate, error } = await supabase
      .from('candidates')
      .insert([{
        org_id: '00000000-0000-0000-0000-000000000000',
        phone_e164: phoneE164,
        name: analysis.candidate_name || 'Unknown',
        roles: analysis.roles || [],
        driver: analysis.driver || 'Unknown',
        dbs_update_service: analysis.dbs_status || 'Unknown',
        mandatory_training: analysis.mandatory_training || 'Unknown',
        earliest_start_date: analysis.earliest_start_date,
        weekly_rota: analysis.weekly_rota,
        experience_summary: analysis.experience_summary,
        energy_count: analysis.energy_score || 0,
        total_calls_scored: 1,
        energy_ratio: analysis.energy_score || 0,
        last_called_at: new Date().toISOString(),
        status: 'new',
        source: 'Dialpad Call'
      }])
      .select();
    
    if (error) {
      console.error('   ❌ Error creating candidate:', error.message);
      return null;
    }
    
    console.log(`   ✨ Created new candidate: ${analysis.candidate_name || phoneE164}`);
    return newCandidate[0]?.id;
  }
  
  return null;
}

// Save call to database
// Helper to convert Dialpad timestamp to ISO date
function parseDialpadDate(timestamp) {
  if (!timestamp) return null;
  try {
    // Dialpad returns milliseconds timestamps like 1747653479951
    if (typeof timestamp === 'number' || /^\d+$/.test(timestamp)) {
      const ms = parseInt(timestamp);
      // If it's a reasonable timestamp (after year 2000, before year 2100)
      if (ms > 946684800000 && ms < 4102444800000) {
        return new Date(ms).toISOString();
      }
    }
    // Try parsing as date string
    const d = new Date(timestamp);
    if (!isNaN(d.getTime())) {
      return d.toISOString();
    }
  } catch (e) {
    // Invalid date
  }
  return null;
}

async function saveCall(call, transcript, analysis, candidateId) {
  // Parse dates properly
  const callTime = parseDialpadDate(call.date_started) || parseDialpadDate(call.started_at);
  const callId = (call.call_id || call.id)?.toString();
  
  // Skip the 'calls' table - it has foreign key constraints we can't satisfy
  // The call_history table has all the data we need
  
  // Save to call_history table (full history, never overwrites)
  const historyRecord = {
    candidate_id: candidateId,
    phone_e164: call.external_number,
    call_id: callId,
    call_time: callTime,
    direction: call.direction,
    duration_ms: call.duration ? Math.round(call.duration) : null,
    candidate_name: analysis.candidate_name,
    experience_summary: analysis.experience_summary,
    call_summary: typeof analysis.call_summary === 'string' ? analysis.call_summary : JSON.stringify(analysis.call_summary),
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
    transcript: transcript
  };
  
  const { error: historyError } = await supabase
    .from('call_history')
    .insert([historyRecord]);
  
  if (historyError) {
    console.error('   ❌ Error saving to call_history:', historyError.message);
  } else {
    console.log('   💾 Saved to call_history');
  }
}

// ============ MAIN SYNC FUNCTION ============
async function syncCalls() {
  console.log('\n' + '='.repeat(60));
  console.log('🔄 DIALPAD SYNC STARTED:', new Date().toISOString());
  console.log('='.repeat(60));
  
  // Fetch ALL calls (paginated)
  const calls = await fetchAllCalls();
  
  let processed = 0;
  let skipped = 0;
  let errors = 0;
  let alreadyProcessed = 0;
  
  console.log(`\n📊 Processing ${calls.length} calls...`);
  
  for (let i = 0; i < calls.length; i++) {
    const call = calls[i];
    
    // Try different field names for call ID
    const callId = call.call_id || call.id || call.callId || call.call_sid;
    // Try different field names for phone
    const phone = call.external_number || call.peer_number || call.to_number || call.from_number || call.phone;
    const direction = call.direction || 'unknown';
    const callDate = call.started_at || call.date_started || call.created_at;
    
    // Progress indicator
    if ((i + 1) % 10 === 0 || i === 0) {
      console.log(`\n--- Progress: ${i + 1}/${calls.length} (${Math.round((i + 1) / calls.length * 100)}%) ---`);
    }
    
    console.log(`\n📞 [${i + 1}/${calls.length}] Call ${callId} (${phone})...`);
    
    // Skip if no call ID
    if (!callId) {
      console.log('   ⏭️ Skipping: No call ID');
      skipped++;
      continue;
    }
    
    // Skip if no phone
    if (!phone) {
      console.log('   ⏭️ Skipping: No phone number');
      await markCallProcessed(callId, null, 'skipped', 'No phone number', false, callDate);
      skipped++;
      continue;
    }
    
    // Skip if already processed
    if (await isCallProcessed(callId)) {
      console.log('   ⏭️ Already processed');
      alreadyProcessed++;
      continue;
    }
    
    try {
      let analysis = null;
      let transcript = null;
      let hasRecording = false;
      
      // Try to get recording and analyze audio
      const recordingResult = await fetchRecordingUrl(callId);
      
      if (recordingResult) {
        // Check if it's a recap object or a URL string
        if (typeof recordingResult === 'object' && recordingResult.type === 'recap') {
          // Use Dialpad's AI recap directly
          console.log('   🤖 Using Dialpad AI recap...');
          const recap = recordingResult.data;
          analysis = {
            call_type: 'RECRUITMENT_CALL',
            candidate_name: null,
            experience_summary: recap.summary || recap.recap || 'See call summary.',
            call_summary: recap.action_items?.join('\n') || recap.summary || '',
            energy_score: 3,
            quality_assessment: 'MEDIUM',
            roles: [],
            driver: 'Unknown',
            dbs_status: 'Unknown',
            mandatory_training: 'Unknown',
            earliest_start_date: null,
            weekly_rota: null,
            follow_up_questions: recap.action_items || [],
            extraction_confidence: 50
          };
          transcript = recap.summary || '';
        } else if (typeof recordingResult === 'string') {
          // It's a recording URL
          console.log('   🎙️ Recording found, downloading...');
          hasRecording = true;
          const audio = await downloadAudio(recordingResult);
          
          if (audio) {
            analysis = await analyzeRecording(audio.base64, audio.mediaType, phone, direction);
            if (analysis?.transcript) {
              transcript = analysis.transcript;
            }
          }
        }
      }
      
      // Fallback: try to get Dialpad's transcript
      if (!analysis) {
        console.log('   📝 Trying Dialpad transcript...');
        try {
          const transcriptData = await dialpadRequest(`/transcripts/${callId}`);
          if (transcriptData?.lines?.length > 0) {
            transcript = transcriptData.lines
              .map(item => `${item.speaker || 'Unknown'}: ${item.text}`)
              .join('\n');
            console.log(`   ✅ Got transcript with ${transcriptData.lines.length} lines`);
          } else if (transcriptData?.items?.length > 0) {
            transcript = transcriptData.items
              .map(item => `${item.speaker || 'Unknown'}: ${item.text}`)
              .join('\n');
            console.log(`   ✅ Got transcript with ${transcriptData.items.length} items`);
          }
        } catch (e) {
          console.log(`   ⚠️ Transcript error:`, e.message);
        }
        
        if (transcript && transcript.length > 50) {
          analysis = await analyzeTranscript(transcript, phone, direction);
        }
      }
      
      // Skip if no analysis possible
      if (!analysis) {
        console.log('   ⏭️ Skipping: No recording or transcript available');
        await markCallProcessed(callId, phone, 'no_recording', 'No recording or transcript', hasRecording, callDate);
        skipped++;
        continue;
      }
      
      // Skip non-recruitment calls from unknown numbers
      if (analysis.call_type !== 'RECRUITMENT_CALL' && analysis.call_type !== 'BRIEF_CALL') {
        const { data: known } = await supabase
          .from('candidates')
          .select('id')
          .eq('phone_e164', phone)
          .limit(1);
        
        if (!known || known.length === 0) {
          console.log(`   ⏭️ Skipping: ${analysis.call_type} from unknown number`);
          await markCallProcessed(callId, phone, 'skipped', `Non-recruitment: ${analysis.call_type}`, hasRecording, callDate);
          skipped++;
          continue;
        }
      }
      
      // Find or create candidate
      const candidateId = await findOrCreateCandidate(phone, analysis);
      
      // Save call data
      await saveCall(call, transcript, analysis, candidateId);
      
      // Mark as successfully processed
      await markCallProcessed(callId, phone, 'processed', null, hasRecording, callDate);
      
      console.log('   ✅ Call processed successfully');
      processed++;
      
      // Rate limit: wait 2 seconds between calls
      await new Promise(r => setTimeout(r, 2000));
      
    } catch (err) {
      console.error(`   ❌ Error processing call:`, err.message);
      await markCallProcessed(callId, phone, 'error', err.message, false, callDate);
      errors++;
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 SYNC COMPLETE');
  console.log(`   ✅ Processed: ${processed}`);
  console.log(`   ⏭️ Skipped: ${skipped}`);
  console.log(`   🔄 Already done: ${alreadyProcessed}`);
  console.log(`   ❌ Errors: ${errors}`);
  console.log('='.repeat(60) + '\n');
}

// ============ RUN MODES ============

// Run once
async function runOnce() {
  await syncCalls();
  process.exit(0);
}

// Run continuously (every 5 minutes)
async function runContinuous() {
  console.log('🚀 Starting continuous sync (every 5 minutes)...');
  console.log('   Press Ctrl+C to stop\n');
  
  // Run immediately
  await syncCalls();
  
  // Then every 5 minutes
  setInterval(syncCalls, 5 * 60 * 1000);
}

// Check command line args
const mode = process.argv[2];

if (mode === '--continuous' || mode === '-c') {
  runContinuous();
} else {
  runOnce();
}
