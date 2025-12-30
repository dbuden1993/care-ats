// File: src/app/api/candidates/[id]/preview/route.ts

import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const candidateId = params.id;

    // Fetch last 3 calls
    const { data: calls, error: callsError } = await supabase
      .from("calls")
      .select("id, call_time, direction, duration_ms, recording_url, ai_recap, energy_score, transcript")
      .eq("candidate_id", candidateId)
      .order("call_time", { ascending: false })
      .limit(3);

    if (callsError) throw callsError;

    // Fetch last note
    const { data: notes, error: notesError } = await supabase
      .from("candidate_notes")
      .select("id, note_text, created_at")
      .eq("candidate_id", candidateId)
      .order("created_at", { ascending: false })
      .limit(1);

    if (notesError) throw notesError;

    // Fetch candidate tags
    const { data: candidate, error: candidateError } = await supabase
      .from("candidates")
      .select("tags")
      .eq("id", candidateId)
      .single();

    if (candidateError) throw candidateError;

    return NextResponse.json({
      calls: calls || [],
      lastNote: notes?.[0] || null,
      tags: candidate?.tags || [],
    });
  } catch (error: any) {
    console.error("Preview fetch error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch preview" },
      { status: 500 }
    );
  }
}
