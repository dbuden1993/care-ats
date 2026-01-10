"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-md border px-2 py-0.5 text-xs text-gray-700">
      {children}
    </span>
  );
}

export default function ActionsPanel({
  candidateId,
  phoneE164,
  currentStatus,
}: {
  candidateId: string;
  phoneE164: string;
  currentStatus: string;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(currentStatus);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const telHref = useMemo(() => (phoneE164 ? `tel:${phoneE164}` : ""), [phoneE164]);

  async function copyPhone() {
    try {
      await navigator.clipboard.writeText(phoneE164);
    } catch {
      // fallback
      const el = document.createElement("textarea");
      el.value = phoneE164;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
    }
  }

  async function saveStatus(next: "new" | "shortlisted" | "rejected") {
    setBusy(true);
    try {
      const { error } = await supabase.from("candidates").update({ status: next }).eq("id", candidateId);
      if (error) throw error;
      setStatus(next);
      router.refresh();
    } catch (e: any) {
      alert(e?.message ?? "Failed to update status");
    } finally {
      setBusy(false);
    }
  }

  async function addNote() {
    const text = note.trim();
    if (!text) return;

    setBusy(true);
    try {
      const { error } = await supabase.from("candidate_notes").insert({
        candidate_id: candidateId,
        note: text,
      });
      if (error) throw error;

      setNote("");
      router.refresh();
    } catch (e: any) {
      alert(e?.message ?? "Failed to add note");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="rounded-xl border bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="text-xs text-gray-500">Status</div>
            <div className="mt-1">
              <Badge>{status}</Badge>
            </div>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            className="rounded-md border px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-60"
            onClick={() => saveStatus("new")}
            disabled={busy}
          >
            New
          </button>
          <button
            className="rounded-md border px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-60"
            onClick={() => saveStatus("shortlisted")}
            disabled={busy}
          >
            Shortlist
          </button>
          <button
            className="rounded-md border px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-60"
            onClick={() => saveStatus("rejected")}
            disabled={busy}
          >
            Reject
          </button>
        </div>
      </div>

      <div className="rounded-xl border bg-white p-4 shadow-sm">
        <div className="text-xs text-gray-500">Quick actions</div>

        <div className="mt-3 flex flex-col gap-2">
          <button
            className="rounded-md border px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-60"
            onClick={copyPhone}
            disabled={!phoneE164}
          >
            Copy phone
          </button>

          <a
            className={`rounded-md border px-3 py-2 text-sm hover:bg-gray-50 ${
              phoneE164 ? "" : "pointer-events-none opacity-60"
            }`}
            href={telHref}
          >
            Call
          </a>
        </div>
      </div>

      <div className="rounded-xl border bg-white p-4 shadow-sm">
        <div className="text-xs text-gray-500">Add note</div>
        <textarea
          className="mt-2 w-full min-h-[110px] rounded-md border p-2 text-sm"
          placeholder="Type a note…"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          disabled={busy}
        />
        <div className="mt-2 flex justify-end">
          <button
            className="rounded-md bg-black px-3 py-2 text-sm text-white disabled:opacity-60"
            onClick={addNote}
            disabled={busy || !note.trim()}
          >
            Add
          </button>
        </div>
      </div>
    </div>
  );
}
