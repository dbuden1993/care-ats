import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Await params in Next.js 15
  const { id } = await params;
  
  try {
    // Fetch recent calls for this candidate
    const { data: candidate } = await supabase
      .from('candidates')
      .select('phone_e164')
      .eq('id', id)
      .single();

    if (!candidate?.phone_e164) {
      return NextResponse.json({ calls: [], lastNote: null, tags: [] });
    }

    // Fetch calls
    const { data: calls } = await supabase
      .from('calls')
      .select('id, call_time, direction, duration_ms, recording_url, ai_recap, energy_score, transcript')
      .eq('candidate_phone_e164', candidate.phone_e164)
      .order('call_time', { ascending: false })
      .limit(5);

    // Fetch last note
    const { data: notes } = await supabase
      .from('notes')
      .select('id, content, created_at, author_name')
      .eq('candidate_id', id)
      .order('created_at', { ascending: false })
      .limit(1);

    // Fetch tags
    const { data: candidateData } = await supabase
      .from('candidates')
      .select('tags')
      .eq('id', id)
      .single();

    return NextResponse.json({
      calls: calls || [],
      lastNote: notes?.[0] || null,
      tags: candidateData?.tags || []
    });
  } catch (error) {
    console.error('Preview API error:', error);
    return NextResponse.json({ calls: [], lastNote: null, tags: [] });
  }
}
