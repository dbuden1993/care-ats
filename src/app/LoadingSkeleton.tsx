'use client';

export function CandidateRowSkeleton() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', padding: '14px 20px', gap: 12, borderBottom: '1px solid #f0f0f0' }}>
      <style>{`
        .skeleton { background: linear-gradient(90deg, #f0f0f0 25%, #e8e8e8 50%, #f0f0f0 75%); background-size: 200% 100%; animation: shimmer 1.5s infinite; border-radius: 4px; }
        @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
      `}</style>
      <div className="skeleton" style={{ width: 28, height: 28, borderRadius: 6 }} />
      <div className="skeleton" style={{ width: 40, height: 40, borderRadius: 10 }} />
      <div style={{ flex: 1 }}>
        <div className="skeleton" style={{ width: '60%', height: 14, marginBottom: 6 }} />
        <div className="skeleton" style={{ width: '40%', height: 12 }} />
      </div>
      <div className="skeleton" style={{ width: 100, height: 12 }} />
      <div className="skeleton" style={{ width: 80, height: 24, borderRadius: 6 }} />
      <div style={{ display: 'flex', gap: 4 }}>
        <div className="skeleton" style={{ width: 26, height: 26, borderRadius: 5 }} />
        <div className="skeleton" style={{ width: 26, height: 26, borderRadius: 5 }} />
        <div className="skeleton" style={{ width: 26, height: 26, borderRadius: 5 }} />
      </div>
      <div className="skeleton" style={{ width: 30, height: 30, borderRadius: 6 }} />
      <div className="skeleton" style={{ width: 60, height: 12 }} />
    </div>
  );
}

export function CandidateListSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div>
      {Array.from({ length: count }).map((_, i) => (
        <CandidateRowSkeleton key={i} />
      ))}
    </div>
  );
}

export function KanbanColumnSkeleton() {
  return (
    <div style={{ flex: '0 0 300px', background: '#f9fafb', borderRadius: 12, padding: 16 }}>
      <style>{`
        .skeleton { background: linear-gradient(90deg, #f0f0f0 25%, #e8e8e8 50%, #f0f0f0 75%); background-size: 200% 100%; animation: shimmer 1.5s infinite; border-radius: 4px; }
        @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
      `}</style>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <div className="skeleton" style={{ width: 80, height: 16 }} />
        <div className="skeleton" style={{ width: 24, height: 20, borderRadius: 10 }} />
      </div>
      {[1,2,3].map(i => (
        <div key={i} style={{ background: '#fff', borderRadius: 10, padding: 14, marginBottom: 10, border: '1px solid #e5e7eb' }}>
          <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
            <div className="skeleton" style={{ width: 36, height: 36, borderRadius: 8 }} />
            <div style={{ flex: 1 }}>
              <div className="skeleton" style={{ width: '70%', height: 14, marginBottom: 6 }} />
              <div className="skeleton" style={{ width: '50%', height: 12 }} />
            </div>
          </div>
          <div className="skeleton" style={{ width: '90%', height: 12, marginBottom: 8 }} />
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', gap: 4 }}>
              <div className="skeleton" style={{ width: 22, height: 22, borderRadius: 4 }} />
              <div className="skeleton" style={{ width: 22, height: 22, borderRadius: 4 }} />
              <div className="skeleton" style={{ width: 22, height: 22, borderRadius: 4 }} />
            </div>
            <div className="skeleton" style={{ width: 50, height: 12 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function KanbanSkeleton() {
  return (
    <div style={{ display: 'flex', gap: 16, padding: 20, overflow: 'hidden' }}>
      {[1,2,3,4,5].map(i => <KanbanColumnSkeleton key={i} />)}
    </div>
  );
}

export function StatCardSkeleton() {
  return (
    <div style={{ background: '#f9fafb', borderRadius: 12, padding: 16 }}>
      <style>{`
        .skeleton { background: linear-gradient(90deg, #f0f0f0 25%, #e8e8e8 50%, #f0f0f0 75%); background-size: 200% 100%; animation: shimmer 1.5s infinite; border-radius: 4px; }
        @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
      `}</style>
      <div className="skeleton" style={{ width: 60, height: 32, marginBottom: 8 }} />
      <div className="skeleton" style={{ width: 50, height: 12 }} />
    </div>
  );
}

export function JobCardSkeleton() {
  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20 }}>
      <style>{`
        .skeleton { background: linear-gradient(90deg, #f0f0f0 25%, #e8e8e8 50%, #f0f0f0 75%); background-size: 200% 100%; animation: shimmer 1.5s infinite; border-radius: 4px; }
        @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
      `}</style>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
        <div className="skeleton" style={{ width: '60%', height: 18 }} />
        <div className="skeleton" style={{ width: 60, height: 22, borderRadius: 6 }} />
      </div>
      <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
        <div className="skeleton" style={{ width: 80, height: 14 }} />
        <div className="skeleton" style={{ width: 80, height: 14 }} />
      </div>
      <div style={{ display: 'flex', gap: 12, paddingTop: 16, borderTop: '1px solid #f3f4f6' }}>
        <div className="skeleton" style={{ flex: 1, height: 40 }} />
        <div className="skeleton" style={{ flex: 1, height: 40 }} />
        <div className="skeleton" style={{ flex: 1, height: 40 }} />
      </div>
    </div>
  );
}
