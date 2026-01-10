"use client";

import Link from "next/link";

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-md border px-2 py-0.5 text-xs text-gray-700">
      {children}
    </span>
  );
}

function TagChip({ tag }: { tag: string }) {
  return (
    <span className="inline-flex items-center rounded-full border bg-white px-2 py-0.5 text-xs text-gray-700">
      {tag}
    </span>
  );
}

type CallPreview = {
  id: string;
  call_time: string;
  direction: string | null;
  duration_ms: number | null;
  recording_url: string | null;
  ai_recap: string | null;
  energy_score: number | null;
  transcript: string | null;
};

type NotePreview = {
  id: string;
  note_text: string;
  created_at: string;
};

type PreviewData = {
  calls: CallPreview[];
  lastNote: NotePreview | null;
  tags: string[];
};

function fmtWhen(x?: string | null) {
  if (!x) return "";
  const d = new Date(x);
  if (Number.isNaN(d.getTime())) return String(x);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  
  return d.toLocaleDateString();
}

function fmtDuration(ms?: number | null) {
  const n = typeof ms === "number" ? ms : 0;
  if (!n) return "";
  const s = Math.round(n / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m > 0 ? `${m}m ${r}s` : `${r}s`;
}

export default function FocusedCandidateCard({
  row,
  previewData,
  isLoading,
  onCopyPhone,
  onShortlist,
  onReject,
  onReset,
  onAddNote,
  onAddTag,
}: {
  row: any;
  previewData?: PreviewData | null;
  isLoading?: boolean;
  onCopyPhone: () => void;
  onShortlist: () => void;
  onReject: () => void;
  onReset: () => void;
  onAddNote: () => void;
  onAddTag: () => void;
}) {
  const href = row?.phone_e164
    ? `/candidates/${encodeURIComponent(row.phone_e164)}`
    : `/candidates/${encodeURIComponent(row.id)}`;

  const calls = previewData?.calls || [];
  const lastNote = previewData?.lastNote;
  const tags = previewData?.tags || [];

  return (
    <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b bg-gray-50">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium truncate">{row?.name || "Unknown"}</div>
            <div className="mt-0.5 text-xs text-gray-500 truncate">{row?.phone_e164 || ""}</div>
          </div>

          <Link href={href} className="rounded-md border bg-white px-3 py-1.5 text-xs hover:bg-gray-50 flex-shrink-0">
            Open →
          </Link>
        </div>

        {/* Badges */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {row?.status ? <Badge>{row.status}</Badge> : null}
          {row?.driver ? <Badge>🚗 {row.driver}</Badge> : null}
          {row?.dbs_update_service ? <Badge>DBS {row.dbs_update_service}</Badge> : null}
          {row?.mandatory_training ? <Badge>Trn {row.mandatory_training}</Badge> : null}
          {row?.last_energy_score != null ? <Badge>⚡ {row.last_energy_score}</Badge> : null}
          {typeof row?.call_count === "number" ? <Badge>📞 {row.call_count}</Badge> : null}
          {typeof row?.notes_count === "number" ? <Badge>📝 {row.notes_count}</Badge> : null}
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4 max-h-[500px] overflow-y-auto">
        {isLoading ? (
          <div className="text-xs text-gray-500 text-center py-6">Loading preview...</div>
        ) : (
          <>
            {/* Last 3 Calls */}
            {calls.length > 0 && (
              <div>
                <div className="text-xs font-medium text-gray-700 mb-2">Recent Calls</div>
                <div className="space-y-2">
                  {calls.map((call) => (
                    <div key={call.id} className="rounded-md border bg-gray-50 p-2.5 text-xs">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="flex items-center gap-2">
                          <span className={call.direction === "inbound" ? "text-green-600" : "text-blue-600"}>
                            {call.direction === "inbound" ? "📥" : "📤"}
                          </span>
                          <span className="text-gray-700">{fmtWhen(call.call_time)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {call.duration_ms && (
                            <span className="text-gray-500">{fmtDuration(call.duration_ms)}</span>
                          )}
                          {call.energy_score != null && (
                            <span className="font-medium">⚡ {call.energy_score}</span>
                          )}
                        </div>
                      </div>
                      {call.ai_recap && (
                        <div className="text-gray-600 line-clamp-2 mt-1.5">
                          {call.ai_recap}
                        </div>
                      )}
                      {call.transcript && (
                        <details className="mt-2">
                          <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">
                            📝 Show transcript
                          </summary>
                          <div className="mt-2 text-xs text-gray-600 bg-white rounded p-2 max-h-32 overflow-y-auto border">
                            {call.transcript.length > 300 
                              ? `${call.transcript.slice(0, 300)}...` 
                              : call.transcript}
                          </div>
                        </details>
                      )}
                      {call.recording_url && (
                        
                          <a href={call.recording_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline mt-1 inline-block text-xs"
                        >
                          🎧 Listen to recording
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Last Note */}
            {lastNote && (
              <div>
                <div className="text-xs font-medium text-gray-700 mb-2">Last Note</div>
                <div className="rounded-md border bg-yellow-50 p-2.5 text-xs">
                  <div className="text-gray-500 mb-1">{fmtWhen(lastNote.created_at)}</div>
                  <div className="text-gray-700 line-clamp-3">{lastNote.note_text}</div>
                </div>
              </div>
            )}

            {/* Tags */}
            {tags.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs font-medium text-gray-700">Tags</div>
                  <button
                    onClick={onAddTag}
                    className="text-xs text-blue-600 hover:text-blue-800"
                  >
                    + Add
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {tags.slice(0, 12).map((t) => (
                    <TagChip key={t} tag={t} />
                  ))}
                  {tags.length > 12 ? <span className="text-xs text-gray-500">+{tags.length - 12}</span> : null}
                </div>
              </div>
            )}

            {/* Empty State */}
            {!isLoading && calls.length === 0 && !lastNote && (
              <div className="text-xs text-gray-500 text-center py-6">
                No recent activity
              </div>
            )}
          </>
        )}
      </div>

      {/* Quick Actions */}
      <div className="p-4 border-t bg-gray-50 grid grid-cols-2 gap-2">
        <button
          className="rounded-md border bg-white px-3 py-2 text-xs hover:bg-gray-50"
          onClick={onCopyPhone}
        >
          📋 Copy Phone
        </button>
        <button
          className="rounded-md border bg-white px-3 py-2 text-xs hover:bg-gray-50"
          onClick={onAddNote}
        >
          📝 Add Note
        </button>
        <button
          className="rounded-md border bg-white px-3 py-2 text-xs hover:bg-gray-50"
          onClick={onAddTag}
        >
          🏷️ Add Tag
        </button>
        <button
          className="rounded-md border bg-white px-3 py-2 text-xs hover:bg-gray-50"
          onClick={onReset}
        >
          ↺ Reset
        </button>
        <button
          className="col-span-2 rounded-md bg-green-600 px-3 py-2 text-xs text-white hover:bg-green-700"
          onClick={onShortlist}
        >
          ⭐ Shortlist
        </button>
        <button
          className="col-span-2 rounded-md bg-red-600 px-3 py-2 text-xs text-white hover:bg-red-700"
          onClick={onReject}
        >
          ✕ Reject
        </button>
      </div>
    </div>
  );
}