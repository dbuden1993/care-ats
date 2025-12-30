"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, useRef } from "react";

export default function AISearchBar() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("q") || "");
  const [isSearching, setIsSearching] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setQuery(searchParams.get("q") || "");
  }, [searchParams]);

  function handleChange(value: string) {
    setQuery(value);
    setIsSearching(true);

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (value.trim()) {
        params.set("q", value.trim());
      } else {
        params.delete("q");
      }
      params.set("page", "1");
      router.push(`/?${params.toString()}`);
      setIsSearching(false);
    }, 500);
  }

  return (
    <div className="mt-4 bg-white rounded-xl border border-gray-200 shadow-sm">
      <div className="p-6">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-lg">🔍</span>
          <div className="font-semibold text-sm text-gray-900">AI-Powered Search</div>
          {isSearching && (
            <div className="ml-auto flex items-center gap-1.5 text-xs text-gray-500">
              <div className="animate-spin h-3 w-3 border-2 border-blue-500 border-t-transparent rounded-full"></div>
              Searching...
            </div>
          )}
        </div>
        <input
          type="text"
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          placeholder='Try: "energetic spinal driver" or "qualified hoist weekend"'
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <div className="mt-2 text-xs text-gray-500">
          Searches across names, roles, notes, and call transcripts
        </div>
      </div>
    </div>
  );
}
