"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Status = "new" | "shortlisted" | "rejected";

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-md border px-2 py-0.5 text-xs text-gray-700">
      {children}
    </span>
  );
}

function fmtWhen(x?: string | null) {
  if (!x) return "";
  const d = new Date(x);
  if (Number.isNaN(d.getTime())) return x;
  return d.toLocaleString();
}

export default function PipelineBoardClient({
  initialBoard,
  initialCounts,
}: {
  initialBoard: Record<Status, any[]>;
  initialCounts: Record<Status, number>;
}) {
  const router = useRouter();

  const [board, setBoard] = useState<Record<Status, any[]>>(initialBoard);
  const [counts] = useState<Record<Status, number>>(initialCounts);
  const [movingId, setMovingId] = useState<string | null>(null);

  const columns: { key: Status; title: string }[] = useMemo(
    () => [
      { key: "new", title: "New" },
      { key: "shortlisted", title: "Shortlisted" },
      { key: "rejected", title: "Rejected" },
    ],
    []
  );

  function onDragStart(e: React.DragEvent, candidate: any, from: Status) {
    e.dataTransfer.setData("application/json", JSON.stringify({ id: candidate.id, from }));
    e.dataTransfer.effectAllowed = "move";
  }

  async function moveCandidate(id: string, from: Status, to: Status) {
    if (from === to) return;

    setMovingId(id);

    // optimistic move
    const prev = board;
    const candidate =
      prev[from].find((c) => c.id === id) ||
      prev["new"].find((c) => c.id === id) ||
      prev["shortlisted"].find((c) => c.id === id) ||
      prev["rejected"].find((c) => c.id === id);

    const next: Record<Status, any[]> = {
      new: prev.new.filter((c) => c.id !== id),
      shortlisted: prev.shortlisted.filter((c) => c.id !== id),
      rejected: prev.rejected.filter((c) => c.id !== id),
    };

    if (candidate) {
      candidate.status = to;
      next[to] = [candidate, ...next[to]];
    }

    setBoard(next);

    try {
      const { error } = await supabase.from("candidates").update({ status: to }).eq("id", id);
      if (error) throw error;

      // refresh server counts/list view fields (notes_count, last_* previews etc)
      router.refresh();
    } catch (e: any) {
      // revert
      setBoard(prev);
      alert(e?.message ?? "Failed to move candidate");
    } finally {
      setMovingId(null);
    }
  }

  function onDropColumn(e: React.DragEvent, to: Status) {
    e.preventDefault();
    try {
      const raw = e.dataTransfer.getData("application/json");
      if (!raw) return;
      const parsed = JSON.parse(raw) as { id: string; from: Status };
      if (!parsed?.id || !parsed?.from) return;
      moveCandidate(parsed.id, parsed.from, to);
    } catch {
      // ignore
    }
  }

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {columns.map((col) => {
        const items = board[col.key] ?? [];
        return (
          <div
            key={col.key}
            className="rounded-xl border bg-white"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => onDropColumn(e, col.key)}
          >
            <div className="sticky top-2 z-10 bg-white/90 backdrop-blur px-3 py-2 border-b rounded-t-xl">
              <div className="flex items-center justify-between">
                <div className="font-medium">{col.title}</div>
                <div className="text-xs text-gray-600">
                  {items.length}
                  {counts[col.key] > items.length ? ` / ${counts[col.key]}` : ""}
                </div>
              </div>
            </div>

            <div className="p-3 space-y-2 min-h-[240px]">
              {items.length === 0 && (
                <div className="text-sm text-gray-500 border border-dashed rounded-lg p-3">
                  Drop candidates here
                </div>
              )}

              {items.map((c) => {
                const href = c.phone_e164
                  ? `/candidates/${encodeURIComponent(c.phone_e164)}`
                  : `/candidates/${encodeURIComponent(c.id)}`;

                const preview =
                  (c.last_note_text as string) || (c.last_ai_recap_preview as string) || "";

                return (
                  <div
                    key={c.id}
                    draggable
                    onDragStart={(e) => onDragStart(e, c, col.key)}
                    className="rounded-lg border bg-white p-3 shadow-sm hover:bg-gray-50/50 cursor-grab active:cursor-grabbing"
                    style={{ opacity: movingId === c.id ? 0.6 : 1 }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <Link href={href} className="font-medium hover:underline">
                          {c.name || "Unknown"}
                        </Link>
                        {c.roles ? (
                          <div className="mt-0.5 text-xs text-gray-600 line-clamp-1">{c.roles}</div>
                        ) : null}
                      </div>

                      <div className="flex flex-col items-end gap-1">
                        <Badge>{c.status}</Badge>
                        {c.last_energy_score != null && <Badge>⚡ {c.last_energy_score}</Badge>}
                      </div>
                    </div>

                    {preview ? (
                      <div className="mt-2 text-xs text-gray-600 line-clamp-2">
                        {c.last_note_text ? "📝 " : "🤖 "}
                        {preview}
                      </div>
                    ) : null}

                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {typeof c.notes_count === "number" && <Badge>📝 {c.notes_count}</Badge>}
                      {typeof c.call_count === "number" && <Badge>📞 {c.call_count}</Badge>}
                      {c.driver && <Badge>🚗 {c.driver}</Badge>}
                      {c.dbs_update_service && <Badge>DBS {c.dbs_update_service}</Badge>}
                      {c.mandatory_training && <Badge>Trn {c.mandatory_training}</Badge>}
                    </div>

                    <div className="mt-2 text-xs text-gray-500">
                      Last called: {fmtWhen(c.last_called_at || c.last_call_time) || "—"}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
