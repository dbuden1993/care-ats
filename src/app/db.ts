// Database helper functions
import { createBrowserClient } from '@supabase/ssr';

const getSupabase = () => createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// ============ JOBS ============
export async function getJobs() {
  const { data, error } = await getSupabase()
    .from('jobs')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function createJob(job: any) {
  const { data, error } = await getSupabase()
    .from('jobs')
    .insert([{ ...job, created_at: new Date().toISOString() }])
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateJob(id: string, updates: any) {
  const { data, error } = await getSupabase()
    .from('jobs')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteJob(id: string) {
  const { error } = await getSupabase().from('jobs').delete().eq('id', id);
  if (error) throw error;
}

// ============ CANDIDATES ============
export async function updateCandidate(id: string, updates: any) {
  const { data, error } = await getSupabase()
    .from('candidates')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateCandidateStatus(id: string, status: string) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('candidates')
    .update({ status })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  
  // Log activity
  await supabase.from('activity_log').insert([{
    candidate_id: id,
    type: 'status_change',
    description: `Status changed to ${status}`,
    metadata: { new_status: status }
  }]);
  
  return data;
}

export async function assignCandidateToJob(candidateId: string, jobId: string | null) {
  const { data, error } = await getSupabase()
    .from('candidates')
    .update({ job_id: jobId })
    .eq('id', candidateId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteCandidate(id: string) {
  const supabase = getSupabase();
  
  // Delete related records first (in order of dependencies)
  await supabase.from('notes').delete().eq('candidate_id', id);
  await supabase.from('activity_log').delete().eq('candidate_id', id);
  await supabase.from('interviews').delete().eq('candidate_id', id);
  await supabase.from('documents').delete().eq('candidate_id', id);
  await supabase.from('scorecards').delete().eq('candidate_id', id);
  
  // Delete the candidate
  const { error } = await supabase.from('candidates').delete().eq('id', id);
  if (error) throw error;
}

export async function deleteCandidates(ids: string[]) {
  const supabase = getSupabase();
  
  // Delete related records first
  for (const id of ids) {
    await supabase.from('notes').delete().eq('candidate_id', id);
    await supabase.from('activity_log').delete().eq('candidate_id', id);
    await supabase.from('interviews').delete().eq('candidate_id', id);
    await supabase.from('documents').delete().eq('candidate_id', id);
    await supabase.from('scorecards').delete().eq('candidate_id', id);
  }
  
  // Delete the candidates
  const { error } = await supabase.from('candidates').delete().in('id', ids);
  if (error) throw error;
}

// ============ INTERVIEWS ============
export async function getInterviews(filters?: { candidate_id?: string; from?: string; to?: string }) {
  let query = getSupabase().from('interviews').select('*');
  
  if (filters?.candidate_id) query = query.eq('candidate_id', filters.candidate_id);
  if (filters?.from) query = query.gte('scheduled_at', filters.from);
  if (filters?.to) query = query.lte('scheduled_at', filters.to);
  
  const { data, error } = await query.order('scheduled_at', { ascending: true });
  if (error) throw error;
  return data;
}

export async function createInterview(interview: any) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('interviews')
    .insert([interview])
    .select()
    .single();
  if (error) throw error;
  
  // Log activity
  await supabase.from('activity_log').insert([{
    candidate_id: interview.candidate_id,
    type: 'interview_scheduled',
    description: `Interview scheduled for ${new Date(interview.scheduled_at).toLocaleDateString()}`,
    metadata: { interview_id: data.id, type: interview.type }
  }]);
  
  return data;
}

export async function updateInterview(id: string, updates: any) {
  const { data, error } = await getSupabase()
    .from('interviews')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteInterview(id: string) {
  const { error } = await getSupabase().from('interviews').delete().eq('id', id);
  if (error) throw error;
}

// ============ NOTES ============
export async function getNotes(candidateId: string) {
  const { data, error } = await getSupabase()
    .from('notes')
    .select('*')
    .eq('candidate_id', candidateId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function createNote(note: { candidate_id: string; author_name: string; content: string; is_private?: boolean }) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('notes')
    .insert([note])
    .select()
    .single();
  if (error) throw error;
  
  // Log activity
  await supabase.from('activity_log').insert([{
    candidate_id: note.candidate_id,
    type: 'note_added',
    description: 'Note added',
    created_by: note.author_name
  }]);
  
  return data;
}

export async function deleteNote(id: string) {
  const { error } = await getSupabase().from('notes').delete().eq('id', id);
  if (error) throw error;
}

// ============ DOCUMENTS ============
export async function getDocuments(candidateId: string) {
  const { data, error } = await getSupabase()
    .from('documents')
    .select('*')
    .eq('candidate_id', candidateId)
    .order('uploaded_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function uploadDocument(candidateId: string, file: File, type: string = 'other') {
  const supabase = getSupabase();
  const fileName = `${candidateId}/${Date.now()}_${file.name}`;
  
  // Upload to storage
  const { error: uploadError } = await supabase.storage
    .from('documents')
    .upload(fileName, file);
  if (uploadError) throw uploadError;
  
  // Get public URL
  const { data: { publicUrl } } = supabase.storage.from('documents').getPublicUrl(fileName);
  
  // Create record
  const { data, error } = await supabase
    .from('documents')
    .insert([{ candidate_id: candidateId, name: file.name, type, url: publicUrl, size_bytes: file.size }])
    .select()
    .single();
  if (error) throw error;
  
  return data;
}

export async function deleteDocument(id: string) {
  const { error } = await getSupabase().from('documents').delete().eq('id', id);
  if (error) throw error;
}

// ============ SCORECARDS ============
export async function getScorecards(candidateId: string) {
  const { data, error } = await getSupabase()
    .from('scorecards')
    .select('*')
    .eq('candidate_id', candidateId)
    .order('submitted_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function createScorecard(scorecard: any) {
  const { data, error } = await getSupabase()
    .from('scorecards')
    .insert([scorecard])
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ============ ACTIVITY LOG ============
export async function getActivity(candidateId: string, limit: number = 50) {
  const { data, error } = await getSupabase()
    .from('activity_log')
    .select('*')
    .eq('candidate_id', candidateId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}

export async function logActivity(candidateId: string, type: string, description: string, metadata?: any, createdBy?: string) {
  const { error } = await getSupabase()
    .from('activity_log')
    .insert([{ candidate_id: candidateId, type, description, metadata, created_by: createdBy }]);
  if (error) throw error;
}
