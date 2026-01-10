"use client";

type Props = {
  selectedCount: number;
  selectAllMatching: boolean;
  excludedCount: number;
  onShortlist: () => void;
  onReject: () => void;
  onReset: () => void;
  onAddNote: () => void;
  onClear: () => void;
  busy: boolean;
};

export default function StickyBulkBar({
  selectedCount,
  selectAllMatching,
  excludedCount,
  onShortlist,
  onReject,
  onReset,
  onAddNote,
  onClear,
  busy,
}: Props) {
  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 shadow-lg animate-slide-up">
      <div className="mx-auto max-w-[1600px] px-6 py-4">
        <div className="flex items-center justify-between gap-4">
          {/* Left: Selection info */}
          <div className="flex items-center gap-4">
            <div className="text-sm font-medium text-gray-900">
              <span className="font-semibold">{selectedCount}</span> selected
              {selectAllMatching && excludedCount > 0 && (
                <span className="text-gray-400 ml-1">(excluding {excludedCount})</span>
              )}
            </div>
            <button
              onClick={onClear}
              disabled={busy}
              className="text-xs text-gray-400 hover:text-white underline"
            >
              Clear
            </button>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={onShortlist}
              disabled={busy}
              className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium hover:bg-green-700 disabled:opacity-50"
            >
              ⭐ Shortlist
            </button>
            <button
              onClick={onReject}
              disabled={busy}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium text-sm transition-colors shadow-sm disabled:opacity-60"
            >
              ✕ Reject
            </button>
            <button
              onClick={onReset}
              disabled={busy}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium text-sm transition-colors shadow-sm disabled:opacity-60"
            >
              ↺ Reset
            </button>
            <button
              onClick={onAddNote}
              disabled={busy}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium text-sm transition-colors shadow-sm disabled:opacity-60"
            >
              📝 Note
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}