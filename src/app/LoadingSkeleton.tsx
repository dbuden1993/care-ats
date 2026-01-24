'use client';

const styles = `
  @keyframes skeletonShimmer {
    0% { background-position: -200% 0; }
    100% { background-position: 200% 0; }
  }
  
  .skeleton {
    background: linear-gradient(
      90deg,
      var(--gray-100) 0%,
      var(--gray-50) 20%,
      var(--gray-100) 40%,
      var(--gray-100) 100%
    );
    background-size: 200% 100%;
    animation: skeletonShimmer 1.5s ease-in-out infinite;
    border-radius: var(--radius-md);
  }
  
  .skeleton-circle {
    border-radius: var(--radius-full);
  }
  
  .skeleton-text {
    height: 14px;
    margin-bottom: 8px;
  }
  
  .skeleton-text-sm {
    height: 12px;
    width: 60%;
  }
  
  .skeleton-heading {
    height: 24px;
    width: 40%;
    margin-bottom: 16px;
  }
  
  .skeleton-card {
    background: white;
    border-radius: var(--radius-xl);
    border: 1px solid var(--gray-100);
    padding: 20px;
    margin-bottom: 16px;
  }
  
  .skeleton-row {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 16px 0;
    border-bottom: 1px solid var(--gray-100);
  }
  
  .skeleton-row:last-child {
    border-bottom: none;
  }
  
  .skeleton-avatar {
    width: 42px;
    height: 42px;
    flex-shrink: 0;
  }
  
  .skeleton-content {
    flex: 1;
  }
  
  .skeleton-badge {
    width: 80px;
    height: 28px;
    border-radius: var(--radius-full);
  }
  
  .skeleton-kanban {
    display: flex;
    gap: 20px;
    overflow-x: auto;
    padding: 20px 0;
  }
  
  .skeleton-column {
    min-width: 300px;
    flex-shrink: 0;
  }
  
  .skeleton-column-header {
    height: 40px;
    margin-bottom: 16px;
    border-radius: var(--radius-lg);
  }
  
  .skeleton-kanban-card {
    background: white;
    border-radius: var(--radius-lg);
    padding: 16px;
    margin-bottom: 12px;
    border: 1px solid var(--gray-100);
  }
  
  .skeleton-dashboard-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 16px;
    margin-bottom: 24px;
  }
  
  .skeleton-metric-card {
    background: white;
    border-radius: var(--radius-xl);
    border: 1px solid var(--gray-100);
    padding: 24px;
  }
  
  .skeleton-metric-icon {
    width: 48px;
    height: 48px;
    border-radius: var(--radius-lg);
    margin-bottom: 16px;
  }
  
  .skeleton-metric-value {
    height: 36px;
    width: 60px;
    margin-bottom: 8px;
  }
  
  .skeleton-metric-label {
    height: 14px;
    width: 80px;
  }
  
  .skeleton-panel {
    background: white;
    border-radius: var(--radius-xl);
    border: 1px solid var(--gray-100);
    overflow: hidden;
  }
  
  .skeleton-panel-header {
    padding: 18px 22px;
    border-bottom: 1px solid var(--gray-100);
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  
  .skeleton-panel-title {
    height: 20px;
    width: 120px;
  }
  
  .skeleton-panel-body {
    padding: 16px 22px;
  }
`;

export function CandidateListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div style={{ padding: '0 24px' }}>
      <style>{styles}</style>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="skeleton-row">
          <div className="skeleton skeleton-circle skeleton-avatar" />
          <div className="skeleton-content">
            <div className="skeleton skeleton-text" style={{ width: '35%' }} />
            <div className="skeleton skeleton-text-sm" style={{ width: '25%' }} />
          </div>
          <div className="skeleton skeleton-text" style={{ width: '120px', margin: 0 }} />
          <div className="skeleton skeleton-badge" />
          <div className="skeleton skeleton-text" style={{ width: '80px', margin: 0 }} />
        </div>
      ))}
    </div>
  );
}

export function KanbanSkeleton({ columns = 5 }: { columns?: number }) {
  return (
    <div className="skeleton-kanban">
      <style>{styles}</style>
      {Array.from({ length: columns }).map((_, colIdx) => (
        <div key={colIdx} className="skeleton-column">
          <div className="skeleton skeleton-column-header" />
          {Array.from({ length: 3 - colIdx % 2 }).map((_, cardIdx) => (
            <div key={cardIdx} className="skeleton-kanban-card">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <div className="skeleton skeleton-circle" style={{ width: 36, height: 36 }} />
                <div style={{ flex: 1 }}>
                  <div className="skeleton skeleton-text" style={{ width: '70%' }} />
                  <div className="skeleton skeleton-text-sm" style={{ width: '50%' }} />
                </div>
              </div>
              <div className="skeleton skeleton-text" style={{ width: '100%' }} />
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <div className="skeleton" style={{ width: 28, height: 28, borderRadius: 6 }} />
                <div className="skeleton" style={{ width: 28, height: 28, borderRadius: 6 }} />
                <div className="skeleton" style={{ width: 28, height: 28, borderRadius: 6 }} />
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div style={{ padding: 24 }}>
      <style>{styles}</style>
      
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div className="skeleton skeleton-heading" style={{ width: '200px' }} />
        <div className="skeleton skeleton-text" style={{ width: '300px' }} />
      </div>
      
      {/* Metrics Grid */}
      <div className="skeleton-dashboard-grid">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="skeleton-metric-card">
            <div className="skeleton skeleton-metric-icon" />
            <div className="skeleton skeleton-metric-value" />
            <div className="skeleton skeleton-metric-label" />
          </div>
        ))}
      </div>
      
      {/* Panels */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="skeleton-panel">
            <div className="skeleton-panel-header">
              <div className="skeleton skeleton-panel-title" />
              <div className="skeleton" style={{ width: 60, height: 16 }} />
            </div>
            <div className="skeleton-panel-body">
              {Array.from({ length: 4 }).map((_, j) => (
                <div key={j} className="skeleton-row" style={{ padding: '12px 0' }}>
                  <div className="skeleton skeleton-circle" style={{ width: 36, height: 36 }} />
                  <div className="skeleton-content">
                    <div className="skeleton skeleton-text" style={{ width: '60%' }} />
                    <div className="skeleton skeleton-text-sm" style={{ width: '40%' }} />
                  </div>
                  <div className="skeleton" style={{ width: 40, height: 24 }} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function CallHistorySkeleton({ count = 6 }: { count?: number }) {
  return (
    <div style={{ padding: 24 }}>
      <style>{styles}</style>
      
      {/* Stats bar */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton" style={{ 
            width: 100, 
            height: 70, 
            borderRadius: 'var(--radius-lg)' 
          }} />
        ))}
      </div>
      
      {/* Call cards */}
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="skeleton-card" style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 20,
          padding: 20 
        }}>
          <div className="skeleton" style={{ width: 48, height: 48, borderRadius: 12 }} />
          <div style={{ flex: 1 }}>
            <div className="skeleton skeleton-text" style={{ width: '30%' }} />
            <div className="skeleton skeleton-text-sm" style={{ width: '20%' }} />
          </div>
          <div className="skeleton" style={{ width: 50, height: 40, borderRadius: 8 }} />
          <div className="skeleton" style={{ width: 80, height: 16 }} />
        </div>
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 8, cols = 6 }: { rows?: number; cols?: number }) {
  return (
    <div>
      <style>{styles}</style>
      
      {/* Header */}
      <div style={{ 
        display: 'flex', 
        padding: '14px 16px', 
        background: 'var(--gray-50)',
        borderBottom: '2px solid var(--gray-100)',
        gap: 16 
      }}>
        {Array.from({ length: cols }).map((_, i) => (
          <div 
            key={i} 
            className="skeleton" 
            style={{ 
              width: i === 0 ? 20 : i === 1 ? 150 : 100, 
              height: 14 
            }} 
          />
        ))}
      </div>
      
      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <div 
          key={rowIdx} 
          style={{ 
            display: 'flex', 
            padding: '16px', 
            borderBottom: '1px solid var(--gray-100)',
            gap: 16,
            alignItems: 'center'
          }}
        >
          <div className="skeleton" style={{ width: 20, height: 20, borderRadius: 6 }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: 200 }}>
            <div className="skeleton skeleton-circle" style={{ width: 42, height: 42 }} />
            <div>
              <div className="skeleton" style={{ width: 100, height: 14, marginBottom: 6 }} />
              <div className="skeleton" style={{ width: 80, height: 12 }} />
            </div>
          </div>
          {Array.from({ length: cols - 2 }).map((_, i) => (
            <div 
              key={i} 
              className="skeleton" 
              style={{ 
                width: i === 0 ? 120 : i === 1 ? 80 : 60, 
                height: i === 1 ? 28 : 14,
                borderRadius: i === 1 ? 'var(--radius-full)' : 'var(--radius-md)'
              }} 
            />
          ))}
        </div>
      ))}
    </div>
  );
}
