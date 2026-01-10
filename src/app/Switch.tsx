'use client';

interface Props {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const SIZES = {
  sm: { width: 36, height: 20, knob: 16 },
  md: { width: 44, height: 24, knob: 20 },
  lg: { width: 56, height: 30, knob: 26 },
};

export default function Switch({ checked, onChange, label, description, disabled = false, size = 'md' }: Props) {
  const s = SIZES[size];

  return (
    <label style={{
      display: 'flex',
      alignItems: 'flex-start',
      gap: 12,
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.5 : 1,
    }}>
      <div
        onClick={() => !disabled && onChange(!checked)}
        style={{
          width: s.width,
          height: s.height,
          borderRadius: s.height,
          background: checked ? '#4f46e5' : '#e5e7eb',
          padding: 2,
          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
          flexShrink: 0,
          cursor: disabled ? 'not-allowed' : 'pointer',
        }}
      >
        <div style={{
          width: s.knob,
          height: s.knob,
          borderRadius: '50%',
          background: '#fff',
          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
          transform: `translateX(${checked ? s.width - s.knob - 4 : 0}px)`,
          transition: 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        }} />
      </div>
      {(label || description) && (
        <div>
          {label && (
            <div style={{ fontSize: 14, fontWeight: 500, color: '#111' }}>{label}</div>
          )}
          {description && (
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{description}</div>
          )}
        </div>
      )}
    </label>
  );
}
