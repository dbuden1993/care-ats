"use client";

import { useRouter, useSearchParams } from "next/navigation";

type QuickFilter = {
  label: string;
  icon: string;
  params: Record<string, string>;
};

const QUICK_FILTERS: QuickFilter[] = [
  {
    label: "Called Today",
    icon: "📞",
    params: { sort: "last_called", dir: "desc" },
  },
  {
    label: "High Energy",
    icon: "⚡",
    params: { sort: "energy", dir: "desc" },
  },
  {
    label: "Shortlisted",
    icon: "⭐",
    params: { status: "shortlisted" },
  },
  {
    label: "New Candidates",
    icon: "🆕",
    params: { status: "new", sort: "last_called", dir: "desc" },
  },
  {
    label: "Weekend Available",
    icon: "🗓️",
    params: { weekend: "yes" },
  },
  {
    label: "Has Driver",
    icon: "🚗",
    params: { driver: "yes" },
  },
];

export default function QuickFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();

  function applyFilter(filter: QuickFilter) {
    const params = new URLSearchParams(searchParams.toString());
    
    Object.entries(filter.params).forEach(([key, value]) => {
      params.set(key, value);
    });
    
    params.set("page", "1");
    router.push(`/?${params.toString()}`);
  }

  function clearFilters() {
    router.push("/");
  }

  const hasActiveFilters = 
    searchParams.get("status") || 
    searchParams.get("driver") || 
    searchParams.get("weekend") ||
    searchParams.get("q");

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
      <div className="p-6">
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm font-semibold text-gray-900">Quick Filters</div>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="text-xs text-blue-600 hover:text-blue-700 font-medium"
            >
              Clear all
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {QUICK_FILTERS.map((filter) => (
            <button
              key={filter.label}
              onClick={() => applyFilter(filter)}
              className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 hover:bg-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors"
            >
              <span>{filter.icon}</span>
              <span>{filter.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}