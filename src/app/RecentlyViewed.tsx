"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type RecentCandidate = {
  id: string;
  name: string;
  phone_e164: string;
  timestamp: number;
};

export default function RecentlyViewed() {
  const [recent, setRecent] = useState<RecentCandidate[]>([]);

  useEffect(() => {
    // Load from localStorage
    try {
      const stored = localStorage.getItem("careATS.recentlyViewed");
      if (stored) {
        setRecent(JSON.parse(stored));
      }
    } catch {}
  }, []);

  if (recent.length === 0) return null;

  return (
    <div className="rounded-xl border bg-white p-4">
      <div className="text-sm font-medium mb-3">Recently Viewed</div>
      <div className="space-y-2">
        {recent.slice(0, 5).map((c) => {
          const href = c.phone_e164
            ? `/candidates/${encodeURIComponent(c.phone_e164)}`
            : `/candidates/${encodeURIComponent(c.id)}`;
          
          return (
            <Link
              key={c.id}
              href={href}
              className="block p-2 rounded-md hover:bg-gray-50 border text-sm"
            >
              <div className="font-medium text-gray-900 truncate">{c.name}</div>
              <div className="text-xs text-gray-500 truncate">{c.phone_e164}</div>
            </Link>
          );
        })}
      </div>
      <button
        onClick={() => {
          localStorage.removeItem("careATS.recentlyViewed");
          setRecent([]);
        }}
        className="mt-3 text-xs text-gray-500 hover:text-gray-700 underline"
      >
        Clear history
      </button>
    </div>
  );
}