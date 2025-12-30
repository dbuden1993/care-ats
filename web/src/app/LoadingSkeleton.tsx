"use client";

export function RowSkeleton() {
  return (
    <tr className="border-t animate-pulse">
      <td className="px-3 py-3">
        <div className="h-4 w-4 bg-gray-200 rounded"></div>
      </td>
      <td className="px-3 py-3">
        <div className="space-y-2">
          <div className="h-4 bg-gray-200 rounded w-32"></div>
          <div className="h-3 bg-gray-100 rounded w-48"></div>
        </div>
      </td>
      <td className="px-3 py-3">
        <div className="h-4 bg-gray-200 rounded w-28"></div>
      </td>
      <td className="px-3 py-3">
        <div className="h-4 bg-gray-200 rounded w-24"></div>
      </td>
      <td className="px-3 py-3">
        <div className="flex gap-1">
          <div className="h-5 w-12 bg-gray-200 rounded"></div>
          <div className="h-5 w-12 bg-gray-200 rounded"></div>
        </div>
      </td>
      <td className="px-3 py-3">
        <div className="h-4 bg-gray-200 rounded w-20"></div>
      </td>
      <td className="px-3 py-3 text-right">
        <div className="flex justify-end gap-2">
          <div className="h-7 w-20 bg-gray-200 rounded"></div>
          <div className="h-7 w-14 bg-gray-200 rounded"></div>
        </div>
      </td>
    </tr>
  );
}

export function CardSkeleton() {
  return (
    <div className="rounded-xl border bg-white shadow-sm overflow-hidden animate-pulse">
      <div className="p-4 border-b bg-gray-50">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-gray-200 rounded w-32"></div>
            <div className="h-3 bg-gray-100 rounded w-24"></div>
          </div>
          <div className="h-8 w-16 bg-gray-200 rounded"></div>
        </div>
        <div className="mt-3 flex gap-1.5">
          <div className="h-5 w-12 bg-gray-200 rounded"></div>
          <div className="h-5 w-12 bg-gray-200 rounded"></div>
          <div className="h-5 w-12 bg-gray-200 rounded"></div>
        </div>
      </div>
      <div className="p-4 space-y-3">
        <div className="h-3 bg-gray-200 rounded w-full"></div>
        <div className="h-3 bg-gray-100 rounded w-5/6"></div>
        <div className="h-3 bg-gray-100 rounded w-4/6"></div>
      </div>
    </div>
  );
}