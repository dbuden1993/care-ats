'use client';

interface EmptyStateProps {
  type: 'candidates' | 'calls' | 'jobs' | 'search' | 'imported' | 'sms' | 'whatsapp' | 'generic';
  searchQuery?: string;
  onAction?: () => void;
  actionLabel?: string;
}

const emptyStates: Record<string, { 
  icon: string; 
  title: string; 
  description: string; 
  actionLabel?: string;
  gradient: string;
}> = {
  candidates: {
    icon: '👥',
    title: 'No candidates yet',
    description: 'Start building your talent pipeline by adding candidates manually or importing from a CSV file.',
    actionLabel: 'Add Candidate',
    gradient: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
  },
  calls: {
    icon: '📞',
    title: 'No call history',
    description: 'Call recordings from Dialpad will automatically appear here with AI-powered transcripts and analysis.',
    gradient: 'linear-gradient(135deg, #ec4899 0%, #f472b6 100%)',
  },
  jobs: {
    icon: '💼',
    title: 'No jobs posted',
    description: 'Create job listings to organize candidates by role and track your hiring pipeline.',
    actionLabel: 'Create Job',
    gradient: 'linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)',
  },
  search: {
    icon: '🔍',
    title: 'No results found',
    description: 'Try adjusting your search terms or clearing filters to find what you\'re looking for.',
    actionLabel: 'Clear Search',
    gradient: 'linear-gradient(135deg, #64748b 0%, #94a3b8 100%)',
  },
  imported: {
    icon: '📥',
    title: 'No imported candidates',
    description: 'Import candidates from a CSV file to start your outreach campaigns.',
    actionLabel: 'Import CSV',
    gradient: 'linear-gradient(135deg, #8b5cf6 0%, #a78bfa 100%)',
  },
  sms: {
    icon: '📱',
    title: 'No SMS conversations',
    description: 'Start an SMS campaign to reach out to candidates. Responses will be analyzed by AI.',
    actionLabel: 'Start Campaign',
    gradient: 'linear-gradient(135deg, #06b6d4 0%, #22d3ee 100%)',
  },
  whatsapp: {
    icon: '💬',
    title: 'WhatsApp not connected',
    description: 'Connect your WhatsApp to send bulk messages to candidates.',
    actionLabel: 'Connect WhatsApp',
    gradient: 'linear-gradient(135deg, #22c55e 0%, #4ade80 100%)',
  },
  generic: {
    icon: '📭',
    title: 'Nothing here yet',
    description: 'This section is empty. Start adding content to see it here.',
    gradient: 'linear-gradient(135deg, #94a3b8 0%, #cbd5e1 100%)',
  },
};

export default function EmptyState({ type, searchQuery, onAction, actionLabel }: EmptyStateProps) {
  const state = emptyStates[type] || emptyStates.generic;
  
  const displayDescription = type === 'search' && searchQuery 
    ? `No results found for "${searchQuery}". Try a different search term.`
    : state.description;

  const styles = `
    @keyframes emptyFloat {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-10px); }
    }
    
    @keyframes emptyPulse {
      0%, 100% { opacity: 0.6; transform: scale(1); }
      50% { opacity: 0.3; transform: scale(1.05); }
    }
    
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 80px 40px;
      text-align: center;
      min-height: 400px;
    }
    
    .empty-icon-container {
      position: relative;
      margin-bottom: 28px;
    }
    
    .empty-icon-bg {
      position: absolute;
      inset: -20px;
      border-radius: 50%;
      opacity: 0.15;
      animation: emptyPulse 3s ease-in-out infinite;
    }
    
    .empty-icon {
      width: 100px;
      height: 100px;
      border-radius: 28px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 48px;
      position: relative;
      box-shadow: 0 10px 30px -10px rgba(0, 0, 0, 0.2);
      animation: emptyFloat 4s ease-in-out infinite;
    }
    
    .empty-title {
      font-family: var(--font-display);
      font-size: 22px;
      font-weight: 800;
      color: var(--gray-900);
      margin-bottom: 12px;
      letter-spacing: -0.02em;
    }
    
    .empty-description {
      font-size: 15px;
      color: var(--gray-500);
      max-width: 400px;
      line-height: 1.6;
      margin-bottom: 28px;
    }
    
    .empty-action {
      padding: 14px 28px;
      background: linear-gradient(135deg, var(--primary) 0%, var(--primary-hover) 100%);
      color: white;
      border: none;
      border-radius: var(--radius-lg);
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: all var(--transition-normal);
      box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    .empty-action:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(99, 102, 241, 0.4);
    }
    
    .empty-tips {
      margin-top: 40px;
      padding-top: 32px;
      border-top: 1px solid var(--gray-100);
      width: 100%;
      max-width: 500px;
    }
    
    .empty-tips-title {
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: var(--gray-400);
      margin-bottom: 16px;
    }
    
    .empty-tips-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    
    .empty-tip {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 16px;
      background: var(--gray-50);
      border-radius: var(--radius-lg);
      font-size: 13px;
      color: var(--gray-600);
      text-align: left;
    }
    
    .empty-tip-icon {
      width: 32px;
      height: 32px;
      background: white;
      border-radius: var(--radius-md);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 16px;
      flex-shrink: 0;
      box-shadow: var(--shadow-xs);
    }
  `;

  const tips = type === 'candidates' ? [
    { icon: '📥', text: 'Import candidates from Indeed, LinkedIn, or any CSV file' },
    { icon: '📞', text: 'Call recordings are automatically transcribed and analyzed' },
    { icon: '🤖', text: 'AI grades candidates based on call quality and engagement' },
  ] : type === 'calls' ? [
    { icon: '🔗', text: 'Connect your Dialpad account in Settings' },
    { icon: '🎙️', text: 'Recordings are automatically transcribed with Whisper' },
    { icon: '⚡', text: 'Claude AI extracts candidate info and assigns grades' },
  ] : null;

  return (
    <div className="empty-state">
      <style>{styles}</style>
      
      <div className="empty-icon-container">
        <div className="empty-icon-bg" style={{ background: state.gradient }} />
        <div className="empty-icon" style={{ background: state.gradient }}>
          {state.icon}
        </div>
      </div>
      
      <h3 className="empty-title">{state.title}</h3>
      <p className="empty-description">{displayDescription}</p>
      
      {onAction && (
        <button className="empty-action" onClick={onAction}>
          <span>+</span>
          {actionLabel || state.actionLabel || 'Get Started'}
        </button>
      )}
      
      {tips && (
        <div className="empty-tips">
          <div className="empty-tips-title">💡 Quick Tips</div>
          <div className="empty-tips-list">
            {tips.map((tip, i) => (
              <div key={i} className="empty-tip">
                <div className="empty-tip-icon">{tip.icon}</div>
                <span>{tip.text}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
