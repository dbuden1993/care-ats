export const dynamic = "force-dynamic";
export const revalidate = 0;
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import ActionsPanel from "./ActionsPanel";
import TrackView from "./TrackView";

function isUuid(s: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

function fmtWhen(x?: string | null) {
  if (!x) return "—";
  const d = new Date(x);
  if (Number.isNaN(d.getTime())) return x;
  return d.toLocaleString();
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-md border px-2 py-0.5 text-xs text-gray-700">
      {children}
    </span>
  );
}

export default async function CandidatePage({ params }: { params: any }) {
  const p = await Promise.resolve(params);
  const rawId = decodeURIComponent(p.id as string);

  // Fetch candidate by UUID or phone_e164
  let candidate: any = null;

  if (isUuid(rawId)) {
    const res = await supabase.from("candidates").select("*").eq("id", rawId).maybeSingle();
    candidate = res.data;
  } else {
    const res = await supabase.from("candidates").select("*").eq("phone_e164", rawId).maybeSingle();
    candidate = res.data;

    // fallback (in case someone visits with missing +)
    if (!candidate) {
      const alt = rawId.startsWith("+") ? rawId.slice(1) : `+${rawId}`;
      const res2 = await supabase.from("candidates").select("*").eq("phone_e164", alt).maybeSingle();
      candidate = res2.data;
    }
  }

  if (!candidate) {
    return (
      <main className="mx-auto max-w-6xl p-6">
        <div className="rounded-lg border p-4 text-sm text-gray-700">Candidate not found.</div>
        <div className="mt-4">
          <Link href="/" className="rounded-md border px-3 py-2 text-sm hover:bg-gray-50">
            ← Back
          </Link>
        </div>
      </main>
    );
  }

  // Notes
  const notesRes = await supabase
    .from("candidate_notes")
    .select("id, note, created_at")
    .eq("candidate_id", candidate.id)
    .order("created_at", { ascending: false })
    .limit(50);

  const notes = notesRes.data ?? [];

  // Calls
  const phone = candidate.phone_e164 as string;
  const callsRes = await supabase
    .from("calls")
    .select(
      "id, call_id, call_time, direction, duration_ms, transcript, recording_url, ai_recap, extracted_json, energy_score, created_at"
    )
    .eq("candidate_phone_e164", phone)
    .order("call_time", { ascending: false })
    .limit(200);

  const calls = callsRes.data ?? [];

  return (
    <main className="mx-auto max-w-6xl p-6">
      <TrackView candidate={candidate} />
      
      <Link href="/" className="text-sm underline underline-offset-2">
        ← Back to candidates
      </Link>

      {/* Header */}
      <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="lg:col-span-8 rounded-xl border bg-white p-5">
          <div className="text-2xl font-semibold">{candidate.name || "Unknown"}</div>
          <div className="mt-2 text-sm text-gray-700">Phone: {candidate.phone_e164}</div>
          <div className="mt-1 text-sm text-gray-700">Status: {candidate.status}</div>
          <div className="mt-1 text-sm text-gray-700">
            Last called: {fmtWhen(candidate.last_called_at)}
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {candidate.driver && <Badge>Driver: {candidate.driver}</Badge>}
            {candidate.dbs_update_service && <Badge>DBS Update: {candidate.dbs_update_service}</Badge>}
            {candidate.mandatory_training && <Badge>Training: {candidate.mandatory_training}</Badge>}
            {candidate.earliest_start_date && <Badge>Earliest start: {String(candidate.earliest_start_date)}</Badge>}
          </div>

          {/* Notes pinned near top */}
          <div className="mt-6">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold">Notes</div>
              <div className="text-xs text-gray-500">{notes.length} total</div>
            </div>

            {notesRes.error ? (
              <div className="mt-2 text-sm text-red-600">
                Error loading notes: {notesRes.error.message}
              </div>
            ) : notes.length === 0 ? (
              <div className="mt-2 text-sm text-gray-600">No notes yet.</div>
            ) : (
              <div className="mt-3 space-y-2">
                {notes.map((n: any) => (
                  <div key={n.id} className="rounded-lg border p-3">
                    <div className="text-xs text-gray-500">{fmtWhen(n.created_at)}</div>
                    <div className="mt-1 whitespace-pre-wrap text-sm text-gray-800">{n.note}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Keep your existing candidate info blocks */}
          {candidate.experience_summary ? (
            <div className="mt-8">
              <div className="text-sm font-semibold">Experience summary</div>
              <div className="mt-2 text-sm text-gray-800 whitespace-pre-wrap">
                {candidate.experience_summary}
              </div>
            </div>
          ) : null}

          {candidate.weekly_rota ? (
            <div className="mt-6">
              <div className="text-sm font-semibold">Availability / rota</div>
              <div className="mt-2 text-sm text-gray-800 whitespace-pre-wrap">
                {candidate.weekly_rota}
              </div>
            </div>
          ) : null}
        </div>

        {/* Right rail */}
        <div className="lg:col-span-4">
          <div className="sticky top-6">
            <ActionsPanel
              candidateId={candidate.id}
              phoneE164={candidate.phone_e164}
              currentStatus={candidate.status}
            />
          </div>
        </div>
      </div>

      {/* Calls */}
      <div className="mt-10">
        <div className="text-lg font-semibold">Call history</div>

        {callsRes.error ? (
          <div className="mt-3 rounded-lg border p-4 text-sm text-red-600">
            Error loading calls: {callsRes.error.message}
          </div>
        ) : calls.length === 0 ? (
          <div className="mt-3 rounded-lg border p-4 text-sm text-gray-600">No calls found.</div>
        ) : (
          <div className="mt-3 space-y-3">
            {calls.map((c: any) => (
              <div key={c.id} className="rounded-xl border bg-white p-4">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-medium">{fmtWhen(c.call_time || c.created_at)}</span>
                  <Badge>{c.direction || "unknown"}</Badge>
                  {c.energy_score != null && <Badge>⚡ {c.energy_score}</Badge>}
                  {c.duration_ms != null && <Badge>⏱ {Math.round(c.duration_ms / 1000)}s</Badge>}
                  {c.recording_url ? (
                    <a
                      href={c.recording_url}
                      target="_blank"
                      rel="noreferrer"
                      className="ml-auto rounded-md border px-3 py-1 hover:bg-gray-50"
                    >
                      Recording ↗
                    </a>
                  ) : null}
                </div>

                {c.ai_recap ? (
                  <div className="mt-3 rounded-lg bg-gray-50 p-3 text-sm whitespace-pre-wrap">
                    <div className="text-xs font-semibold text-gray-500 mb-1">AI recap</div>
                    {c.ai_recap}
                  </div>
                ) : null}

                {c.transcript ? (
                  <details className="mt-3 rounded-lg border p-3">
                    <summary className="cursor-pointer text-sm font-medium">Transcript</summary>
                    <div className="mt-2 whitespace-pre-wrap text-sm text-gray-800">{c.transcript}</div>
                  </details>
                ) : null}

                {c.extracted_json ? (
                  <details className="mt-2 rounded-lg border p-3">
                    <summary className="cursor-pointer text-sm font-medium">Extracted JSON</summary>
                    <pre className="mt-2 overflow-auto text-xs text-gray-700">
                      {JSON.stringify(c.extracted_json, null, 2)}
                    </pre>
                  </details>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
