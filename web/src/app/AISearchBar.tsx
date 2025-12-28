"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { buildSearchUrl, parseAISearch } from "@/lib/aiSearch";

export default function AISearchBar() {
  const [text, setText] = useState("");
  const sp = useSearchParams();

  const parsed = useMemo(() => parseAISearch(text), [text]);
  const urlBase = useMemo(() => buildSearchUrl("/", parsed), [parsed]);

  const url = useMemo(() => {
    const cols = (sp.get("cols") ?? "").trim();
    if (!cols) return urlBase;

    const joiner = urlBase.includes("?") ? "&" : "?";
    return `${urlBase}${joiner}cols=${encodeURIComponent(cols)}`;
  }, [sp, urlBase]);

  function run() {
    window.location.assign(url);
  }

  return (
    <div className="mt-4 rounded-lg border p-4 bg-white">
      <div className="text-sm font-medium">AI search</div>

      <div className="mt-2 flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              run();
            }
          }}
          placeholder='Try: "driver yes dbs yes weekend spinal energetic"'
          className="w-full rounded-md border px-3 py-2"
        />
        <button type="button" onClick={run} className="rounded-md bg-black px-4 py-2 text-white">
          Go
        </button>
      </div>

      <div className="mt-2 text-xs text-gray-600">
        Will apply:{" "}
        <span className="font-medium">
          q="{parsed.q}" · driver={parsed.driver} · dbs={parsed.dbs} · training={parsed.training} · weekend=
          {parsed.weekend} · status={parsed.status}
        </span>
      </div>

      <div className="mt-1 text-xs text-gray-500">
        URL: <span className="font-mono">{url}</span>
      </div>
    </div>
  );
}
