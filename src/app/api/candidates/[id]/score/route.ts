import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

interface CandidateData {
  id: string;
  name: string | null;
  phone_e164: string;
  status: string;
  roles: string | null;
  experience_summary: string | null;
  driver: string | null;
  dbs_update_service: string | null;
  mandatory_training: string | null;
  created_at: string;
}

interface CallData {
  energy_score: number | null;
  quality_assessment: string | null;
  call_summary: string | null;
  call_time: string;
}

interface SMSData {
  ai_intent: string | null;
  ai_sentiment: string | null;
  ai_summary: string | null;
  created_at: string;
  direction: string;
}

interface CandidateScore {
  overall_score: number; // 0-100
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  
  // Component scores
  engagement_score: number; // Response speed, interaction count
  interest_score: number; // SMS sentiment, stated interest
  quality_score: number; // Call energy, qualifications
  availability_score: number; // Response patterns, stated availability
  
  // Insights
  strengths: string[];
  concerns: string[];
  recommended_action: string;
  ai_summary: string;
  
  // Raw data
  call_count: number;
  sms_count: number;
  avg_response_time_minutes: number | null;
  last_interaction: string | null;
}

async function calculateCandidateScore(
  candidate: CandidateData,
  calls: CallData[],
  smsMessages: SMSData[]
): Promise<CandidateScore> {
  
  // Calculate component scores
  
  // 1. Engagement Score (0-25)
  let engagementScore = 0;
  const inboundSms = smsMessages.filter(s => s.direction === 'inbound');
  
  if (inboundSms.length > 0) {
    engagementScore += Math.min(15, inboundSms.length * 5); // Up to 15 for response count
    
    // Response speed bonus
    const outboundSms = smsMessages.filter(s => s.direction === 'outbound');
    if (outboundSms.length > 0 && inboundSms.length > 0) {
      const firstOutbound = new Date(outboundSms[outboundSms.length - 1].created_at).getTime();
      const firstInbound = new Date(inboundSms[inboundSms.length - 1].created_at).getTime();
      const responseTimeMinutes = (firstInbound - firstOutbound) / 1000 / 60;
      
      if (responseTimeMinutes < 30) engagementScore += 10;
      else if (responseTimeMinutes < 60) engagementScore += 7;
      else if (responseTimeMinutes < 180) engagementScore += 4;
    }
  }
  
  if (calls.length > 0) {
    engagementScore += Math.min(5, calls.length * 2); // Bonus for call engagement
  }
  
  // 2. Interest Score (0-25)
  let interestScore = 0;
  
  const latestInbound = inboundSms[0];
  if (latestInbound) {
    switch (latestInbound.ai_intent) {
      case 'interested': interestScore += 20; break;
      case 'callback_request': interestScore += 25; break;
      case 'question': interestScore += 15; break;
      case 'not_interested': interestScore -= 10; break;
      case 'stop_request': interestScore -= 20; break;
    }
    
    switch (latestInbound.ai_sentiment) {
      case 'positive': interestScore += 5; break;
      case 'negative': interestScore -= 5; break;
    }
  }
  
  // 3. Quality Score (0-25)
  let qualityScore = 0;
  
  // From calls
  if (calls.length > 0) {
    const avgEnergy = calls.reduce((sum, c) => sum + (c.energy_score || 0), 0) / calls.length;
    qualityScore += Math.round(avgEnergy * 1.5); // Up to 15 points
    
    const gradeACount = calls.filter(c => c.quality_assessment === 'A' || c.quality_assessment === 'HIGH').length;
    qualityScore += gradeACount * 5; // 5 points per A grade
  }
  
  // From qualifications
  if (candidate.driver === 'Yes') qualityScore += 2;
  if (candidate.dbs_update_service === 'Yes') qualityScore += 2;
  if (candidate.mandatory_training === 'Yes') qualityScore += 2;
  
  // 4. Availability Score (0-25)
  let availabilityScore = 15; // Base score
  
  // Recent activity bonus
  const lastInteraction = [...smsMessages, ...calls.map(c => ({ created_at: c.call_time }))]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
  
  if (lastInteraction) {
    const daysSince = (Date.now() - new Date(lastInteraction.created_at).getTime()) / 1000 / 60 / 60 / 24;
    if (daysSince < 1) availabilityScore += 10;
    else if (daysSince < 3) availabilityScore += 7;
    else if (daysSince < 7) availabilityScore += 3;
    else if (daysSince > 30) availabilityScore -= 10;
  }
  
  // Calculate overall score
  const overallScore = Math.max(0, Math.min(100, engagementScore + interestScore + qualityScore + availabilityScore));
  
  // Determine grade
  let grade: 'A' | 'B' | 'C' | 'D' | 'F';
  if (overallScore >= 80) grade = 'A';
  else if (overallScore >= 65) grade = 'B';
  else if (overallScore >= 50) grade = 'C';
  else if (overallScore >= 35) grade = 'D';
  else grade = 'F';
  
  // Generate insights
  const strengths: string[] = [];
  const concerns: string[] = [];
  
  if (engagementScore >= 20) strengths.push('Highly responsive');
  if (interestScore >= 20) strengths.push('Strong interest shown');
  if (qualityScore >= 20) strengths.push('High quality candidate');
  if (calls.some(c => (c.energy_score || 0) >= 8)) strengths.push('High energy on calls');
  if (candidate.driver === 'Yes') strengths.push('Has driving license');
  if (candidate.dbs_update_service === 'Yes') strengths.push('DBS on update service');
  
  if (engagementScore < 10) concerns.push('Low engagement');
  if (interestScore < 0) concerns.push('Expressed disinterest');
  if (inboundSms.length === 0 && smsMessages.length > 0) concerns.push('No response to messages');
  if (calls.some(c => (c.energy_score || 0) <= 3)) concerns.push('Low energy on previous calls');
  
  // Recommended action
  let recommendedAction = 'Monitor';
  if (grade === 'A' || latestInbound?.ai_intent === 'callback_request') {
    recommendedAction = 'Call immediately';
  } else if (grade === 'B') {
    recommendedAction = 'Schedule call today';
  } else if (grade === 'C') {
    recommendedAction = 'Send follow-up SMS';
  } else if (grade === 'D') {
    recommendedAction = 'Low priority - nurture';
  } else {
    recommendedAction = 'Consider removing from active pipeline';
  }
  
  // Calculate avg response time
  let avgResponseTime: number | null = null;
  if (inboundSms.length > 0) {
    const outboundTimes = smsMessages.filter(s => s.direction === 'outbound').map(s => new Date(s.created_at).getTime());
    const responseTimes: number[] = [];
    
    inboundSms.forEach(inbound => {
      const inboundTime = new Date(inbound.created_at).getTime();
      const precedingOutbound = outboundTimes.filter(t => t < inboundTime).sort((a, b) => b - a)[0];
      if (precedingOutbound) {
        responseTimes.push((inboundTime - precedingOutbound) / 1000 / 60);
      }
    });
    
    if (responseTimes.length > 0) {
      avgResponseTime = Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length);
    }
  }
  
  return {
    overall_score: overallScore,
    grade,
    engagement_score: Math.min(25, engagementScore),
    interest_score: Math.max(0, Math.min(25, interestScore)),
    quality_score: Math.min(25, qualityScore),
    availability_score: Math.min(25, availabilityScore),
    strengths,
    concerns,
    recommended_action: recommendedAction,
    ai_summary: `${grade}-grade candidate with ${overallScore}% match score. ${strengths[0] || 'Standard profile'}. ${recommendedAction}.`,
    call_count: calls.length,
    sms_count: smsMessages.length,
    avg_response_time_minutes: avgResponseTime,
    last_interaction: lastInteraction?.created_at || null
  };
}

// POST - Calculate score for a single candidate
export async function POST(request: NextRequest) {
  try {
    const { candidateId } = await request.json();

    // Get candidate
    const { data: candidate, error: candidateError } = await supabase
      .from('candidates')
      .select('*')
      .eq('id', candidateId)
      .single();

    if (candidateError || !candidate) {
      return NextResponse.json({ error: 'Candidate not found' }, { status: 404 });
    }

    // Get calls
    const { data: calls } = await supabase
      .from('call_history')
      .select('energy_score, quality_assessment, call_summary, call_time')
      .eq('phone_e164', candidate.phone_e164)
      .order('call_time', { ascending: false });

    // Get SMS
    const { data: smsMessages } = await supabase
      .from('sms_messages')
      .select('ai_intent, ai_sentiment, ai_summary, created_at, direction')
      .eq('phone_e164', candidate.phone_e164)
      .order('created_at', { ascending: false });

    const score = await calculateCandidateScore(
      candidate,
      calls || [],
      smsMessages || []
    );

    // Update candidate with score
    await supabase
      .from('candidates')
      .update({
        ai_score: score.overall_score,
        ai_grade: score.grade,
        ai_summary: score.ai_summary,
        updated_at: new Date().toISOString()
      })
      .eq('id', candidateId);

    return NextResponse.json({ success: true, score });

  } catch (error) {
    console.error('Scoring error:', error);
    return NextResponse.json({ error: 'Scoring failed' }, { status: 500 });
  }
}

// GET - Bulk score all candidates or get scores
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');

  if (action === 'bulk-score') {
    // Score all candidates with recent activity
    const { data: candidates } = await supabase
      .from('candidates')
      .select('id, phone_e164')
      .not('phone_e164', 'is', null);

    const scores: any[] = [];
    
    for (const candidate of candidates || []) {
      const { data: calls } = await supabase
        .from('call_history')
        .select('energy_score, quality_assessment, call_summary, call_time')
        .eq('phone_e164', candidate.phone_e164);

      const { data: smsMessages } = await supabase
        .from('sms_messages')
        .select('ai_intent, ai_sentiment, ai_summary, created_at, direction')
        .eq('phone_e164', candidate.phone_e164);

      if ((calls?.length || 0) > 0 || (smsMessages?.length || 0) > 0) {
        const { data: fullCandidate } = await supabase
          .from('candidates')
          .select('*')
          .eq('id', candidate.id)
          .single();

        if (fullCandidate) {
          const score = await calculateCandidateScore(fullCandidate, calls || [], smsMessages || []);
          scores.push({ candidateId: candidate.id, ...score });

          // Update in database
          await supabase
            .from('candidates')
            .update({
              ai_score: score.overall_score,
              ai_grade: score.grade,
              ai_summary: score.ai_summary
            })
            .eq('id', candidate.id);
        }
      }
    }

    return NextResponse.json({ success: true, scored: scores.length, scores });
  }

  // Default: return top scored candidates
  const { data: topCandidates } = await supabase
    .from('candidates')
    .select('id, name, phone_e164, ai_score, ai_grade, ai_summary, status')
    .not('ai_score', 'is', null)
    .order('ai_score', { ascending: false })
    .limit(50);

  return NextResponse.json({ candidates: topCandidates });
}
