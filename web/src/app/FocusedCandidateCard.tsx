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

export default function FocusedCandidateCard({
  row,
  tags,
  onCopyPhone,
  onShortlist,
  onAddNote,
}: {
  row: any;
  tags?: string[];
  onCopyPhone: () => void;
  onShortlist: () => void;
  onAddNote: () => void;
}) {
  const href = row?.phone_e164
    ? `/candidates/${encodeURIComponent(row.phone_e164)}`
    : `/candidates/${encodeURIComponent(row.id)}`;

  return (
    <div className="rounded-xl border bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-medium truncate">{row?.name || "Unknown"}</div>
          <div className="mt-0.5 text-xs text-gray-500 truncate">{row?.phone_e164 || ""}</div>
        </div>

        <Link href={href} className="rounded-md border px-3 py-1.5 text-xs hover:bg-gray-50">
          Open →
        </Link>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {row?.status ? <Badge>{row.status}</Badge> : null}
        {row?.driver ? <Badge>🚗 {row.driver}</Badge> : null}
        {row?.dbs_update_service ? <Badge>DBS {row.dbs_update_service}</Badge> : null}
        {row?.mandatory_training ? <Badge>Trn {row.mandatory_training}</Badge> : null}
        {row?.last_energy_score != null ? <Badge>⚡ {row.last_energy_score}</Badge> : null}
        {typeof row?.call_count === "number" ? <Badge>📞 {row.call_count}</Badge> : null}
        {typeof row?.notes_count === "number" ? <Badge>📝 {row.notes_count}</Badge> : null}
      </div>

      {Array.isArray(tags) && tags.length > 0 ? (
        <div className="mt-3">
          <div className="text-xs font-medium text-gray-700 mb-1">Tags</div>
          <div className="flex flex-wrap gap-1.5">
            {tags.slice(0, 12).map((t) => (
              <TagChip key={t} tag={t} />
            ))}
            {tags.length > 12 ? <span className="text-xs text-gray-500">+{tags.length - 12}</span> : null}
          </div>
        </div>
      ) : null}

      <div className="mt-4 grid grid-cols-2 gap-2">
        <button className="rounded-md border px-3 py-2 text-sm hover:bg-gray-50" onClick={onCopyPhone}>
          Copy phone
        </button>
        <button className="rounded-md border px-3 py-2 text-sm hover:bg-gray-50" onClick={onAddNote}>
          Add note
        </button>
        <button className="col-span-2 rounded-md bg-black px-3 py-2 text-sm text-white" onClick={onShortlist}>
          Shortlist
        </button>
      </div>
    </div>
  );
}
