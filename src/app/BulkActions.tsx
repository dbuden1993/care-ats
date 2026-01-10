"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Row = {
  id: string;
  name?: string | null;
  phone_e164?: string | null;
  status?: string | null;
};

export default function BulkActions({
  rows,
}: {
  rows: Row[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);

  const selectedIds = useMemo(
    () => Object.keys(selected).filter((id) => selected[id]),
    [selected]
  );

  const allChecked = rows.length > 0 && selectedIds.length === rows.length;

  function toggleAll() {
    if (allChecked) {
      setSelected({});
    } else {
      const next: Record<string, boolean> = {};
      for (const r of rows) next[r.id] = true;
      setSelected(next);
    }
  }

  function toggleOne(id: string) {
    setSelected((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  async function setStatus(nextStatus: "new" | "shortlisted" | "rejected") {
    if (selectedIds.length === 0) return;

    setLoading(true);

    const { error } = await supabase
      .from("candidates")
      .update({ status: nextStatus })
      .in("id", selectedIds);

    setLoading(false);

    if (error) {
      alert(`Bulk update failed: ${error.message}`);
      return;
    }

    setSelected({});
    router.refresh();
  }

  return (
    <div className="mt-4 rounded-lg border p-3 flex flex-wrap items-center gap-2">
      <div className="text-sm font-semibold mr-2">Bulk actions</div>

      <button
        onClick={toggleAll}
        className="rounded-md border px-3 py-1 text-sm hover:bg-gray-50"
      >
        {allChecked ? "Unselect all" : "Select all"}
      </button>

      <div className="text-sm text-gray-600 ml-2">
        Selected: <b>{selectedIds.length}</b>
      </div>

      <div className="flex-1" />

      <button
        disabled={loading || selectedIds.length === 0}
        onClick={() => setStatus("shortlisted")}
        className="rounded-md bg-black px-3 py-2 text-white text-sm disabled:opacity-60"
      >
        Shortlist
      </button>

      <button
        disabled={loading || selectedIds.length === 0}
        onClick={() => setStatus("rejected")}
        className="rounded-md border px-3 py-2 text-sm text-red-600 disabled:opacity-60"
      >
        Reject
      </button>

      <button
        disabled={loading || selectedIds.length === 0}
        onClick={() => setStatus("new")}
        className="rounded-md border px-3 py-2 text-sm disabled:opacity-60"
      >
        Reset to New
      </button>

      {/* This is the important part: expose toggle function via data attribute */}
      <div className="hidden" data-selected-json={JSON.stringify(selected)} />
      <div className="hidden" data-toggle-one="true" />
      <div className="hidden" data-toggle-all="true" />
    </div>
  );
}
