'use client';

// src/app/app/calls/CallsListClient.tsx
import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { normalizeCalls, type CallRow } from '@/lib/adapters/calls';

type Props = {
  initialCalls: CallRow[];
  totalCount: number;
  currentPage: number;
  pageSize: number;
};

function Badge({ children, color = 'gray' }: { children: React.ReactNode; color?: string }) {
  const colors = {
    gray: 'bg-gray-100 text-gray-700',
    green: 'bg-green-100 text-green-700',
    yellow: 'bg-yellow-100 text-yellow-700',
    red: 'bg-red-100 text-red-700',
    blue: 'bg-blue-100 text-blue-700',
  };
  
  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold ${colors[color as keyof typeof colors] || colors.gray}`}>
      {children}
    </span>
  );
}

function EnergyBadge({ score }: { score: number | null }) {
  if (!score) return <Badge color="gray">No score</Badge>;
  
  const color = score >= 4 ? 'green' : score >= 3 ? 'yellow' : 'red';
  return <Badge color={color}>⚡ {score}/5</Badge>;
}

function QualityBadge({ quality }: { quality: string | null }) {
  if (!quality) return null;
  
  const upper = quality.toUpperCase();
  let color = 'gray';
  if (upper.includes('HIGH')) color = 'green';
  else if (upper.includes('MEDIUM')) color = 'yellow';
  else if (upper.includes('LOW')) color = 'red';
  
  return <Badge color={color}>{quality}</Badge>;
}

export default function CallsListClient({ initialCalls, totalCount, currentPage, pageSize }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(searchParams.get('q') || '');
  
  const calls = normalizeCalls(initialCalls);
  const totalPages = Math.ceil(totalCount / pageSize);
  
  const updateFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    params.set('page', '1'); // Reset to page 1
    router.push(`/app/calls?${params.toString()}`);
  };
  
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    updateFilter('q', search);
  };
  
  const clearFilters = () => {
    router.push('/app/calls');
  };
  
  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <form onSubmit={handleSearch} className="grid gap-4 md:grid-cols-5">
          <input
            type="search"
            placeholder="Search calls..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          
          <select
            onChange={(e) => updateFilter('direction', e.target.value)}
            defaultValue={searchParams.get('direction') || ''}
            className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Directions</option>
            <option value="inbound">Inbound</option>
            <option value="outbound">Outbound</option>
          </select>
          
          <select
            onChange={(e) => updateFilter('energy_min', e.target.value)}
            defaultValue={searchParams.get('energy_min') || ''}
            className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Any Energy</option>
            <option value="4">High (4-5)</option>
            <option value="3">Medium (3+)</option>
            <option value="1">All Scored</option>
          </select>
          
          <select
            onChange={(e) => updateFilter('has_candidate', e.target.value)}
            defaultValue={searchParams.get('has_candidate') || ''}
            className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Calls</option>
            <option value="yes">Linked</option>
            <option value="no">Unlinked</option>
          </select>
          
          <button
            type="submit"
            className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
          >
            Search
          </button>
        </form>
        
        {(searchParams.get('q') || searchParams.get('direction') || searchParams.get('energy_min') || searchParams.get('has_candidate')) && (
          <button
            onClick={clearFilters}
            className="mt-4 text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            Clear all filters
          </button>
        )}
      </div>
      
      {/* Results count */}
      <div className="flex items-center justify-between">
        <p className="text-gray-600">
          Showing <span className="font-semibold text-gray-900">{calls.length}</span> of{' '}
          <span className="font-semibold text-gray-900">{totalCount}</span> calls
        </p>
      </div>
      
      {/* Calls table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Time
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Phone / Candidate
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Direction
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Duration
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                AI Recap Preview
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Quality
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Energy
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {calls.map((call) => (
              <tr
                key={call.id}
                className="hover:bg-gray-50 transition-colors cursor-pointer"
                onClick={() => router.push(`/app/calls/${call.id}`)}
              >
                <td className="px-6 py-4 text-sm text-gray-900 whitespace-nowrap">
                  {call.callTime ? new Date(call.callTime).toLocaleString() : 'Unknown'}
                </td>
                <td className="px-6 py-4">
                  <div className="text-sm">
                    <div className="font-medium text-gray-900">{call.phone}</div>
                    {call.candidateId ? (
                      <Link
                        href={`/app/candidates/${call.candidateId}`}
                        className="text-blue-600 hover:text-blue-700"
                        onClick={(e) => e.stopPropagation()}
                      >
                        View Candidate →
                      </Link>
                    ) : (
                      <span className="text-gray-500">Not linked</span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <Badge color={call.direction === 'inbound' ? 'blue' : 'gray'}>
                    {call.direction === 'inbound' ? '📞 Inbound' : '📱 Outbound'}
                  </Badge>
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">
                  {call.durationFormatted}
                </td>
                <td className="px-6 py-4 text-sm text-gray-600 max-w-md">
                  <div className="truncate">
                    {call.recapBullets[0] || 'No recap'}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <QualityBadge quality={call.qualityAssessment} />
                </td>
                <td className="px-6 py-4">
                  <EnergyBadge score={call.energyScore} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <button
            onClick={() => updateFilter('page', String(currentPage - 1))}
            disabled={currentPage <= 1}
            className="px-6 py-3 border border-gray-300 rounded-lg font-medium hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Previous
          </button>
          
          <span className="text-gray-600">
            Page <span className="font-semibold text-gray-900">{currentPage}</span> of{' '}
            <span className="font-semibold text-gray-900">{totalPages}</span>
          </span>
          
          <button
            onClick={() => updateFilter('page', String(currentPage + 1))}
            disabled={currentPage >= totalPages}
            className="px-6 py-3 border border-gray-300 rounded-lg font-medium hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
