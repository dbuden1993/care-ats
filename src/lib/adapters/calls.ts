// src/lib/adapters/calls.ts
/**
 * Data adapter for calls table
 * Normalizes database rows into consistent shape for UI
 */

export type CallRow = {
  id: string;
  org_id: string;
  call_id: string;
  candidate_id: string | null;
  candidate_phone_e164: string;
  call_time: string | null;
  direction: string | null;
  duration_ms: number | null;
  transcript: string | null;
  recording_url: string | null;
  ai_recap: string | null;
  extracted_json: any;
  energy_score: number | null;
  created_at: string;
  processed_at?: string | null;
  processed_by?: string | null;
};

export type NormalizedCall = {
  id: string;
  orgId: string;
  callId: string;
  candidateId: string | null;
  phone: string;
  callTime: Date | null;
  direction: 'inbound' | 'outbound' | null;
  durationMs: number | null;
  durationFormatted: string;
  transcript: string | null;
  recordingUrl: string | null;
  recapBullets: string[];
  qualityAssessment: string | null;
  followUpQuestions: string[];
  energyScore: number | null;
  energyBadgeColor: string;
  isProcessed: boolean;
  processedAt: Date | null;
  processedBy: string | null;
};

/**
 * Parse AI recap into bullet points
 */
function parseRecapBullets(recap: string | null): string[] {
  if (!recap) return [];
  
  // Split by newlines and filter lines that start with - or • or numbered
  const lines = recap.split('\n')
    .map(line => line.trim())
    .filter(line => {
      return line.startsWith('-') || 
             line.startsWith('•') || 
             line.startsWith('*') ||
             /^\d+\./.test(line);
    })
    .map(line => {
      // Remove leading dash/bullet/number
      return line.replace(/^[-•*]\s*/, '').replace(/^\d+\.\s*/, '');
    })
    .filter(Boolean);
  
  return lines.length > 0 ? lines : [recap];
}

/**
 * Extract quality assessment from extracted_json
 */
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

/**
 * Extract follow-up questions from extracted_json
 */
function extractFollowUpQuestions(extractedJson: any): string[] {
  if (!extractedJson) return [];
  
  const questions = extractedJson.follow_up_questions;
  if (!questions) return [];
  
  if (typeof questions === 'string') {
    // Parse as bullets or newlines
    return questions.split('\n')
      .map(q => q.trim())
      .filter(Boolean);
  }
  
  if (Array.isArray(questions)) {
    return questions.filter(q => typeof q === 'string');
  }
  
  return [];
}

/**
 * Format duration from milliseconds
 */
function formatDuration(ms: number | null): string {
  if (!ms || ms <= 0) return '0s';
  
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  
  if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`;
  }
  
  return `${seconds}s`;
}

/**
 * Get energy score badge color
 */
function getEnergyBadgeColor(score: number | null): string {
  if (!score) return 'gray';
  if (score >= 4) return 'green';
  if (score >= 3) return 'yellow';
  return 'red';
}

/**
 * Normalize a call row from database
 */
export function normalizeCall(row: CallRow): NormalizedCall {
  return {
    id: row.id,
    orgId: row.org_id,
    callId: row.call_id,
    candidateId: row.candidate_id,
    phone: row.candidate_phone_e164,
    callTime: row.call_time ? new Date(row.call_time) : null,
    direction: (row.direction?.toLowerCase() === 'inbound' || row.direction?.toLowerCase() === 'outbound') 
      ? row.direction.toLowerCase() as 'inbound' | 'outbound' 
      : null,
    durationMs: row.duration_ms,
    durationFormatted: formatDuration(row.duration_ms),
    transcript: row.transcript,
    recordingUrl: row.recording_url,
    recapBullets: parseRecapBullets(row.ai_recap),
    qualityAssessment: extractQuality(row.extracted_json),
    followUpQuestions: extractFollowUpQuestions(row.extracted_json),
    energyScore: row.energy_score,
    energyBadgeColor: getEnergyBadgeColor(row.energy_score),
    isProcessed: !!row.processed_at,
    processedAt: row.processed_at ? new Date(row.processed_at) : null,
    processedBy: row.processed_by || null,
  };
}

/**
 * Normalize multiple calls
 */
export function normalizeCalls(rows: CallRow[]): NormalizedCall[] {
  return rows.map(normalizeCall);
}
