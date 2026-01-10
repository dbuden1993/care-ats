import Link from "next/link";

function fmtWhen(x?: string | null) {
  if (!x) return "";
  const d = new Date(x);
  if (Number.isNaN(d.getTime())) return x;
  return d.toLocaleString();
}

function fmtDuration(ms?: number | null) {
  if (!ms || ms <= 0) return "—";
  const sec = Math.round(ms / 1000);
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-md border px-2 py-0.5 text-xs text-gray-700">
      {children}
    </span>
  );
}

export default function CallCard({ call }: { call: any }) {
  const when = fmtWhen(call.call_time || call.created_at);
  const dir = call.direction || "unknown";
  const dur = fmtDuration(call.duration_ms);

  return (
    <div className="rounded-xl border bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <div className="font-medium">{when || "Unknown time"}</div>
            <Badge>{dir}</Badge>
            <Badge>⏱ {dur}</Badge>
            {call.energy_score != null && <Badge>⚡ {call.energy_score}</Badge>}
          </div>

          {call.call_id ? (
            <div className="mt-1 text-xs text-gray-500">Dialpad call_id: {call.call_id}</div>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          {call.recording_url ? (
            <a
              href={call.recording_url}
              target="_blank"
              rel="noreferrer"
              className="rounded-md border px-3 py-1 text-sm hover:bg-gray-50"
            >
              Recording ↗
            </a>
          ) : (
            <span className="rounded-md border px-3 py-1 text-sm text-gray-400">No recording</span>
          )}
        </div>
      </div>

      {/* AI recap */}
      {call.ai_recap ? (
        <div className="mt-3 rounded-lg bg-gray-50 p-3 text-sm text-gray-800">
          <div className="text-xs font-medium text-gray-500 mb-1">AI recap</div>
          <div className="whitespace-pre-wrap">{call.ai_recap}</div>
        </div>
      ) : null}

      {/* Expanders */}
      <div className="mt-3 space-y-2">
        {call.extracted_json ? (
          <details className="rounded-lg border bg-white p-3">
            <summary className="cursor-pointer text-sm font-medium">
              Extracted fields (JSON)
            </summary>
            <pre className="mt-2 overflow-auto text-xs text-gray-700">
              {JSON.stringify(call.extracted_json, null, 2)}
            </pre>
          </details>
        ) : null}

        {call.transcript ? (
          <details className="rounded-lg border bg-white p-3">
            <summary className="cursor-pointer text-sm font-medium">Transcript</summary>
            <div className="mt-2 whitespace-pre-wrap text-sm text-gray-800">
              {call.transcript}
            </div>
          </details>
        ) : null}
      </div>
    </div>
  );
}
