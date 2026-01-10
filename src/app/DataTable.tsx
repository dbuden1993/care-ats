'use client';
import { useState, useMemo } from 'react';
import Tooltip from './Tooltip';

interface Column<T> {
  key: string;
  header: string;
  width?: number | string;
  sortable?: boolean;
  render?: (value: any, row: T) => React.ReactNode;
}

interface Props<T> {
  data: T[];
  columns: Column<T>[];
  keyField: string;
  selectable?: boolean;
  selected?: Set<string>;
  onSelect?: (selected: Set<string>) => void;
  onRowClick?: (row: T) => void;
  emptyMessage?: string;
  emptyIcon?: string;
  pageSize?: number;
}

export default function DataTable<T extends Record<string, any>>({ 
  data, 
  columns, 
  keyField,
  selectable = false,
  selected = new Set(),
  onSelect,
  onRowClick,
  emptyMessage = 'No data found',
  emptyIcon = '📋',
  pageSize = 20
}: Props<T>) {
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(0);
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);

  const sorted = useMemo(() => {
    if (!sortField) return data;
    return [...data].sort((a, b) => {
      const aVal = a[sortField] ?? '';
      const bVal = b[sortField] ?? '';
      const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [data, sortField, sortDir]);

  const paginated = sorted.slice(page * pageSize, (page + 1) * pageSize);
  const totalPages = Math.ceil(sorted.length / pageSize);

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const toggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newSelected = new Set(selected);
    if (newSelected.has(id)) newSelected.delete(id);
    else newSelected.add(id);
    onSelect?.(newSelected);
  };

  const toggleSelectAll = () => {
    if (selected.size === data.length) onSelect?.(new Set());
    else onSelect?.(new Set(data.map(d => d[keyField])));
  };

  return (
    <div style={{ overflow: 'hidden' }}>
      <style>{`
        .dt-wrap{overflow-x:auto}
        .dt{width:100%;border-collapse:collapse}
        .dt-th{padding:12px 16px;text-align:left;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.5px;background:#fafbfc;border-bottom:2px solid #e5e7eb;position:sticky;top:0;white-space:nowrap}
        .dt-th.sortable{cursor:pointer;user-select:none;transition:color .15s}
        .dt-th.sortable:hover{color:#111}
        .dt-th-content{display:flex;align-items:center;gap:6px}
        .dt-sort{opacity:.3;transition:opacity .15s}
        .dt-th.sorted .dt-sort{opacity:1;color:#4f46e5}
        .dt-tr{border-bottom:1px solid #f3f4f6;transition:background .1s}
        .dt-tr:hover{background:#fafbfc}
        .dt-tr.selected{background:#eef2ff}
        .dt-tr.clickable{cursor:pointer}
        .dt-td{padding:14px 16px;font-size:13px;color:#374151;vertical-align:middle}
        .dt-checkbox{width:20px;height:20px;border:2px solid #d1d5db;border-radius:6px;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all .15s;background:#fff}
        .dt-checkbox:hover{border-color:#6366f1}
        .dt-checkbox.checked{background:#4f46e5;border-color:#4f46e5;color:#fff}
        .dt-empty{text-align:center;padding:60px 20px}
        .dt-empty-icon{font-size:48px;margin-bottom:16px;opacity:.4}
        .dt-empty-text{font-size:14px;color:#9ca3af}
        .dt-pagination{display:flex;align-items:center;justify-content:space-between;padding:16px;border-top:1px solid #e5e7eb;background:#fafbfc}
        .dt-page-info{font-size:13px;color:#6b7280}
        .dt-page-btns{display:flex;gap:4px}
        .dt-page-btn{width:36px;height:36px;display:flex;align-items:center;justify-content:center;border:1px solid #e5e7eb;border-radius:8px;background:#fff;cursor:pointer;font-size:13px;color:#374151;transition:all .15s}
        .dt-page-btn:hover:not(:disabled){background:#f3f4f6;border-color:#d1d5db}
        .dt-page-btn:disabled{opacity:.4;cursor:not-allowed}
        .dt-page-btn.active{background:#4f46e5;border-color:#4f46e5;color:#fff}
      `}</style>

      <div className="dt-wrap">
        <table className="dt">
          <thead>
            <tr>
              {selectable && (
                <th className="dt-th" style={{ width: 50 }}>
                  <div 
                    className={`dt-checkbox ${selected.size === data.length && data.length > 0 ? 'checked' : ''}`}
                    onClick={toggleSelectAll}
                  >
                    {selected.size === data.length && data.length > 0 && '✓'}
                  </div>
                </th>
              )}
              {columns.map(col => (
                <th 
                  key={col.key}
                  className={`dt-th ${col.sortable ? 'sortable' : ''} ${sortField === col.key ? 'sorted' : ''}`}
                  style={{ width: col.width }}
                  onClick={() => col.sortable && handleSort(col.key)}
                >
                  <div className="dt-th-content">
                    {col.header}
                    {col.sortable && (
                      <span className="dt-sort">
                        {sortField === col.key ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}
                      </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginated.length === 0 ? (
              <tr>
                <td colSpan={columns.length + (selectable ? 1 : 0)}>
                  <div className="dt-empty">
                    <div className="dt-empty-icon">{emptyIcon}</div>
                    <div className="dt-empty-text">{emptyMessage}</div>
                  </div>
                </td>
              </tr>
            ) : (
              paginated.map(row => {
                const id = row[keyField];
                const isSelected = selected.has(id);
                const isHovered = hoveredRow === id;
                return (
                  <tr 
                    key={id}
                    className={`dt-tr ${isSelected ? 'selected' : ''} ${onRowClick ? 'clickable' : ''}`}
                    onMouseEnter={() => setHoveredRow(id)}
                    onMouseLeave={() => setHoveredRow(null)}
                    onClick={() => onRowClick?.(row)}
                  >
                    {selectable && (
                      <td className="dt-td">
                        <div 
                          className={`dt-checkbox ${isSelected ? 'checked' : ''}`}
                          onClick={e => toggleSelect(id, e)}
                        >
                          {isSelected && '✓'}
                        </div>
                      </td>
                    )}
                    {columns.map(col => (
                      <td key={col.key} className="dt-td">
                        {col.render ? col.render(row[col.key], row) : row[col.key]}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="dt-pagination">
          <div className="dt-page-info">
            Showing {page * pageSize + 1} to {Math.min((page + 1) * pageSize, sorted.length)} of {sorted.length}
          </div>
          <div className="dt-page-btns">
            <button className="dt-page-btn" disabled={page === 0} onClick={() => setPage(0)}>«</button>
            <button className="dt-page-btn" disabled={page === 0} onClick={() => setPage(p => p - 1)}>‹</button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const pageNum = Math.max(0, Math.min(page - 2, totalPages - 5)) + i;
              if (pageNum >= totalPages) return null;
              return (
                <button 
                  key={pageNum}
                  className={`dt-page-btn ${page === pageNum ? 'active' : ''}`}
                  onClick={() => setPage(pageNum)}
                >
                  {pageNum + 1}
                </button>
              );
            })}
            <button className="dt-page-btn" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>›</button>
            <button className="dt-page-btn" disabled={page >= totalPages - 1} onClick={() => setPage(totalPages - 1)}>»</button>
          </div>
        </div>
      )}
    </div>
  );
}
