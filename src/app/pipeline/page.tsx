import Link from "next/link";
import { supabase } from "@/lib/supabase";
import PipelineBoardClient from "./PipelineBoardClient";

export default async function Page({ searchParams }: { searchParams: any }) {
  const sp = await Promise.resolve(searchParams ?? {});

  const q = (sp.q as string) || "";
  const driver = (sp.driver as string) || "any";
  const dbs = (sp.dbs as string) || "any";
  const training = (sp.training as string) || "any";

  const cols =
    "id, phone_e164, name, roles, status, driver, dbs_update_service, mandatory_training, last_called_at, last_call_time, last_energy_score, notes_count, call_count, last_note_text, last_ai_recap_preview, search_doc";

  const buildQuery = (status: "new" | "shortlisted" | "rejected") => {
    let query = supabase
      .from("candidates_list_view")
      .select(cols, { count: "exact" })
      .eq("status", status)
      .order("last_called_at", { ascending: false, nullsFirst: false })
      .limit(200);

    if (q.trim()) query = query.textSearch("search_doc", q.trim(), { type: "websearch" });
    if (driver !== "any") query = query.eq("driver", driver);
    if (dbs !== "any") query = query.eq("dbs_update_service", dbs);
    if (training !== "any") query = query.eq("mandatory_training", training);

    return query;
  };

  const [newRes, shortRes, rejRes] = await Promise.all([
    buildQuery("new"),
    buildQuery("shortlisted"),
    buildQuery("rejected"),
  ]);

  const newErr = newRes.error;
  const shortErr = shortRes.error;
  const rejErr = rejRes.error;
  const error = newErr || shortErr || rejErr;

  const board = {
    new: newRes.data ?? [],
    shortlisted: shortRes.data ?? [],
    rejected: rejRes.data ?? [],
  };

  const counts = {
    new: newRes.count ?? (newRes.data?.length ?? 0),
    shortlisted: shortRes.count ?? (shortRes.data?.length ?? 0),
    rejected: rejRes.count ?? (rejRes.data?.length ?? 0),
  };

  return (
    <main className="mx-auto max-w-6xl p-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Pipeline</h1>

        <div className="flex items-center gap-2">
          <Link href="/" className="rounded-md border px-3 py-1 text-sm hover:bg-gray-50">
            List
          </Link>
          <Link href="/pipeline" className="rounded-md border px-3 py-1 text-sm hover:bg-gray-50">
            Pipeline
          </Link>
        </div>
      </div>

      <form className="mt-4 grid gap-3 rounded-lg border p-4 md:grid-cols-4">
        <input
          name="q"
          defaultValue={q}
          placeholder='Search… e.g. "spinal energetic driver"'
          className="w-full rounded-md border px-3 py-2"
        />

        <select name="driver" defaultValue={driver} className="w-full rounded-md border px-3 py-2">
          <option value="any">Driver: Any</option>
          <option value="Yes">Driver: Yes</option>
          <option value="No">Driver: No</option>
          <option value="Unknown">Driver: Unknown</option>
        </select>

        <select name="dbs" defaultValue={dbs} className="w-full rounded-md border px-3 py-2">
          <option value="any">DBS Update: Any</option>
          <option value="Yes">DBS Update: Yes</option>
          <option value="No">DBS Update: No</option>
          <option value="Unknown">DBS Update: Unknown</option>
        </select>

        <select
          name="training"
          defaultValue={training}
          className="w-full rounded-md border px-3 py-2"
        >
          <option value="any">Training: Any</option>
          <option value="Yes">Training: Yes</option>
          <option value="No">Training: No</option>
          <option value="Unknown">Training: Unknown</option>
        </select>

        <div className="md:col-span-4 flex gap-2">
          <button className="rounded-md bg-black px-4 py-2 text-white">Search</button>
          <Link
            className="rounded-md border px-4 py-2"
            href="/pipeline"
          >
            Reset
          </Link>
        </div>
      </form>

      {error && (
        <div className="mt-6 rounded-lg border p-4 text-sm text-red-600">
          Error loading pipeline: {error.message}
        </div>
      )}

      {!error && (
        <div className="mt-6">
          <PipelineBoardClient
            initialBoard={board as any}
            initialCounts={counts}
          />
        </div>
      )}
    </main>
  );
}
