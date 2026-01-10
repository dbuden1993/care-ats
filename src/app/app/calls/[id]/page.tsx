// src/app/app/calls/[id]/page.tsx
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import CallDetailClient from './CallDetailClient';

export const metadata = {
  title: 'Call Detail',
};

type Props = {
  params: Promise<{ id: string }>; // Next.js 15: params is a Promise
};

// Helper to parse recap into bullets
function parseRecapBullets(recap: string | null): string[] {
  if (!recap) return [];
  
  const lines = recap.split('\n')
    .map(line => line.trim())
    .filter(line => {
      return line.startsWith('-') || 
             line.startsWith('•') || 
             line.startsWith('*') ||
             /^\d+\./.test(line);
    })
    .map(line => {
      return line.replace(/^[-•*]\s*/, '').replace(/^\d+\.\s*/, '');
    })
    .filter(Boolean);
  
  return lines.length > 0 ? lines : [recap];
}

// Helper to extract quality
function extractQuality(extractedJson: any): string | null {
  if (!extractedJson) return null;
  const quality = extractedJson.quality_assessment;
  if (!quality) return null;
  if (typeof quality === 'string') {
    const upper = quality.toUpperCase();
    if (upper.includes('HIGH')) return 'HIGH';
    if (upper.includes('MEDIUM')) return 'MEDIUM';
    if (upper.includes('LOW')) return 'LOW';
    return quality;
  }
  return null;
}

// Helper to extract follow-up questions
function extractFollowUpQuestions(extractedJson: any): string[] {
  if (!extractedJson) return [];
  const questions = extractedJson.follow_up_questions;
  if (!questions) return [];
  if (typeof questions === 'string') {
    return questions.split('\n').map(q => q.trim()).filter(Boolean);
  }
  if (Array.isArray(questions)) {
    return questions.filter(q => typeof q === 'string');
  }
  return [];
}

export default async function CallDetailPage({ params }: Props) {
  // Next.js 15: await params
  const { id } = await params;
  
  const supabase = await createServerSupabaseClient();
  
  // Check auth
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  
  // Get call
  const { data: call, error } = await supabase
    .from('calls')
    .select('*')
    .eq('id', id)
    .single();
  
  if (error || !call) {
    notFound();
  }
  
  // Get candidate if linked
  let candidate = null;
  if (call.candidate_id) {
    const { data } = await supabase
      .from('candidates')
      .select('id, name, phone_e164, status, roles')
      .eq('id', call.candidate_id)
      .single();
    
    candidate = data;
  }
  
  // Normalize call data inline
  const normalizedCall = {
    id: call.id,
    callId: call.call_id,
    candidateId: call.candidate_id,
    phone: call.candidate_phone_e164,
    callTime: call.call_time ? new Date(call.call_time) : null,
    direction: call.direction?.toLowerCase() as 'inbound' | 'outbound' | null,
    durationMs: call.duration_ms,
    transcript: call.transcript,
    recordingUrl: call.recording_url,
    recapBullets: parseRecapBullets(call.ai_recap),
    qualityAssessment: extractQuality(call.extracted_json),
    followUpQuestions: extractFollowUpQuestions(call.extracted_json),
    energyScore: call.energy_score,
    isProcessed: !!call.processed_at,
    processedAt: call.processed_at,
  };
  
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-8">
        <CallDetailClient call={normalizedCall} candidate={candidate} />
      </div>
    </div>
  );
}
