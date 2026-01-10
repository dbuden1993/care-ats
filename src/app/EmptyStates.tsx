'use client';

interface Props {
  type: 'candidates' | 'jobs' | 'interviews' | 'notes' | 'documents' | 'search';
  onAction?: () => void;
  actionLabel?: string;
  searchQuery?: string;
}

const STATES = {
  candidates: {
    icon: '👥',
    title: 'No candidates yet',
    description: 'Add your first candidate to get started with your recruitment pipeline.',
    actionLabel: '+ Add Candidate'
  },
  jobs: {
    icon: '💼',
    title: 'No jobs posted',
    description: 'Create your first job posting to start attracting candidates.',
    actionLabel: '+ Create Job'
  },
  interviews: {
    icon: '📅',
    title: 'No interviews scheduled',
    description: 'Schedule interviews with your candidates to move them through the pipeline.',
    actionLabel: '+ Schedule Interview'
  },
  notes: {
    icon: '📝',
    title: 'No notes yet',
    description: 'Add notes to keep track of important information about this candidate.',
    actionLabel: '+ Add Note'
  },
  documents: {
    icon: '📁',
    title: 'No documents',
    description: 'Upload CVs, certificates, and other documents for this candidate.',
    actionLabel: '+ Upload Document'
  },
  search: {
    icon: '🔍',
    title: 'No results found',
    description: 'Try adjusting your search or filters to find what you\'re looking for.',
    actionLabel: 'Clear Search'
  }
};

export default function EmptyState({ type, onAction, actionLabel, searchQuery }: Props) {
  const state = STATES[type];
  
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '60px 20px',
      textAlign: 'center'
    }}>
      <style>{`
        .empty-icon { font-size: 48px; margin-bottom: 16px; opacity: 0.8; }
        .empty-title { font-size: 18px; font-weight: 600; color: #111827; margin-bottom: 8px; }
        .empty-desc { font-size: 14px; color: #6b7280; max-width: 360px; line-height: 1.5; margin-bottom: 20px; }
        .empty-query { background: #f3f4f6; padding: 4px 12px; border-radius: 6px; font-family: monospace; font-size: 13px; color: #374151; margin-bottom: 16px; }
        .empty-btn { padding: 10px 20px; background: #4f46e5; color: #fff; border: none; border-radius: 8px; font-size: 13px; font-weight: 500; cursor: pointer; transition: all 0.15s; }
        .empty-btn:hover { background: #4338ca; transform: translateY(-1px); }
        .empty-tips { margin-top: 24px; padding-top: 24px; border-top: 1px solid #e5e7eb; text-align: left; }
        .empty-tip { display: flex; align-items: center; gap: 8px; font-size: 12px; color: #6b7280; margin-bottom: 8px; }
        .empty-tip-icon { width: 20px; text-align: center; }
      `}</style>
      
      <div className="empty-icon">{state.icon}</div>
      <div className="empty-title">{state.title}</div>
      {type === 'search' && searchQuery && (
        <div className="empty-query">"{searchQuery}"</div>
      )}
      <div className="empty-desc">{state.description}</div>
      
      {onAction && (
        <button className="empty-btn" onClick={onAction}>
          {actionLabel || state.actionLabel}
        </button>
      )}
      
      {type === 'search' && (
        <div className="empty-tips">
          <div className="empty-tip"><span className="empty-tip-icon">💡</span> Try shorter or different keywords</div>
          <div className="empty-tip"><span className="empty-tip-icon">🔄</span> Check your filters aren't too restrictive</div>
          <div className="empty-tip"><span className="empty-tip-icon">✨</span> Use natural language like "drivers in London"</div>
        </div>
      )}
    </div>
  );
}

export function NoFilterResults({ filterName, onClear }: { filterName: string; onClear: () => void }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 20px',
      textAlign: 'center'
    }}>
      <style>{`
        .nfr-icon { font-size: 32px; margin-bottom: 12px; opacity: 0.6; }
        .nfr-text { font-size: 14px; color: #6b7280; margin-bottom: 12px; }
        .nfr-btn { padding: 8px 16px; background: #f3f4f6; color: #374151; border: none; border-radius: 6px; font-size: 12px; font-weight: 500; cursor: pointer; transition: all 0.15s; }
        .nfr-btn:hover { background: #e5e7eb; }
      `}</style>
      <div className="nfr-icon">🔍</div>
      <div className="nfr-text">No candidates match the "{filterName}" filter</div>
      <button className="nfr-btn" onClick={onClear}>Clear Filter</button>
    </div>
  );
}
