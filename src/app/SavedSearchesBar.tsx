"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Saved = {
  id: string;
  name: string;
  params: any;
};

function normalizeParams(p: any) {
  return {
    q: (p?.q ?? "").toString().trim(),
    driver: (p?.driver ?? "any").toString(),
    dbs: (p?.dbs ?? "any").toString(),
    training: (p?.training ?? "any").toString(),
    status: (p?.status ?? "any").toString(),
    weekend: (p?.weekend ?? "any").toString(),
    cols: (p?.cols ?? "").toString().trim(),
    tags: (p?.tags ?? "").toString().trim(),
    sort: (p?.sort ?? "").toString().trim(),
    dir: (p?.dir ?? "").toString().trim(),
  };
}

function sameParams(a: any, b: any) {
  const x = normalizeParams(a);
  const y = normalizeParams(b);
  return (
    x.q === y.q &&
    x.driver === y.driver &&
    x.dbs === y.dbs &&
    x.training === y.training &&
    x.status === y.status &&
    x.weekend === y.weekend &&
    x.cols === y.cols &&
    x.tags === y.tags &&
    x.sort === y.sort &&
    x.dir === y.dir
  );
}

function buildUrlFromParams(p: any) {
  const x = normalizeParams(p);
  const params = new URLSearchParams();

  if (x.q) params.set("q", x.q);
  if (x.driver !== "any") params.set("driver", x.driver);
  if (x.dbs !== "any") params.set("dbs", x.dbs);
  if (x.training !== "any") params.set("training", x.training);
  if (x.weekend !== "any") params.set("weekend", x.weekend);
  if (x.status !== "any") params.set("status", x.status);
  if (x.cols) params.set("cols", x.cols);
  if (x.tags) params.set("tags", x.tags);
  if (x.sort) params.set("sort", x.sort);
  if (x.dir) params.set("dir", x.dir);

  params.set("page", "1");
  params.set("ps", "50");

  const qs = params.toString();
  return qs ? `/?${qs}` : `/`;
}

export default function SavedSearchesBar({
  current,
}: {
  current: {
    q: string;
    driver: string;
    dbs: string;
    training: string;
    status: string;
    weekend: string;
    cols: string;
    tags: string;
    sort: string;
    dir: string;
  };
}) {
  const router = useRouter();

  const [items, setItems] = useState<Saved[]>([]);
  const [loading, setLoading] = useState(false);

  const dragIdRef = useRef<string | null>(null);

  const currentParams = useMemo(() => normalizeParams(current), [current]);

  async function refresh() {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("list_saved_searches");
      if (error) throw error;
      setItems((data ?? []) as any);
    } catch (e: any) {
      alert(e?.message ?? "Failed to load saved views");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function saveCurrent() {
    const defaultName =
      currentParams.q ||
      [
        currentParams.status,
        currentParams.driver,
        currentParams.dbs,
        currentParams.training,
        currentParams.weekend !== "any" ? `weekend:${currentParams.weekend}` : "",
        currentParams.tags ? `tags:${currentParams.tags}` : "",
        currentParams.sort ? `sort:${currentParams.sort}` : "",
      ]
        .filter((x) => x && x !== "any")
        .join(" • ") ||
      "Saved view";

    const name = window.prompt("Name this saved view:", defaultName);
    if (!name) return;

    setLoading(true);
    try {
      const { error } = await supabase.rpc("create_saved_search", {
        p_name: name,
        p_params: currentParams,
      });
      if (error) throw error;
      await refresh();
    } catch (e: any) {
      alert(e?.message ?? "Failed to save view");
    } finally {
      setLoading(false);
    }
  }

  async function deleteOne(id: string) {
    if (!confirm("Delete this saved view?")) return;

    setLoading(true);
    try {
      const { error } = await supabase.rpc("delete_saved_search", { p_id: id });
      if (error) throw error;
      await refresh();
    } catch (e: any) {
      alert(e?.message ?? "Failed to delete");
    } finally {
      setLoading(false);
    }
  }

  async function renameOne(id: string, currentName: string) {
    const name = window.prompt("Rename saved view:", currentName);
    if (!name || !name.trim()) return;

    setLoading(true);
    try {
      const { error } = await supabase.rpc("rename_saved_search", { p_id: id, p_name: name.trim() });
      if (error) throw error;
      setItems((prev) => prev.map((x) => (x.id === id ? { ...x, name: name.trim() } : x)));
    } catch (e: any) {
      alert(e?.message ?? "Failed to rename");
    } finally {
      setLoading(false);
    }
  }

  async function copyLink(p: any) {
    const url = buildUrlFromParams(p);
    try {
      await navigator.clipboard.writeText(window.location.origin + url);
      alert("Link copied");
    } catch {
      alert("Could not copy link (browser blocked clipboard).");
    }
  }

  function moveIdBefore(list: Saved[], dragId: string, targetId: string) {
    if (dragId === targetId) return list;
    const fromIdx = list.findIndex((x) => x.id === dragId);
    const toIdx = list.findIndex((x) => x.id === targetId);
    if (fromIdx === -1 || toIdx === -1) return list;

    const next = [...list];
    const [moved] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, moved);
    return next;
  }

  async function persistOrder(next: Saved[]) {
    setLoading(true);
    try {
      const ids = next.map((x) => x.id);
      const { error } = await supabase.rpc("reorder_saved_searches", { p_ids: ids });
      if (error) throw error;
    } catch (e: any) {
      alert(e?.message ?? "Failed to reorder");
      await refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-4 rounded-lg border bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-medium">Saved views</div>
        <button
          type="button"
          onClick={saveCurrent}
          disabled={loading}
          className="rounded-md border px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-60"
        >
          Save current
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {items.length === 0 ? (
          <div className="text-sm text-gray-600">No saved views yet. Use <span className="font-medium">Save current</span>.</div>
        ) : (
          items.map((s) => {
            const active = sameParams(s.params, currentParams);
            const url = buildUrlFromParams(s.params);

            return (
              <div
                key={s.id}
                className={`inline-flex items-center gap-1 rounded-full border bg-white ${active ? "ring-2 ring-black/10" : ""}`}
                draggable
                onDragStart={() => { dragIdRef.current = s.id; }}
                onDragEnd={() => { dragIdRef.current = null; }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  const dragId = dragIdRef.current;
                  if (!dragId) return;
                  const next = moveIdBefore(items, dragId, s.id);
                  setItems(next);
                  persistOrder(next);
                }}
                title="Drag to reorder"
              >
                <button type="button" className="px-3 py-1 text-sm hover:bg-gray-50 rounded-l-full" onClick={() => router.push(url)} title="Open view">
                  {s.name}
                </button>

                <button type="button" className="px-2 py-1 text-sm text-gray-500 hover:bg-gray-50" onClick={() => copyLink(s.params)} title="Copy link">
                  ⧉
                </button>

                <button type="button" className="px-2 py-1 text-sm text-gray-500 hover:bg-gray-50" onClick={() => renameOne(s.id, s.name)} title="Rename">
                  ✎
                </button>

                <button type="button" className="px-2 py-1 text-sm text-gray-500 hover:bg-gray-50 rounded-r-full" onClick={() => deleteOne(s.id)} title="Delete">
                  ✕
                </button>
              </div>
            );
          })
        )}
      </div>

      {loading ? <div className="mt-2 text-xs text-gray-500">Saving…</div> : null}
      <div className="mt-2 text-xs text-gray-500">Saved views include columns, tags and sort.</div>
    </div>
  );
}
