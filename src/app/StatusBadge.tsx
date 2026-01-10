'use client';

interface Props {
  status: string;
  size?: 'sm' | 'md' | 'lg';
  showDot?: boolean;
  pulse?: boolean;
}

const STATUS_CONFIG: Record<string, { bg: string; text: string; dot: string; label: string }> = {
  new: { bg: '#eef2ff', text: '#4f46e5', dot: '#6366f1', label: 'New' },
  screening: { bg: '#f3e8ff', text: '#7c3aed', dot: '#8b5cf6', label: 'Screening' },
  interview: { bg: '#fef3c7', text: '#b45309', dot: '#f59e0b', label: 'Interview' },
  offer: { bg: '#ecfdf5', text: '#059669', dot: '#10b981', label: 'Offer' },
  hired: { bg: '#d1fae5', text: '#047857', dot: '#059669', label: 'Hired' },
  rejected: { bg: '#fef2f2', text: '#dc2626', dot: '#ef4444', label: 'Rejected' },
  open: { bg: '#ecfdf5', text: '#059669', dot: '#10b981', label: 'Open' },
  closed: { bg: '#f3f4f6', text: '#6b7280', dot: '#9ca3af', label: 'Closed' },
  draft: { bg: '#f3f4f6', text: '#6b7280', dot: '#9ca3af', label: 'Draft' },
  paused: { bg: '#fef3c7', text: '#b45309', dot: '#f59e0b', label: 'Paused' },
  scheduled: { bg: '#eef2ff', text: '#4f46e5', dot: '#6366f1', label: 'Scheduled' },
  completed: { bg: '#ecfdf5', text: '#059669', dot: '#10b981', label: 'Completed' },
  cancelled: { bg: '#fef2f2', text: '#dc2626', dot: '#ef4444', label: 'Cancelled' },
};

const SIZES = {
  sm: { padding: '2px 6px', fontSize: 10, dotSize: 6, gap: 4 },
  md: { padding: '4px 10px', fontSize: 11, dotSize: 8, gap: 5 },
  lg: { padding: '6px 14px', fontSize: 12, dotSize: 10, gap: 6 },
};

export default function StatusBadge({ status, size = 'md', showDot = true, pulse = false }: Props) {
  const config = STATUS_CONFIG[status?.toLowerCase()] || STATUS_CONFIG.new;
  const sizeConfig = SIZES[size];

  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: sizeConfig.gap,
      padding: sizeConfig.padding,
      background: config.bg,
      color: config.text,
      borderRadius: 6,
      fontSize: sizeConfig.fontSize,
      fontWeight: 600,
      textTransform: 'capitalize',
    }}>
      {showDot && (
        <span style={{
          width: sizeConfig.dotSize,
          height: sizeConfig.dotSize,
          borderRadius: '50%',
          background: config.dot,
          animation: pulse ? 'statusPulse 2s ease-in-out infinite' : 'none',
        }}>
          <style>{`@keyframes statusPulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.5;transform:scale(1.2)}}`}</style>
        </span>
      )}
      {config.label || status}
    </span>
  );
}

export { STATUS_CONFIG };
