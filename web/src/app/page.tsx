import Link from "next/link";
import { supabase } from "@/lib/supabase";
import CandidatesTableClient from "./CandidatesTableClient";
import AISearchBar from "./AISearchBar";
import SavedSearchesBar from "./SavedSearchesBar";
import AppliedFilterChips from "./AppliedFilterChips";
import { colsToParam, parseColsParam } from "./columns";

type AnySP = Record<string, unknown>;

function oneOf<T extends string>(v: unknown, allowed: readonly T[], fallback: T): T {
  const s = typeof v === "string" ? v : "";
  return (allowed as readonly string[]).includes(s) ? (s as T) : fallback;
}

function parseTagsParam(raw: unknown): string[] {
  const s = typeof raw === "string" ? raw : "";
  const parts = s
    .split(",")
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean);
  return Array.from(new Set(parts));
}

type SortKey = "last_called" | "energy" | "calls" | "notes" | "name" | "relevance";
type SortDir = "asc" | "desc";

function defaultSortDir(sort: SortKey): SortDir {
  if (sort === "name") return "asc";
  return "desc";
}

export default async function Page({ searchParams }: { searchParams: AnySP }) {
  const sp = await Promise.resolve(searchParams ?? {});

  const q = (sp.q as string) || "";
  const qTrim = q.trim();

  const driver = oneOf(sp.driver, ["any", "Yes", "No", "Unknown"] as const, "any");
  const dbs = oneOf(sp.dbs, ["any", "Yes", "No", "Unknown"] as const, "any");
  const training = oneOf(sp.training, ["any", "Yes", "No", "Unknown"] as const, "any");
  const status = oneOf(sp.status, ["any", "new", "shortlisted", "rejected"] as const, "any");
  const weekend = oneOf(sp.weekend, ["any", "yes", "no"] as const, "any");

  const tags = parseTagsParam(sp.tags);

  const usingSearch = !!qTrim;
  const useRpc = usingSearch || weekend !== "any";

  const sortDefault: SortKey = usingSearch ? "relevance" : "last_called";
  let sort = oneOf(
    sp.sort,
    ["last_called", "energy", "calls", "notes", "name", "relevance"] as const,
    sortDefault
  );

  // keep RPC mode sane
  if (usingSearch) sort = "relevance";
  if (!usingSearch && useRpc && weekend !== "any" && sort !== "last_called") sort = "last_called";

  const dirDefault: SortDir = defaultSortDir(sort);
  const dir = oneOf(sp.dir, ["asc", "desc"] as const, dirDefault);

  const visibleCols = parseColsParam(sp.cols);
  const colsParam = colsToParam(visibleCols);

  const pageSize = Math.min(Math.max(parseInt((sp.ps as string) || "50", 10) || 50, 1), 200);
  const page = Math.max(parseInt((sp.page as string) || "1", 10) || 1, 1);
  const offset = (page - 1) * pageSize;

  const selectCols =
    "id, phone_e164, name, roles, status, driver, dbs_update_service, mandatory_training, last_called_at, last_call_time, last_energy_score, notes_count, call_count, last_note_text, last_ai_recap_preview";

  let data: any[] | null = null;
  let error: any = null;
  let totalMatchingCount = 0;

  if (useRpc) {
    const { data: rpcData, error: rpcError } = await supabase.rpc("search_candidates_list_highlight2", {
      p_query: qTrim ? qTrim : null,
      p_driver: driver !== "any" ? driver : null,
      p_dbs_update_service: dbs !== "any" ? dbs : null,
      p_mandatory_training: training !== "any" ? training : null,
      p_status: status !== "any" ? status : null,
      p_weekend: weekend === "any" ? null : weekend === "yes",
      p_limit: pageSize,
      p_offset: offset,
    });

    let rows = (rpcData ?? []) as any[];

    // Tags filter for RPC results (enforce ALL tags)
    if (tags.length) {
      const ids = rows.map((r) => r.id).filter(Boolean);
      if (ids.length) {
        const { data: tagRows } = await supabase.from("candidates").select("id,tags").in("id", ids);
        const map = new Map<string, string[]>();
        for (const tr of tagRows ?? []) map.set(String((tr as any).id), (tr as any).tags ?? []);
        rows = rows.filter((r) => {
          const t = map.get(String(r.id)) ?? [];
          return tags.every((x) => t.includes(x));
        });
      } else {
        rows = [];
      }
    }

    data = rows;
    error = rpcError;
    totalMatchingCount = (data?.[0]?.total_count ?? data.length) as number;
  } else {
    // ✅ IMPORTANT FIX: use view that includes tags
    let query = supabase
      .from("candidates_list_view_with_tags")
      .select(selectCols, { count: "exact" })
      .range(offset, offset + pageSize - 1);

    if (driver !== "any") query = query.eq("driver", driver);
    if (dbs !== "any") query = query.eq("dbs_update_service", dbs);
    if (training !== "any") query = query.eq("mandatory_training", training);
    if (status !== "any") query = query.eq("status", status);

    // Tags filter (ALL tags)
    if (tags.length) query = query.contains("tags", tags);

    // Sorting
    if (sort === "last_called") {
      query = query.order("last_called_at", { ascending: dir === "asc", nullsFirst: false });
    } else if (sort === "energy") {
      query = query.order("last_energy_score", { ascending: dir === "asc", nullsFirst: false });
    } else if (sort === "calls") {
      query = query.order("call_count", { ascending: dir === "asc", nullsFirst: false });
    } else if (sort === "notes") {
      query = query.order("notes_count", { ascending: dir === "asc", nullsFirst: false });
    } else if (sort === "name") {
      query = query.order("name", { ascending: dir === "asc", nullsFirst: false });
    } else {
      query = query.order("last_called_at", { ascending: false, nullsFirst: false });
    }

    const res = await query;
    data = (res.data ?? []) as any[];
    error = res.error;
    totalMatchingCount = (res.count ?? data.length) as number;
  }

  function tabClass(active: boolean) {
    return `rounded-lg border px-6 py-3 text-base ${active ? "bg-black text-white border-black" : "hover:bg-gray-50"}`;
  }

  function buildHref(overrides: Partial<{ status: string; page: number }>) {
    const params = new URLSearchParams();

    if (qTrim) params.set("q", qTrim);
    if (driver !== "any") params.set("driver", driver);
    if (dbs !== "any") params.set("dbs", dbs);
    if (training !== "any") params.set("training", training);
    if (weekend !== "any") params.set("weekend", weekend);
    if (colsParam) params.set("cols", colsParam);
    if (tags.length) params.set("tags", tags.join(","));

    // sort/dir only when meaningful (and not search relevance)
    if (!usingSearch) {
      if (sort !== "last_called") params.set("sort", sort);
      if (dir !== defaultSortDir(sort)) params.set("dir", dir);
    }

    const finalStatus = overrides.status ?? status;
    if (finalStatus !== "any") params.set("status", finalStatus);

    const finalPage = overrides.page ?? page;
    params.set("page", String(finalPage));
    params.set("ps", String(pageSize));

    const qs = params.toString();
    return qs ? `/?${qs}` : "/";
  }

  function tabHref(nextStatus: "any" | "new" | "shortlisted" | "rejected") {
    return buildHref({ status: nextStatus, page: 1 });
  }

  function pageHref(nextPage: number) {
    return buildHref({ page: nextPage });
  }

  const totalPages = Math.max(1, Math.ceil((totalMatchingCount || 0) / pageSize));
  const from = totalMatchingCount ? offset + 1 : 0;
  const to = totalMatchingCount ? Math.min(offset + (data?.length ?? 0), totalMatchingCount) : 0;
  const hasPrev = page > 1;
  const hasNext = page < totalPages;

  return (
    <main className="mx-auto max-w-6xl p-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-5xl font-semibold">Candidates</h1>
        <Link href="/pipeline" className="rounded-lg border px-6 py-3 text-base hover:bg-gray-50">
          Pipeline
        </Link>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Link href={tabHref("any")} className={tabClass(status === "any")}>All</Link>
        <Link href={tabHref("new")} className={tabClass(status === "new")}>New</Link>
        <Link href={tabHref("shortlisted")} className={tabClass(status === "shortlisted")}>Shortlisted</Link>
        <Link href={tabHref("rejected")} className={tabClass(status === "rejected")}>Rejected</Link>
      </div>

      <AISearchBar />

      <SavedSearchesBar
        current={{
          q,
          driver,
          dbs,
          training,
          status,
          weekend,
          cols: colsParam,
          tags: tags.join(","),
          sort: sort,
          dir: dir,
        }}
      />

      <form className="mt-4 grid gap-3 rounded-xl border p-4 md:grid-cols-4">
        <input
          name="q"
          defaultValue={q}
          placeholder='Search… e.g. "spinal energetic driver"'
          className="w-full rounded-lg border px-3 py-2"
        />

        <select name="driver" defaultValue={driver} className="w-full rounded-lg border px-3 py-2">
          <option value="any">Driver: Any</option>
          <option value="Yes">Driver: Yes</option>
          <option value="No">Driver: No</option>
          <option value="Unknown">Driver: Unknown</option>
        </select>

        <select name="dbs" defaultValue={dbs} className="w-full rounded-lg border px-3 py-2">
          <option value="any">DBS Update: Any</option>
          <option value="Yes">DBS Update: Yes</option>
          <option value="No">DBS Update: No</option>
          <option value="Unknown">DBS Update: Unknown</option>
        </select>

        <select name="training" defaultValue={training} className="w-full rounded-lg border px-3 py-2">
          <option value="any">Training: Any</option>
          <option value="Yes">Training: Yes</option>
          <option value="No">Training: No</option>
          <option value="Unknown">Training: Unknown</option>
        </select>

        <select name="status" defaultValue={status} className="w-full rounded-lg border px-3 py-2">
          <option value="any">Status: Any</option>
          <option value="new">Status: New</option>
          <option value="shortlisted">Status: Shortlisted</option>
          <option value="rejected">Status: Rejected</option>
        </select>

        <div className="md:col-span-4 flex items-center gap-2">
          <div className="text-base text-gray-700">Weekend</div>
          <div className="inline-flex rounded-lg border overflow-hidden">
            <label className={`px-3 py-2 text-base cursor-pointer ${weekend === "any" ? "bg-gray-100" : "bg-white hover:bg-gray-50"}`}>
              <input type="radio" name="weekend" value="any" defaultChecked={weekend === "any"} className="hidden" />
              Any
            </label>
            <label className={`px-3 py-2 text-base cursor-pointer border-l ${weekend === "yes" ? "bg-gray-100" : "bg-white hover:bg-gray-50"}`}>
              <input type="radio" name="weekend" value="yes" defaultChecked={weekend === "yes"} className="hidden" />
              Yes
            </label>
            <label className={`px-3 py-2 text-base cursor-pointer border-l ${weekend === "no" ? "bg-gray-100" : "bg-white hover:bg-gray-50"}`}>
              <input type="radio" name="weekend" value="no" defaultChecked={weekend === "no"} className="hidden" />
              No
            </label>
          </div>
        </div>

        <input type="hidden" name="tags" value={tags.join(",")} />
        <input type="hidden" name="sort" value={sort} />
        <input type="hidden" name="dir" value={dir} />
        <input type="hidden" name="cols" value={colsParam} />

        <div className="md:col-span-4 flex gap-2">
          <button className="rounded-lg bg-black px-8 py-4 text-white">Search</button>
          <Link className="rounded-lg border px-8 py-4" href="/">
            Reset
          </Link>
        </div>
      </form>

      <AppliedFilterChips />

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <div className="text-base text-gray-600">
          {totalMatchingCount ? (
            <>
              Showing <span className="font-medium">{from}</span>–<span className="font-medium">{to}</span> of{" "}
              <span className="font-medium">{totalMatchingCount}</span>
            </>
          ) : (
            <>No results</>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={pageHref(Math.max(1, page - 1))}
            className={`rounded-lg border px-6 py-3 text-base ${hasPrev ? "hover:bg-gray-50" : "opacity-50 pointer-events-none"}`}
          >
            Prev
          </Link>
          <div className="text-base text-gray-600">
            Page <span className="font-medium">{page}</span> / <span className="font-medium">{totalPages}</span>
          </div>
          <Link
            href={pageHref(Math.min(totalPages, page + 1))}
            className={`rounded-lg border px-6 py-3 text-base ${hasNext ? "hover:bg-gray-50" : "opacity-50 pointer-events-none"}`}
          >
            Next
          </Link>
        </div>
      </div>

      {error && (
        <div className="mt-6 rounded-xl border p-4 text-base text-red-600">
          Error loading candidates: {error.message}
        </div>
      )}

      {!error && (data?.length ?? 0) === 0 && (
        <div className="mt-6 rounded-xl border p-4 text-base text-gray-600">No matches.</div>
      )}

      {!error && (data?.length ?? 0) > 0 && (
        <CandidatesTableClient
          rows={data as any[]}
          totalMatchingCount={totalMatchingCount ?? 0}
          filters={{ q, driver, dbs, training, status, weekend, tags }}
          initialCols={visibleCols}
        />
      )}
    </main>
  );
}
