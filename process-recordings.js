// process-recordings.js
// Processes manually downloaded Dialpad recordings with Whisper + Claude
// 
// USAGE:
//   node process-recordings.js           - Process all recordings
//   node process-recordings.js --test    - Test mode (no Whisper, uses mock transcript)
//   node process-recordings.js --dry-run - Show what would be processed without doing it
//
// SETUP:
// 1. Create a folder: C:\dev\care-ats\web\recordings
// 2. Download MP3s from Dialpad into that folder
// 3. Run: node process-recordings.js
//
// NAMING CONVENTION (optional but helpful):
// Name files as: PHONE_NUMBER.mp3 or PHONE_NUMBER_DATE.mp3
// Examples: +447778180510.mp3, +447778180510_2024-01-05.mp3
// If no phone in filename, the script will still process but won't link to existing candidates

const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '.env.local') });

// Command line flags
const TEST_MODE = process.argv.includes('--test');
const DRY_RUN = process.argv.includes('--dry-run');

if (TEST_MODE) console.log('🧪 TEST MODE - Using mock transcript, no Whisper credits used');
if (DRY_RUN) console.log('🔍 DRY RUN - Showing what would be processed');

const Anthropic = require('@anthropic-ai/sdk');
const { createClient } = require('@supabase/supabase-js');
const OpenAI = require('openai');

// Configuration
const RECORDINGS_FOLDER = path.join(__dirname, 'recordings');
const PROCESSED_FOLDER = path.join(__dirname, 'recordings', 'processed');

const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Validate config
if (!CLAUDE_API_KEY) throw new Error('Missing CLAUDE_API_KEY in .env.local');
if (!OPENAI_API_KEY) throw new Error('Missing OPENAI_API_KEY in .env.local');
if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error('Missing Supabase config in .env.local');

// Initialize clients
const anthropic = new Anthropic({ apiKey: CLAUDE_API_KEY });
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

console.log('🔧 Configuration loaded');
console.log('   Recordings folder:', RECORDINGS_FOLDER);

// Ensure folders exist
if (!fs.existsSync(RECORDINGS_FOLDER)) {
  fs.mkdirSync(RECORDINGS_FOLDER, { recursive: true });
  console.log('   Created recordings folder');
}
if (!fs.existsSync(PROCESSED_FOLDER)) {
  fs.mkdirSync(PROCESSED_FOLDER, { recursive: true });
}

// Extract phone number from filename
function extractPhoneFromFilename(filename) {
  // Match various phone formats
  const phoneMatch = filename.match(/(\+?\d{10,15})/);
  if (phoneMatch) {
    let phone = phoneMatch[1];
    if (!phone.startsWith('+')) {
      // Assume UK if no country code
      if (phone.startsWith('0')) {
        phone = '+44' + phone.slice(1);
      } else if (phone.startsWith('44')) {
        phone = '+' + phone;
      } else {
        phone = '+44' + phone;
      }
    }
    return phone;
  }
  return null;
}

// Transcribe with Whisper
async function transcribeWithWhisper(audioPath) {
  // Test mode - return mock transcript
  if (TEST_MODE) {
    console.log('   🎤 [TEST] Skipping Whisper, using mock transcript...');
    return `Hello, this is a test call. My name is Sarah Johnson and I'm calling about the care assistant position. 
I have 3 years experience working in domiciliary care with elderly clients. I have my Care Certificate and NVQ Level 2. 
My DBS is on the update service. I can drive and have my own car with business insurance.
I'm looking for around 30 hours per week, happy to do days and some weekends. 
I can start in two weeks once my references are sorted. My email is sarah.johnson@email.com.
I previously worked at Helping Hands for 2 years and ABC Care for 1 year.
I have experience with dementia clients and personal care. I'm very passionate about helping people maintain their independence.`;
  }
  
  console.log('   🎤 Transcribing with Whisper...');
  
  try {
    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(audioPath),
      model: 'whisper-1',
      language: 'en',
      response_format: 'text'
    });
    
    console.log(`   ✅ Transcribed (${transcription?.length || 0} chars)`);
    return transcription;
  } catch (err) {
    console.error('   ❌ Whisper error:', err.message);
    return null;
  }
}

// Analyze with Claude - Expert Healthcare Recruiter
async function analyzeWithClaude(transcript, phoneNumber) {
  console.log('   🤖 Analyzing with Claude...');
  
  // Get today's date for AI to calculate relative dates
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  
  const prompt = `You are an expert UK healthcare recruitment consultant analyzing a phone screening call for Curevita Care, a domiciliary care agency.

Your expertise includes:
- UK care sector regulations (CQC compliance)
- Right to work requirements for care workers
- DBS (Disclosure and Barring Service) check levels and portability
- Mandatory care training (Care Certificate, Moving & Handling, Medication Administration, Safeguarding Adults/Children, First Aid, Food Hygiene, Infection Control)
- Care roles: HCA (Healthcare Assistant), Support Worker, Care Assistant, Senior Carer, Team Leader, Live-in Carer, Complex Care Worker
- Specialisms: Dementia care, Learning disabilities, Mental health, Physical disabilities, Elderly care, Palliative/End of life, Pediatric care

TODAY'S DATE: ${todayStr}
PHONE NUMBER: ${phoneNumber || 'Unknown'}

TRANSCRIPT:
${transcript}

Analyze this call as an experienced healthcare recruiter would. Extract information and assess the candidate professionally.

CRITICAL DATE FORMATTING RULES:
- All dates MUST be in YYYY-MM-DD format (e.g., "2026-01-26")
- Calculate actual dates from relative terms:
  * "2 weeks" / "two weeks" / "a fortnight" → add 14 days to ${todayStr}
  * "next week" → add 7 days to ${todayStr}
  * "next Monday" → calculate the actual next Monday date
  * "immediately" / "ASAP" / "right away" → use ${todayStr}
  * "end of the month" → last day of current month
  * "1st of next month" → calculate that date
  * "a month" → add 30 days to ${todayStr}
- If no date mentioned → use null
- NEVER return text like "Two weeks" - always calculate the actual date

Return ONLY valid JSON with this structure:
{
  "candidate_name": "Full name exactly as stated, or null if not mentioned",
  "phone_e164": "${phoneNumber || null}",
  "email": "Email if mentioned, or null",
  
  "experience_summary": "Detailed summary of care experience including: years in care, types of settings (domiciliary, residential, nursing home, hospital), client groups worked with, specific duties performed. Be specific and factual.",
  
  "roles": ["Array of specific care roles they have experience in or are suitable for, e.g. 'HCA', 'Support Worker', 'Senior Carer', 'Complex Care', 'Dementia Care Specialist'"],
  
  "specialisms": ["Specific care specialisms mentioned: e.g. 'Dementia', 'Learning Disabilities', 'Mental Health', 'Physical Disabilities', 'Palliative Care', 'PEG feeding', 'Stoma care', 'Catheter care', 'Tracheostomy'"],
  
  "qualifications": {
    "care_certificate": true/false/null,
    "nvq_level": "2, 3, 4, 5 or null",
    "other_qualifications": ["Any nursing, healthcare or relevant qualifications"]
  },
  
  "mandatory_training": {
    "completed": ["Training courses they have completed"],
    "expired_or_needed": ["Training that needs renewal or hasn't been done"]
  },
  
  "compliance": {
    "dbs_status": "Enhanced with Adults/Children barred list check, Basic, Update Service registered, Needs new DBS, or null",
    "dbs_on_update_service": true/false/null,
    "right_to_work": "British Citizen, Settled Status, Pre-Settled Status, Visa (specify type), Unknown",
    "references": "Number of references available or notes about reference situation",
    "driving": {
      "has_license": true/false/null,
      "has_car": true/false/null,
      "business_insurance": true/false/null
    }
  },
  
  "availability": {
    "earliest_start_date": "MUST be YYYY-MM-DD format. Calculate from today (${todayStr}) if relative date given. Use null if not mentioned.",
    "notice_period": "Current notice period if employed",
    "hours_wanted": "Full-time, Part-time, specific hours per week",
    "shift_patterns": ["Days", "Nights", "Weekends", "Live-in", "Flexible"],
    "travel_radius": "How far they can travel in miles or areas they cover"
  },
  
  "pay_expectations": {
    "hourly_rate": "Expected hourly rate if mentioned",
    "notes": "Any notes about pay discussions"
  },
  
  "red_flags": ["Any concerns: gaps in employment, attitude issues, unrealistic expectations, compliance problems, inconsistencies in story"],
  
  "green_flags": ["Positive indicators: passion for care, reliability indicators, good communication, specific examples of good practice, flexibility"],
  
  "call_summary": "3-4 sentence professional summary of the call outcome and key points discussed. Write as if for a CRM note that another recruiter would read.",
  
  "recruiter_notes": "Your professional assessment and recommended next steps. What should the recruiter do next? Any specific questions to ask in follow-up?",
  
  "energy_score": 1-10,
  "energy_notes": "Brief note on their enthusiasm, communication style, and engagement level",
  
  "quality_assessment": {
    "rating": "A (Excellent - fast track), B (Good - proceed), C (Average - with reservations), D (Below standard - concerns), or F (Not suitable)",
    "reasoning": "Brief explanation of rating"
  },
  
  "follow_up_actions": ["Specific actions needed: e.g. 'Request DBS certificate copy', 'Book face-to-face interview', 'Send compliance documents', 'Check references', 'Verify right to work'"],
  
  "call_type": "initial_screening/follow_up/compliance_check/availability_check/reference_request/job_offer/rejection/voicemail/wrong_number/no_answer/other",
  
  "call_outcome": "interested_proceeding/interested_pending_documents/callback_requested/not_interested/not_suitable/no_contact/voicemail_left/other",
  
  "extraction_confidence": "high/medium/low - based on audio quality and how much information was actually discussed"
}

Be thorough but factual - only include information actually mentioned in the call. Use null for fields where information wasn't discussed. Your analysis should be immediately useful to another recruiter picking up this candidate.`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 3000,
      messages: [{ role: 'user', content: prompt }]
    });
    
    const text = response.content[0].text;
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const analysis = JSON.parse(jsonMatch[0]);
      console.log('   ✅ Analysis complete');
      console.log(`   📊 Quality: ${analysis.quality_assessment?.rating || 'N/A'} | Energy: ${analysis.energy_score || 'N/A'}/10`);
      return analysis;
    }
  } catch (err) {
    console.error('   ❌ Claude error:', err.message);
  }
  
  return null;
}

// Find or create candidate
async function findOrCreateCandidate(analysis) {
  const phone = analysis.phone_e164;
  
  if (phone) {
    // Check if candidate exists - use phone_e164 not phone
    const { data: existing } = await supabase
      .from('candidates')
      .select('id, name')
      .eq('phone_e164', phone)
      .single();
    
    if (existing) {
      console.log(`   📋 Found existing candidate: ${existing.name} (${existing.id})`);
      return existing.id;
    }
  }
  
  // Build comprehensive notes for experience_summary
  const experienceSummary = analysis.experience_summary || '';
  const notesText = buildCandidateNotes(analysis);
  
  if (DRY_RUN) {
    console.log('   [DRY RUN] Would create candidate:', analysis.candidate_name || 'Unknown');
    return 'dry-run-id';
  }
  
  // Create candidate using actual column names from schema
  // Claude should now return proper YYYY-MM-DD dates
  const candidateData = {
    name: analysis.candidate_name || 'Unknown Candidate',
    phone_e164: phone,  // Correct column name
    status: 'new',
    source: 'call_recording',
    stage: 'new',
    roles: analysis.roles || [],
    driver: analysis.compliance?.driving?.has_license ? 'Yes' : (analysis.compliance?.driving?.has_license === false ? 'No' : 'Unknown'),
    dbs_update_service: analysis.compliance?.dbs_on_update_service ? 'Yes' : 'Unknown',
    mandatory_training: analysis.mandatory_training?.completed?.join(', ') || 'Unknown',
    earliest_start_date: analysis.availability?.earliest_start_date || null,
    weekly_rota: analysis.availability?.hours_wanted || null,
    experience_summary: experienceSummary,
    summary: notesText,  // Put detailed notes in summary field
    energy_count: analysis.energy_score || 0,
    total_calls_scored: 1,
    is_called: true
  };
  
  const { data: newCandidate, error } = await supabase
    .from('candidates')
    .insert([candidateData])
    .select('id')
    .single();
  
  if (error) {
    console.error('   ❌ Error creating candidate:', error.message);
    
    // Try minimal insert
    const minimalData = {
      name: analysis.candidate_name || 'Unknown Candidate',
      phone_e164: phone,
      status: 'new',
      source: 'call_recording'
    };
    
    const { data: minCandidate, error: minError } = await supabase
      .from('candidates')
      .insert([minimalData])
      .select('id')
      .single();
    
    if (minCandidate) {
      console.log(`   ✅ Created candidate (minimal): ${minimalData.name} (${minCandidate.id})`);
      return minCandidate.id;
    }
    
    // Check if it's a duplicate
    if (error?.message?.includes('duplicate') || error?.code === '23505') {
      const { data: existing } = await supabase
        .from('candidates')
        .select('id, name')
        .eq('phone_e164', phone)
        .single();
      if (existing) {
        console.log(`   📋 Found existing candidate: ${existing.name} (${existing.id})`);
        return existing.id;
      }
    }
    
    console.error('   ❌ Minimal insert also failed:', minError?.message);
    return null;
  }
  
  console.log(`   ✅ Created new candidate: ${candidateData.name} (${newCandidate.id})`);
  return newCandidate.id;
}

// Helper function to build detailed notes
function buildCandidateNotes(analysis) {
  const notes = [];
  notes.push(`📞 IMPORTED FROM CALL RECORDING`);
  notes.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  notes.push(`\n📝 CALL SUMMARY:\n${analysis.call_summary || 'N/A'}`);
  notes.push(`\n💼 EXPERIENCE:\n${analysis.experience_summary || 'N/A'}`);
  
  if (analysis.specialisms?.length > 0) {
    notes.push(`\n🎯 SPECIALISMS: ${analysis.specialisms.join(', ')}`);
  }
  
  if (analysis.qualifications) {
    notes.push(`\n📜 QUALIFICATIONS:`);
    if (analysis.qualifications.care_certificate) notes.push(`   • Care Certificate: ✅`);
    if (analysis.qualifications.nvq_level) notes.push(`   • NVQ Level: ${analysis.qualifications.nvq_level}`);
    if (analysis.qualifications.other_qualifications?.length > 0) {
      notes.push(`   • Other: ${analysis.qualifications.other_qualifications.join(', ')}`);
    }
  }
  
  if (analysis.compliance) {
    notes.push(`\n✅ COMPLIANCE:`);
    notes.push(`   • DBS: ${analysis.compliance.dbs_status || 'Unknown'}`);
    if (analysis.compliance.dbs_on_update_service) notes.push(`   • DBS Update Service: ✅`);
    notes.push(`   • Right to Work: ${analysis.compliance.right_to_work || 'Unknown'}`);
    if (analysis.compliance.driving) {
      const d = analysis.compliance.driving;
      notes.push(`   • Driving: ${d.has_license ? '✅ License' : '❌ No license'}${d.has_car ? ', ✅ Own car' : ''}${d.business_insurance ? ', ✅ Business insurance' : ''}`);
    }
  }
  
  if (analysis.availability) {
    notes.push(`\n📅 AVAILABILITY:`);
    if (analysis.availability.earliest_start_date) notes.push(`   • Start: ${analysis.availability.earliest_start_date}`);
    if (analysis.availability.hours_wanted) notes.push(`   • Hours: ${analysis.availability.hours_wanted}`);
    if (analysis.availability.shift_patterns?.length > 0) notes.push(`   • Shifts: ${analysis.availability.shift_patterns.join(', ')}`);
    if (analysis.availability.travel_radius) notes.push(`   • Travel: ${analysis.availability.travel_radius}`);
  }
  
  if (analysis.red_flags?.length > 0) {
    notes.push(`\n🚩 RED FLAGS:\n${analysis.red_flags.map(f => `   • ${f}`).join('\n')}`);
  }
  
  if (analysis.green_flags?.length > 0) {
    notes.push(`\n✅ GREEN FLAGS:\n${analysis.green_flags.map(f => `   • ${f}`).join('\n')}`);
  }
  
  notes.push(`\n📊 ASSESSMENT:`);
  notes.push(`   • Quality: ${analysis.quality_assessment?.rating || 'N/A'} - ${analysis.quality_assessment?.reasoning || ''}`);
  notes.push(`   • Energy: ${analysis.energy_score || 'N/A'}/10 - ${analysis.energy_notes || ''}`);
  
  if (analysis.recruiter_notes) {
    notes.push(`\n💡 RECRUITER NOTES:\n${analysis.recruiter_notes}`);
  }
  
  if (analysis.follow_up_actions?.length > 0) {
    notes.push(`\n📋 FOLLOW-UP ACTIONS:\n${analysis.follow_up_actions.map(a => `   ☐ ${a}`).join('\n')}`);
  }
  
  if (analysis.email) {
    notes.push(`\n📧 EMAIL: ${analysis.email}`);
  }
  
  return notes.join('\n');
}

// Save to call_history with full analysis
async function saveCallHistory(candidateId, phoneNumber, transcript, analysis, filename) {
  // Use exact column names from schema
  const record = {
    candidate_id: candidateId,
    phone_e164: phoneNumber,
    call_id: `recording_${Date.now()}_${filename.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 30)}`,
    call_time: new Date().toISOString(),
    direction: 'inbound',
    
    // Basic info
    candidate_name: analysis.candidate_name,
    experience_summary: analysis.experience_summary,
    call_summary: analysis.call_summary,
    
    // Roles & compliance
    roles: analysis.roles || [],
    driver: analysis.compliance?.driving?.has_license ? 'Yes' : 'Unknown',
    dbs_status: analysis.compliance?.dbs_status || 'Unknown',
    mandatory_training: analysis.mandatory_training?.completed?.join(', ') || 'Unknown',
    
    // Availability - Claude should now return proper YYYY-MM-DD dates
    earliest_start_date: analysis.availability?.earliest_start_date || null,
    weekly_rota: analysis.availability?.hours_wanted || null,
    
    // Assessment
    energy_score: analysis.energy_score || null,
    quality_assessment: analysis.quality_assessment?.rating || null,
    
    // Actions
    follow_up_questions: analysis.follow_up_actions || [],
    
    // Call metadata  
    call_type: analysis.call_type?.toUpperCase()?.replace(/_/g, '_') || 'SCREENING',
    extraction_confidence: analysis.extraction_confidence === 'high' ? 90 : (analysis.extraction_confidence === 'medium' ? 60 : 30),
    
    // Transcript
    transcript: transcript
  };
  
  if (DRY_RUN) {
    console.log('   [DRY RUN] Would save call history');
    console.log('   Preview:', JSON.stringify(analysis.call_summary).slice(0, 100));
    return true;
  }
  
  const { error } = await supabase.from('call_history').insert([record]);
  
  if (error) {
    console.error('   ❌ Error saving call history:', error.message);
    
    // Try with minimal fields matching the schema exactly
    const minimalRecord = {
      candidate_id: candidateId,
      phone_e164: phoneNumber,
      call_id: record.call_id,
      call_time: record.call_time,
      direction: 'inbound',
      candidate_name: analysis.candidate_name,
      call_summary: typeof analysis.call_summary === 'string' ? analysis.call_summary : JSON.stringify(analysis.call_summary),
      transcript: transcript,
      energy_score: analysis.energy_score || null
    };
    
    const { error: retryError } = await supabase.from('call_history').insert([minimalRecord]);
    if (!retryError) {
      console.log('   💾 Saved to call_history (minimal fields)');
      return true;
    }
    console.error('   ❌ Retry also failed:', retryError.message);
    return false;
  }
  
  console.log('   💾 Saved to call_history');
  return true;
}

// Process a single recording
async function processRecording(filename) {
  const filePath = path.join(RECORDINGS_FOLDER, filename);
  
  console.log(`\n📞 Processing: ${filename}`);
  
  // Extract phone number from filename
  const phoneNumber = extractPhoneFromFilename(filename);
  if (phoneNumber) {
    console.log(`   📱 Phone: ${phoneNumber}`);
  } else {
    console.log('   ⚠️ No phone number in filename');
  }
  
  // Get file size
  const stats = fs.statSync(filePath);
  const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
  const estimatedMinutes = (stats.size / (1024 * 1024) * 8).toFixed(1); // Rough estimate
  console.log(`   📁 Size: ${sizeMB} MB (~${estimatedMinutes} min audio)`);
  
  if (DRY_RUN) {
    console.log('   [DRY RUN] Would process this file');
    return true;
  }
  
  // Transcribe
  const transcript = await transcribeWithWhisper(filePath);
  if (!transcript) {
    console.log('   ❌ Failed to transcribe, skipping');
    return false;
  }
  
  // Preview transcript
  console.log(`   📜 Transcript preview: "${transcript.slice(0, 100).replace(/\n/g, ' ')}..."`);
  
  // Analyze
  const analysis = await analyzeWithClaude(transcript, phoneNumber);
  if (!analysis) {
    console.log('   ❌ Failed to analyze, skipping');
    return false;
  }
  
  // Show key findings
  console.log(`   👤 Candidate: ${analysis.candidate_name || 'Unknown'}`);
  console.log(`   📋 Type: ${analysis.call_type} | Outcome: ${analysis.call_outcome}`);
  
  // Find or create candidate
  const candidateId = await findOrCreateCandidate(analysis);
  
  // Save call history
  await saveCallHistory(candidateId, phoneNumber, transcript, analysis, filename);
  
  // Move to processed folder
  const processedPath = path.join(PROCESSED_FOLDER, filename);
  fs.renameSync(filePath, processedPath);
  console.log('   📦 Moved to processed folder');
  
  return true;
}

// Main function
async function main() {
  console.log('\n🎙️ Dialpad Recording Processor');
  console.log('================================');
  console.log('Expert Healthcare Recruiter AI Analysis\n');
  
  // Get list of MP3 files
  const files = fs.readdirSync(RECORDINGS_FOLDER)
    .filter(f => f.toLowerCase().endsWith('.mp3') && !fs.statSync(path.join(RECORDINGS_FOLDER, f)).isDirectory());
  
  if (files.length === 0) {
    console.log('❌ No MP3 files found in recordings folder');
    console.log(`\nPlease download recordings from Dialpad and place them in:\n${RECORDINGS_FOLDER}`);
    console.log('\nNaming tip: Include the phone number in the filename');
    console.log('Example: +447778180510.mp3 or 447778180510_call1.mp3');
    return;
  }
  
  // Calculate total size and estimate costs
  let totalSize = 0;
  for (const file of files) {
    totalSize += fs.statSync(path.join(RECORDINGS_FOLDER, file)).size;
  }
  const totalMB = (totalSize / (1024 * 1024)).toFixed(1);
  const estimatedMinutes = Math.round(totalSize / (1024 * 1024) * 8);
  const estimatedCost = (estimatedMinutes * 0.006).toFixed(2);
  
  console.log(`Found ${files.length} recording(s) to process`);
  console.log(`Total size: ${totalMB} MB (~${estimatedMinutes} minutes of audio)`);
  console.log(`Estimated Whisper cost: $${estimatedCost}`);
  console.log(`Estimated Claude cost: ~$${(files.length * 0.01).toFixed(2)}`);
  console.log('');
  
  if (DRY_RUN) {
    console.log('Files that would be processed:');
    files.forEach(f => console.log(`  - ${f}`));
    console.log('\nRun without --dry-run to process these files.');
    return;
  }
  
  let processed = 0;
  let failed = 0;
  
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    console.log(`\n[${i + 1}/${files.length}] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    
    try {
      const success = await processRecording(file);
      if (success) processed++;
      else failed++;
    } catch (err) {
      console.error(`   ❌ Error: ${err.message}`);
      failed++;
    }
    
    // Small delay between files to avoid rate limits
    if (i < files.length - 1) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 PROCESSING COMPLETE');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`✅ Processed: ${processed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  console.log('Next steps:');
  console.log('1. Check candidates in your app: https://care-ats.vercel.app');
  console.log('2. Review call_history in Supabase for detailed analysis');
  console.log('3. Processed recordings moved to: recordings/processed/');
}

main().catch(console.error);
