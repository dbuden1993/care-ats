"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import FocusedCandidateCard from "./FocusedCandidateCard";
import { ALLOWED_COLS, DEFAULT_COLS, colsToParam, type AllowedCol } from "./columns";

type Filters = {
  q: string;
  driver: string;
  dbs: string;
  training: string;
  status: string;
  weekend: string;
  tags: string[];
};

type Status = "new" | "shortlisted" | "rejected";

type CallRow = {
  id?: string;
  call_time?: string | null;
  direction?: string | null;
  duration_ms?: number | null;
  recording_url?: string | null;
  ai_recap?: string | null;
  transcript?: string | null;
  energy_score?: number | null;
};

type SortKey = "last_called" | "energy" | "calls" | "notes" | "name" | "relevance";
type SortDir = "asc" | "desc";

function toNullAny(v: string) {
  const s = (v ?? "").trim();
  if (!s || s === "any") return null;
  return s;
}

function fmtWhen(x?: string | null) {
  if (!x) return "";
  const d = new Date(x);
  if (Number.isNaN(d.getTime())) return String(x);
  return d.toLocaleString();
}

function fmtDuration(ms?: number | null) {
  const n = typeof ms === "number" ? ms : 0;
  if (!n) return "";
  const s = Math.round(n / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m > 0 ? `${m}m ${r}s` : `${r}s`;
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-lg border px-4 py-0.5 text-base text-gray-700">
      {children}
    </span>
  );
}

function TagChip({ tag, onRemove }: { tag: string; onRemove?: () => void }) {
  return (
    <span className="inline-flex items-center gap-3 rounded-full border bg-white px-4 py-0.5 text-base text-gray-700">
      <span>{tag}</span>
      {onRemove ? (
        <button
          type="button"
          className="text-gray-500 hover:text-gray-900"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          title="Remove"
        >
          ✕
        </button>
      ) : null}
    </span>
  );
}

function shouldIgnoreRowClick(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const t = el.tagName?.toLowerCase();
  if (["a", "button", "input", "select", "textarea", "label", "summary"].includes(t)) return true;
  return !!el.closest("a,button,input,select,textarea,label,summary");
}

function normalizeTagClient(s: string) {
  return s.trim().toLowerCase().replace(/\s+/g, "-");
}

function parseTagInput(input: string): string[] {
  const parts = input
    .split(/[,\n]/g)
    .map((x) => normalizeTagClient(x))
    .filter(Boolean);
  return Array.from(new Set(parts));
}

function defaultSortDir(sort: SortKey): SortDir {
  if (sort === "name") return "asc";
  return "desc";
}

export default function CandidatesTableClient({
  rows,
  totalMatchingCount,
  filters,
  initialCols,
}: {
  rows: any[];
  totalMatchingCount: number;
  filters: Filters;
  initialCols: AllowedCol[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const qTrim = (sp.get("q") ?? "").trim();
  const weekend = sp.get("weekend") ?? "any";
  const usingSearchRpc = !!qTrim || weekend !== "any";

  // ---- Sort (URL) ----
  const sortDefault: SortKey = qTrim ? "relevance" : "last_called";
  let sort = (sp.get("sort") as SortKey) || sortDefault;
  if (qTrim) sort = "relevance";
  if (!qTrim && weekend !== "any" && sort !== "last_called") sort = "last_called";

  const dirDefault = defaultSortDir(sort);
  const dir = ((sp.get("dir") as SortDir) || dirDefault) as SortDir;

  function setSortInUrl(nextSort: SortKey, nextDir?: SortDir) {
    const params = new URLSearchParams(sp.toString());

    if (qTrim) {
      params.delete("sort");
      params.delete("dir");
      params.set("page", "1");
      router.push(`${pathname}?${params.toString()}`);
      return;
    }

    if (nextSort === "last_called") params.delete("sort");
    else params.set("sort", nextSort);

    const nd = nextDir ?? defaultSortDir(nextSort);
    if (nd === defaultSortDir(nextSort)) params.delete("dir");
    else params.set("dir", nd);

    params.set("page", "1");
    router.push(`${pathname}?${params.toString()}`);
  }

  // ---- Columns ----
  const [visibleCols, setVisibleCols] = useState<AllowedCol[]>(initialCols?.length ? initialCols : DEFAULT_COLS);

  useEffect(() => {
    const urlCols = (sp.get("cols") ?? "").trim();
    if (urlCols) return;

    try {
      const saved = localStorage.getItem("careATS.cols") || "";
      if (!saved) return;

      const parts = saved.split(",").map((x) => x.trim()).filter(Boolean);
      const set = new Set(parts);
      const next: AllowedCol[] = [];
      for (const k of ALLOWED_COLS) if (set.has(k)) next.push(k);
      if (next.length) setVisibleCols(next);
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const show = useMemo(() => {
    const set = new Set(visibleCols);
    return {
      phone: set.has("phone"),
      roles: set.has("roles"),
      tags: set.has("tags"),
      badges: set.has("badges"),
      last_called: set.has("last_called"),
      actions: set.has("actions"),
    };
  }, [visibleCols]);

  const colSpan = useMemo(() => {
    let n = 2;
    for (const k of ALLOWED_COLS) if ((show as any)[k]) n += 1;
    return n;
  }, [show]);

  function updateCols(next: AllowedCol[]) {
    const param = colsToParam(next);
    setVisibleCols(next);

    try {
      localStorage.setItem("careATS.cols", param);
    } catch {}

    const params = new URLSearchParams(sp.toString());
    if (param) params.set("cols", param);
    else params.delete("cols");
    params.set("page", "1");
    router.push(`${pathname}?${params.toString()}`);
  }

  function toggleCol(k: AllowedCol, on: boolean) {
    const set = new Set(visibleCols);
    if (on) set.add(k);
    else set.delete(k);

    const next: AllowedCol[] = [];
    for (const c of ALLOWED_COLS) if (set.has(c)) next.push(c);
    if (!next.length) {
      updateCols(DEFAULT_COLS);
      return;
    }
    updateCols(next);
  }

  // ---- Tag filters (URL): ALL tags semantics ----
  const selectedTags = useMemo(() => {
    const raw = (sp.get("tags") ?? "").trim();
    return raw ? raw.split(",").map((x) => normalizeTagClient(x)).filter(Boolean) : [];
  }, [sp]);

  function setTagsInUrl(nextTags: string[]) {
    const params = new URLSearchParams(sp.toString());
    if (nextTags.length) params.set("tags", nextTags.join(","));
    else params.delete("tags");
    params.set("page", "1");
    router.push(`${pathname}?${params.toString()}`);
  }

  function addTagToUrl(tag: string) {
    const t = normalizeTagClient(tag);
    const set = new Set(selectedTags);
    set.add(t);
    setTagsInUrl(Array.from(set));
  }

  function removeTagFromUrl(tag: string) {
    const t = normalizeTagClient(tag);
    setTagsInUrl(selectedTags.filter((x) => x !== t));
  }

  // ---- Tag suggestions (autocomplete) ----
  const [tagSuggest, setTagSuggest] = useState<Array<{ tag: string; uses: number }>>([]);
  useEffect(() => {
    const q = normalizeTagClient(tagFilterInput);
    if (!q) {
      setTagSuggest([]);
      return;
    }

    let cancelled = false;
    const t = setTimeout(async () => {
      const { data } = await supabase.rpc("suggest_candidate_tags", { p_prefix: q, p_limit: 8 });
      if (cancelled) return;
      setTagSuggest((data ?? []) as any);
    }, 150);

    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, []);

  // ---- Candidate tags (for display & edit) ----
  const [tagsById, setTagsById] = useState<Record<string, string[]>>({});

  useEffect(() => {
    const ids = rows.map((r) => String(r.id)).filter(Boolean);
    if (!ids.length) return;

    let cancelled = false;

    (async () => {
      const { data, error } = await supabase.from("candidates").select("id,tags").in("id", ids);
      if (cancelled) return;
      if (error) return;

      const next: Record<string, string[]> = {};
      for (const row of data ?? []) {
        const id = String((row as any).id);
        const tags = Array.isArray((row as any).tags) ? (row as any).tags : [];
        next[id] = tags.map((t: any) => String(t)).filter(Boolean);
      }

      setTagsById((prev) => ({ ...prev, ...next }));
    })();

    return () => {
      cancelled = true;
    };
  }, [rows]);

  // ---- Hover focus ----
  const [focusedRow, setFocusedRow] = useState<any | null>(null);

  // ---- Selection model ----
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectAllMatching, setSelectAllMatching] = useState(false);
  const [excludedIds, setExcludedIds] = useState<Set<string>>(new Set());

  // ---- Note modal ----
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteText, setNoteText] = useState("");

  // ---- Tag filter + tag edit inputs ----
  const [tagFilterInput, setTagFilterInput] = useState("");
  const [tagFilterOpen, setTagFilterOpen] = useState(false);

  const [tagEditInput, setTagEditInput] = useState("");

  // Busy
  const [busy, setBusy] = useState(false);

  // Expanded details per row
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // Calls cache
  const [callsByCandidate, setCallsByCandidate] = useState<
    Record<string, { loading: boolean; error?: string; items?: CallRow[] }>
  >({});

  const isRowSelected = (id: string) => (selectAllMatching ? !excludedIds.has(id) : selectedIds.has(id));

  const allOnPageSelected = useMemo(() => {
    if (!rows.length) return false;
    return rows.every((r) => isRowSelected(r.id));
  }, [rows, selectAllMatching, excludedIds, selectedIds]);

  const someOnPageSelected = useMemo(() => rows.some((r) => isRowSelected(r.id)), [rows, selectAllMatching, excludedIds, selectedIds]);

  const headerRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    if (headerRef.current) headerRef.current.indeterminate = !allOnPageSelected && someOnPageSelected;
  }, [allOnPageSelected, someOnPageSelected]);

  const selectedCount = useMemo(() => {
    if (!selectAllMatching) return selectedIds.size;
    return Math.max(0, totalMatchingCount - excludedIds.size);
  }, [selectAllMatching, selectedIds, totalMatchingCount, excludedIds]);

  function clearSelection() {
    setSelectedIds(new Set());
    setSelectAllMatching(false);
    setExcludedIds(new Set());
  }

  function toggleRow(id: string, checked: boolean) {
    if (selectAllMatching) {
      setExcludedIds((prev) => {
        const next = new Set(prev);
        if (checked) next.delete(id);
        else next.add(id);
        return next;
      });
      return;
    }

    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function toggleAllOnPage(checked: boolean) {
    const pageIds = rows.map((r) => String(r.id));

    if (selectAllMatching) {
      setExcludedIds((prev) => {
        const next = new Set(prev);
        for (const id of pageIds) {
          if (checked) next.delete(id);
          else next.add(id);
        }
        return next;
      });
      return;
    }

    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const id of pageIds) {
        if (checked) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }

  function buildBulkArgsBase() {
    const args: any = {
      p_search: toNullAny(filters.q),
      p_status: toNullAny(filters.status),
      p_driver: toNullAny(filters.driver),
      p_dbs_update_service: toNullAny(filters.dbs),
      p_mandatory_training: toNullAny(filters.training),
      p_exclude_ids: Array.from(excludedIds),
      p_tags: selectedTags.length ? selectedTags : null, // ✅ tag filter respected in v2 RPCs
    };
    if (filters.weekend && filters.weekend !== "any") args.p_weekend = filters.weekend === "yes";
    return args;
  }

  async function bulkAddNote() {
    const note = noteText.trim();
    if (!note) return;

    setBusy(true);
    try {
      if (selectAllMatching) {
        const args = { ...buildBulkArgsBase(), p_note: note };
        const { error } = await supabase.rpc("bulk_add_note_to_candidates_v2", args);
        if (error) throw error;
      } else {
        const ids = Array.from(selectedIds);
        if (!ids.length) return;

        const payload = ids.map((candidate_id) => ({ candidate_id, note }));
        const { error } = await supabase.from("candidate_notes").insert(payload);
        if (error) throw error;
      }

      setNoteText("");
      setNoteOpen(false);
      clearSelection();
      router.refresh();
    } catch (e: any) {
      alert(e?.message ?? "Failed to add note");
    } finally {
      setBusy(false);
    }
  }

  async function bulkSetStatus(newStatus: Status) {
    setBusy(true);
    try {
      if (selectAllMatching) {
        const args = { ...buildBulkArgsBase(), p_new_status: newStatus };
        const { error } = await supabase.rpc("bulk_update_candidate_status_v2", args);
        if (error) throw error;
      } else {
        const ids = Array.from(selectedIds);
        if (!ids.length) return;

        const { error } = await supabase.from("candidates").update({ status: newStatus }).in("id", ids);
        if (error) throw error;
      }

      clearSelection();
      router.refresh();
    } catch (e: any) {
      alert(e?.message ?? "Failed to update status");
    } finally {
      setBusy(false);
    }
  }

  async function setStatusSingle(candidateId: string, newStatus: Status) {
    setBusy(true);
    try {
      const { error } = await supabase.from("candidates").update({ status: newStatus }).eq("id", candidateId);
      if (error) throw error;
      router.refresh();
    } catch (e: any) {
      alert(e?.message ?? "Failed to update status");
    } finally {
      setBusy(false);
    }
  }

  async function copyPhone(phone?: string) {
    const p = String(phone ?? "").trim();
    if (!p) return;
    try {
      await navigator.clipboard.writeText(p);
      alert("Copied phone number");
    } catch {
      alert("Could not copy (clipboard blocked).");
    }
  }

  // ---- Candidate tag editing (bulk / hovered / select all matching) ----
  async function applyCandidateTagMutation(opts: { add?: string[]; remove?: string[]; explicitIds?: string[] }) {
    const addTags = (opts.add ?? []).filter(Boolean);
    const removeTags = (opts.remove ?? []).filter(Boolean);
    if (!addTags.length && !removeTags.length) return;

    setBusy(true);
    try {
      if (opts.explicitIds?.length) {
        const { error } = await supabase.rpc("bulk_mutate_candidate_tags", {
          p_candidate_ids: opts.explicitIds,
          p_add_tags: addTags.length ? addTags : null,
          p_remove_tags: removeTags.length ? removeTags : null,
        });
        if (error) throw error;
        router.refresh();
        return;
      }

      if (selectAllMatching) {
        const args = {
          ...buildBulkArgsBase(),
          p_add_tags: addTags.length ? addTags : null,
          p_remove_tags: removeTags.length ? removeTags : null,
        };
        const { error } = await supabase.rpc("bulk_mutate_candidate_tags_matching_v2", args);
        if (error) throw error;
        router.refresh();
        return;
      }

      const ids = Array.from(selectedIds);
      if (!ids.length) return;

      const { error } = await supabase.rpc("bulk_mutate_candidate_tags", {
        p_candidate_ids: ids,
        p_add_tags: addTags.length ? addTags : null,
        p_remove_tags: removeTags.length ? removeTags : null,
      });
      if (error) throw error;

      router.refresh();
    } catch (e: any) {
      alert(e?.message ?? "Failed to update tags");
    } finally {
      setBusy(false);
    }
  }

  async function addTagsToCandidates() {
    const t = parseTagInput(tagEditInput);
    if (!t.length) return;

    if (selectedCount > 0) await applyCandidateTagMutation({ add: t });
    else if (focusedRow?.id) await applyCandidateTagMutation({ add: t, explicitIds: [String(focusedRow.id)] });
    else alert("Hover a row (or select rows) to tag.");

    setTagEditInput("");
  }

  async function removeTagsFromCandidates() {
    const t = parseTagInput(tagEditInput);
    if (!t.length) return;

    if (selectedCount > 0) await applyCandidateTagMutation({ remove: t });
    else if (focusedRow?.id) await applyCandidateTagMutation({ remove: t, explicitIds: [String(focusedRow.id)] });
    else alert("Hover a row (or select rows) to remove tags.");

    setTagEditInput("");
  }

  // ---- Calls loading: try candidate_id, fallback to candidate_phone_e164 ----
  async function ensureCallsLoaded(row: any) {
    const key = String(row?.id ?? "");
    if (!key) return;
    const existing = callsByCandidate[key];
    if (existing?.loading || existing?.items || existing?.error) return;

    setCallsByCandidate((prev) => ({ ...prev, [key]: { loading: true } }));

    try {
      let data: any[] | null = null;

      // attempt candidate_id
      const res1 = await supabase
        .from("calls")
        .select("id, call_time, direction, duration_ms, recording_url, ai_recap, transcript, energy_score")
        .eq("candidate_id", key)
        .order("call_time", { ascending: false })
        .limit(3);

      if (!res1.error) data = (res1.data ?? []) as any[];

      // fallback to candidate_phone_e164
      if (res1.error) {
        const phone = String(row?.phone_e164 ?? "").trim();
        if (phone) {
          const res2 = await supabase
            .from("calls")
            .select("id, call_time, direction, duration_ms, recording_url, ai_recap, transcript, energy_score")
            .eq("candidate_phone_e164", phone)
            .order("call_time", { ascending: false })
            .limit(3);

          if (res2.error) throw res2.error;
          data = (res2.data ?? []) as any[];
        } else {
          throw res1.error;
        }
      }

      setCallsByCandidate((prev) => ({ ...prev, [key]: { loading: false, items: data ?? [] } }));
    } catch (e: any) {
      setCallsByCandidate((prev) => ({ ...prev, [key]: { loading: false, error: e?.message ?? "Failed to load calls" } }));
    }
  }

  function toggleExpanded(row: any) {
    const id = String(row.id);
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

    if (selectedCount === 0) setFocusedRow(row);
    ensureCallsLoaded(row);
  }

  return (
    <div className="mt-6">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr,320px] gap-4 items-start">
        {/* LEFT */}
        <div className="space-y-3">
          {selectedCount > 0 && !selectAllMatching && totalMatchingCount > selectedIds.size && (
            <div className="text-base text-gray-600">
              Selected <span className="font-medium">{selectedIds.size}</span> on this page.{" "}
              <button
                className="underline underline-offset-2"
                onClick={() => {
                  setSelectAllMatching(true);
                  setSelectedIds(new Set());
                  setExcludedIds(new Set());
                }}
              >
                Select all {totalMatchingCount} matching candidates
              </button>
              .
            </div>
          )}

          {selectedCount > 0 && selectAllMatching && (
            <div className="text-base text-gray-600">
              All <span className="font-medium">{selectedCount}</span> matching candidates are selected
              {excludedIds.size > 0 ? (
                <>
                  {" "}
                  (excluding <span className="font-medium">{excludedIds.size}</span>)
                </>
              ) : null}
              .{" "}
              <button className="underline underline-offset-2" onClick={() => clearSelection()}>
                Clear selection
              </button>
            </div>
          )}

          <div className="rounded-xl border overflow-hidden bg-white">
            <table className="w-full text-sm">
              <thead className="bg-gray-100">
                <tr className="text-left">
                  <th className="w-10 px-3 py-2">
                    <input
                      ref={headerRef}
                      type="checkbox"
                      checked={allOnPageSelected}
                      onChange={(e) => toggleAllOnPage(e.target.checked)}
                    />
                  </th>
                  <th className="px-6 py-4">Name</th>
                  {show.phone && <th className="px-6 py-4">Phone</th>}
                  {show.roles && <th className="px-6 py-4">Roles</th>}
                  {show.tags && <th className="px-6 py-4">Tags</th>}
                  {show.badges && <th className="px-6 py-4">Badges</th>}
                  {show.last_called && <th className="px-6 py-4">Last called</th>}
                  {show.actions && <th className="px-6 py-4 text-right">Actions</th>}
                </tr>
              </thead>

              <tbody>
                {rows.map((r) => {
                  const id = String(r.id);
                  const isExpanded = expandedIds.has(id);
                  const tags = tagsById[id] ?? [];
                  const cache = callsByCandidate[id];
                  const calls = cache?.items ?? [];

                  const href = r.phone_e164
                    ? `/candidates/${encodeURIComponent(r.phone_e164)}`
                    : `/candidates/${encodeURIComponent(r.id)}`;

                  const preview = (r.last_note_text as string) || (r.last_ai_recap_preview as string) || "";
                  const previewHtml = (r.preview_html as string) || "";

                  return (
                    <>
                      <tr
                        key={r.id}
                        className={`border-t align-top hover:bg-gray-100/60 ${
                          selectedCount === 0 && (focusedRow?.id === r.id || isExpanded) ? "bg-gray-100/80" : ""
                        }`}
                        onMouseEnter={() => { if (selectedCount === 0) setFocusedRow(r); }}
                        onMouseLeave={() => { if (selectedCount === 0 && !isExpanded) setFocusedRow(null); }}
                        onClick={(e) => { if (!shouldIgnoreRowClick(e.target)) toggleExpanded(r); }}
                        role="button"
                        tabIndex={0}
                      >
                        <td className="px-8 py-6">
                          <input
                            type="checkbox"
                            checked={isRowSelected(r.id)}
                            onChange={(e) => toggleRow(String(r.id), e.target.checked)}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </td>

                        <td className="px-8 py-6">
                          <div className="flex items-start gap-2">
                            <button
                              type="button"
                              className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-lg border text-base hover:bg-gray-100"
                              title={isExpanded ? "Collapse" : "Expand"}
                              onClick={(e) => { e.stopPropagation(); toggleExpanded(r); }}
                            >
                              {isExpanded ? "▾" : "▸"}
                            </button>

                            <div className="min-w-0">
                              <Link href={href} className="font-medium hover:underline">
                                {r.name || "Unknown"}
                              </Link>

                              {previewHtml ? (
                                <div className="mt-1 text-base text-gray-600 line-clamp-2">
                                  {r.last_note_text ? "📝 " : "🤖 "}
                                  <span dangerouslySetInnerHTML={{ __html: previewHtml }} />
                                </div>
                              ) : preview ? (
                                <div className="mt-1 text-base text-gray-600 line-clamp-2">
                                  {r.last_note_text ? "📝 " : "🤖 "}
                                  {preview}
                                </div>
                              ) : null}
                            </div>
                          </div>
                        </td>

                        {show.phone && <td className="px-8 py-6 text-gray-700">{r.phone_e164}</td>}
                        {show.roles && <td className="px-8 py-6 text-gray-700">{r.roles}</td>}

                        {show.tags && (
                          <td className="px-8 py-6">
                            {tags.length ? (
                              <div className="flex flex-wrap gap-1.5">
                                {tags.slice(0, 3).map((t) => (
                                  <TagChip key={t} tag={t} />
                                ))}
                                {tags.length > 3 ? <span className="text-base text-gray-500">+{tags.length - 3}</span> : null}
                              </div>
                            ) : (
                              <span className="text-base text-gray-400">—</span>
                            )}
                          </td>
                        )}

                        {show.badges && (
                          <td className="px-8 py-6">
                            <div className="flex flex-wrap gap-1.5">
                              <Badge>{r.status}</Badge>
                              {typeof r.notes_count === "number" && <Badge>📝 {r.notes_count}</Badge>}
                              {typeof r.call_count === "number" && <Badge>📞 {r.call_count}</Badge>}
                              {r.last_energy_score != null && <Badge>⚡ {r.last_energy_score}</Badge>}
                              {r.driver && <Badge>🚗 {r.driver}</Badge>}
                              {r.dbs_update_service && <Badge>DBS {r.dbs_update_service}</Badge>}
                              {r.mandatory_training && <Badge>Trn {r.mandatory_training}</Badge>}
                            </div>
                          </td>
                        )}

                        {show.last_called && (
                          <td className="px-8 py-6 text-gray-700">{fmtWhen(r.last_called_at || r.last_call_time)}</td>
                        )}

                        {show.actions && (
                          <td className="px-8 py-6 text-right">
                            <div className="inline-flex items-center gap-2">
                              <select
                                className="rounded-lg border px-4 py-2 text-xs"
                                value={r.status}
                                onChange={(e) => setStatusSingle(String(r.id), e.target.value as Status)}
                                disabled={busy}
                                onClick={(e) => e.stopPropagation()}
                                title="Change status"
                              >
                                <option value="new">New</option>
                                <option value="shortlisted">Shortlisted</option>
                                <option value="rejected">Rejected</option>
                              </select>

                              <button
                                className="rounded-lg border px-4 py-2 text-base hover:bg-gray-100"
                                onClick={(e) => { e.stopPropagation(); copyPhone(r.phone_e164); }}
                                disabled={busy}
                                type="button"
                              >
                                Copy
                              </button>

                              <button
                                className="rounded-lg border px-4 py-2 text-base hover:bg-gray-100"
                                onClick={(e) => { e.stopPropagation(); setNoteOpen(true); }}
                                disabled={busy}
                                type="button"
                              >
                                Note
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>

                      {isExpanded && (
                        <tr className="border-t bg-white" key={`${r.id}-details`}>
                          <td colSpan={colSpan} className="px-8 py-6">
                            <div className="rounded-xl border bg-gray-100 p-4">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="text-base font-medium">Details</div>
                                <div className="flex items-center gap-2">
                                  <Link href={href} className="rounded-lg border bg-white px-3 py-1.5 text-base hover:bg-gray-100">
                                    Open profile
                                  </Link>
                                  <button
                                    className="rounded-lg border bg-white px-3 py-1.5 text-base hover:bg-gray-100"
                                    onClick={() => copyPhone(r.phone_e164)}
                                    type="button"
                                  >
                                    Copy phone
                                  </button>
                                </div>
                              </div>

                              <div className="mt-3 rounded-xl bg-white p-3">
                                <div className="text-base font-medium text-gray-700 mb-2">Candidate tags</div>
                                {tags.length ? (
                                  <div className="flex flex-wrap gap-1.5">
                                    {tags.map((t) => (
                                      <TagChip
                                        key={t}
                                        tag={t}
                                        onRemove={() => applyCandidateTagMutation({ remove: [t], explicitIds: [id] })}
                                      />
                                    ))}
                                  </div>
                                ) : (
                                  <div className="text-base text-gray-600">No tags.</div>
                                )}
                              </div>

                              <div className="mt-3">
                                <div className="text-base font-medium text-gray-700 mb-2">Recent calls</div>
                                {!cache || cache.loading ? (
                                  <div className="text-base text-gray-600">Loading…</div>
                                ) : cache.error ? (
                                  <div className="text-base text-red-600">Failed: {cache.error}</div>
                                ) : calls.length === 0 ? (
                                  <div className="text-base text-gray-600">No calls found.</div>
                                ) : (
                                  <div className="space-y-2">
                                    {calls.map((c) => (
                                      <div key={String(c.id ?? c.call_time ?? Math.random())} className="rounded-xl border bg-white p-3">
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                          <div className="text-base text-gray-600">
                                            <span className="font-medium">{c.direction ? String(c.direction).toUpperCase() : "CALL"}</span> · {fmtWhen(c.call_time ?? null)}
                                            {c.duration_ms ? <> · {fmtDuration(c.duration_ms)}</> : null}
                                            {c.energy_score != null ? <> · ⚡ {c.energy_score}</> : null}
                                          </div>
                                          {c.recording_url ? (
                                            <a href={String(c.recording_url)} target="_blank" rel="noreferrer" className="text-base underline underline-offset-2 hover:opacity-80">
                                              Recording →
                                            </a>
                                          ) : (
                                            <span className="text-base text-gray-400">No recording</span>
                                          )}
                                        </div>
                                        {c.ai_recap ? (
                                          <div className="mt-2 text-base text-gray-800 leading-snug">
                                            <span className="text-base text-gray-500 mr-2">Recap:</span>
                                            {String(c.ai_recap).length > 280 ? String(c.ai_recap).slice(0, 280) + "…" : String(c.ai_recap)}
                                          </div>
                                        ) : null}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* RIGHT RAIL */}
        <aside className="hidden lg:block">
          <div className="sticky top-6 space-y-3">
            {/* Sort */}
            <div className="rounded-xl border bg-white p-4">
              <div className="text-base font-medium">Sort</div>
              <div className="mt-1 text-base text-gray-500">
                {qTrim ? "Search results are sorted by relevance." : "Saved in URL + saved views."}
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <select
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  value={sort}
                  disabled={!!qTrim}
                  onChange={(e) => setSortInUrl(e.target.value as SortKey)}
                >
                  <option value="last_called">Last called</option>
                  <option value="energy" disabled={weekend !== "any"}>Energy</option>
                  <option value="calls" disabled={weekend !== "any"}>Calls</option>
                  <option value="notes" disabled={weekend !== "any"}>Notes</option>
                  <option value="name" disabled={weekend !== "any"}>Name</option>
                  <option value="relevance" disabled>Relevance</option>
                </select>

                <select
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  value={dir}
                  disabled={!!qTrim || sort === "relevance"}
                  onChange={(e) => setSortInUrl(sort, e.target.value as SortDir)}
                >
                  <option value="desc">Desc</option>
                  <option value="asc">Asc</option>
                </select>
              </div>

              {weekend !== "any" && !qTrim ? (
                <div className="mt-2 text-base text-gray-500">
                  Weekend filter uses RPC mode, so only “Last called” sorting is supported here.
                </div>
              ) : null}
            </div>

            {/* Filter by tags (URL) */}
            <div className="rounded-xl border bg-white p-4">
              <div className="text-base font-medium">Filter by tags</div>
              <div className="mt-1 text-base text-gray-500">Matches candidates containing <span className="font-medium">all</span> selected tags.</div>

              {selectedTags.length ? (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {selectedTags.map((t) => (
                    <TagChip key={t} tag={t} onRemove={() => removeTagFromUrl(t)} />
                  ))}
                </div>
              ) : (
                <div className="mt-3 text-base text-gray-600">No tag filters applied.</div>
              )}

              <div className="mt-3 relative">
                <input
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  placeholder="Type to search tags…"
                  value={tagFilterInput}
                  onChange={(e) => setTagFilterInput(e.target.value)}
                  onFocus={() => setTagFilterOpen(true)}
                  onBlur={() => setTimeout(() => setTagFilterOpen(false), 150)}
                />

                {tagFilterOpen && tagSuggest.length > 0 ? (
                  <div className="absolute z-20 mt-1 w-full rounded-lg border bg-white shadow-lg overflow-hidden">
                    {tagSuggest.map((s) => {
                      const already = selectedTags.includes(s.tag);
                      return (
                        <button
                          type="button"
                          key={s.tag}
                          className="w-full px-3 py-2 text-left text-base hover:bg-gray-100 flex items-center justify-between"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            if (!already) addTagToUrl(s.tag);
                            setTagFilterInput("");
                          }}
                        >
                          <span className="font-medium">{s.tag}</span>
                          <span className="text-base text-gray-500">{already ? "Selected" : `${s.uses} uses`}</span>
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </div>

              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  className="rounded-lg border px-3 py-2 text-base hover:bg-gray-100"
                  onClick={() => {
                    const t = parseTagInput(tagFilterInput);
                    if (!t.length) return;
                    for (const x of t) addTagToUrl(x);
                    setTagFilterInput("");
                  }}
                >
                  Add
                </button>

                <button
                  type="button"
                  className="ml-auto rounded-lg border px-3 py-2 text-base hover:bg-gray-100"
                  onClick={() => setTagsInUrl([])}
                  disabled={!selectedTags.length}
                >
                  Clear
                </button>
              </div>
            </div>

            {/* Edit tags (candidate tags) */}
            <div className="rounded-xl border bg-white p-4">
              <div className="text-base font-medium">Edit candidate tags</div>
              <div className="mt-1 text-base text-gray-500">
                {selectedCount > 0 ? (
                  <>Applies to <span className="font-medium">{selectedCount}</span> selected.</>
                ) : focusedRow ? (
                  <>Applies to hovered candidate.</>
                ) : (
                  <>Hover a row (or select rows) to tag.</>
                )}
              </div>

              <div className="mt-3">
                <input
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  placeholder="e.g. spinal, hoist, driver"
                  value={tagEditInput}
                  onChange={(e) => setTagEditInput(e.target.value)}
                />
              </div>

              <div className="mt-2 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  className="rounded-lg bg-black px-3 py-2 text-base text-white disabled:opacity-60"
                  onClick={addTagsToCandidates}
                  disabled={busy || (!selectedCount && !focusedRow)}
                >
                  Add tags
                </button>

                <button
                  type="button"
                  className="rounded-lg border px-3 py-2 text-base hover:bg-gray-100 disabled:opacity-60"
                  onClick={removeTagsFromCandidates}
                  disabled={busy || (!selectedCount && !focusedRow)}
                >
                  Remove tags
                </button>
              </div>
            </div>

            {/* Columns */}
            <div className="rounded-xl border bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-base font-medium">Columns</div>
                  <div className="mt-0.5 text-base text-gray-500">Saved in URL + saved views.</div>
                </div>
                <button
                  type="button"
                  className="text-base underline underline-offset-2 text-gray-600 hover:text-gray-900"
                  onClick={() => updateCols(DEFAULT_COLS)}
                >
                  Reset
                </button>
              </div>

              <div className="mt-3 space-y-2 text-sm">
                {ALLOWED_COLS.map((c) => (
                  <label key={c} className="flex items-center justify-between gap-2">
                    <span className="capitalize">{c === "last_called" ? "Last called" : c}</span>
                    <input type="checkbox" checked={(show as any)[c]} onChange={(e) => toggleCol(c, e.target.checked)} />
                  </label>
                ))}
              </div>
            </div>

            {/* Focus */}
            {focusedRow ? (
              <FocusedCandidateCard
                row={focusedRow}
                tags={tagsById[String(focusedRow.id)] ?? []}
                onCopyPhone={() => copyPhone(focusedRow.phone_e164)}
                onShortlist={() => setStatusSingle(String(focusedRow.id), "shortlisted")}
                onAddNote={() => setNoteOpen(true)}
              />
            ) : (
              <div className="rounded-xl border bg-white p-4 text-base text-gray-600">
                Hover a candidate to preview.
              </div>
            )}

            {/* Bulk actions quick panel */}
            {selectedCount > 0 ? (
              <div className="rounded-xl border bg-white p-4">
                <div className="text-base font-medium">Bulk actions</div>
                <div className="mt-1 text-base text-gray-500">
                  {selectAllMatching ? "All matching selected (respects tags now)." : "Selected on this page."}
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button className="rounded-lg border px-3 py-2 text-base hover:bg-gray-100" onClick={() => bulkSetStatus("shortlisted")} disabled={busy}>
                    Shortlist
                  </button>
                  <button className="rounded-lg border px-3 py-2 text-base hover:bg-gray-100" onClick={() => bulkSetStatus("rejected")} disabled={busy}>
                    Reject
                  </button>
                  <button className="rounded-lg border px-3 py-2 text-base hover:bg-gray-100" onClick={() => bulkSetStatus("new")} disabled={busy}>
                    Reset
                  </button>
                  <button className="rounded-lg border px-3 py-2 text-base hover:bg-gray-100" onClick={() => setNoteOpen(true)} disabled={busy}>
                    Add note
                  </button>
                </div>

                <button className="mt-2 w-full rounded-lg border px-3 py-2 text-base hover:bg-gray-100" onClick={clearSelection} disabled={busy}>
                  Clear selection
                </button>
              </div>
            ) : null}
          </div>
        </aside>
      </div>

      {/* Note modal */}
      {noteOpen && (
        <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-xl bg-white border shadow-lg p-4 space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="font-medium">Add note</div>
                <div className="text-base text-gray-600">
                  This will add the same note to <span className="font-medium">{selectedCount || 1}</span> candidate(s).
                </div>
              </div>
              <button className="px-2 py-2 rounded-lg border hover:bg-gray-100" onClick={() => setNoteOpen(false)} disabled={busy}>
                ✕
              </button>
            </div>

            <textarea
              className="w-full min-h-[120px] rounded-lg border p-2 text-sm"
              placeholder="Type the note…"
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              disabled={busy}
            />

            <div className="flex justify-end gap-2">
              <button className="rounded-lg border px-3 py-1.5 hover:bg-gray-100" onClick={() => setNoteOpen(false)} disabled={busy}>
                Cancel
              </button>

              <button className="rounded-lg bg-black px-3 py-1.5 text-white disabled:opacity-60" onClick={bulkAddNote} disabled={busy || !noteText.trim()}>
                {busy ? "Adding…" : "Add note"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
