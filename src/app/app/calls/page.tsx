// src/app/app/calls/page.tsx
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import CallsListClient from './CallsListClient';

export const metadata = {
  title: 'Calls Inbox',
};

export default async function CallsPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const supabase = await createServerSupabaseClient();
  
  // Check auth
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  
  // Get org_id from organizations table (get first org for now)
  const { data: orgs } = await supabase
    .from('organizations')
    .select('id')
    .limit(1);
  
  if (!orgs || orgs.length === 0) {
    return <div className="p-8">No organization found. Please contact support.</div>;
  }
  
  const orgId = orgs[0].id;
  
  // Parse filters from URL
  const direction = searchParams.direction as string | undefined;
  const quality = searchParams.quality as string | undefined;
  const energyMin = searchParams.energy_min ? Number(searchParams.energy_min) : undefined;
  const search = searchParams.q as string | undefined;
  const hasCandidate = searchParams.has_candidate as string | undefined;
  
  // Build query
  let query = supabase
    .from('calls')
    .select('*', { count: 'exact' })
    .eq('org_id', orgId)
    .order('call_time', { ascending: false });
  
  // Apply filters
  if (direction) {
    query = query.eq('direction', direction);
  }
  
  if (energyMin) {
    query = query.gte('energy_score', energyMin);
  }
  
  if (hasCandidate === 'yes') {
    query = query.not('candidate_id', 'is', null);
  } else if (hasCandidate === 'no') {
    query = query.is('candidate_id', null);
  }
  
  if (search) {
    // Search in transcript and ai_recap
    query = query.or(`transcript.ilike.%${search}%,ai_recap.ilike.%${search}%,call_id.ilike.%${search}%`);
  }
  
  // Pagination
  const page = searchParams.page ? Number(searchParams.page) : 1;
  const pageSize = 50;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  
  query = query.range(from, to);
  
  const { data: calls, error, count } = await query;
  
  if (error) {
    console.error('Error fetching calls:', error);
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          Error loading calls: {error.message}
        </div>
      </div>
    );
  }
  
  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900">Calls Inbox</h1>
        <p className="mt-2 text-lg text-gray-600">
          All incoming and outgoing calls with AI analysis
        </p>
      </div>
      
      <CallsListClient
        initialCalls={calls || []}
        totalCount={count || 0}
        currentPage={page}
        pageSize={pageSize}
      />
    </div>
  );
}
