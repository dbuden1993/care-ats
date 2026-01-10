'use client';

interface Props {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  icon?: string;
  iconPosition?: 'left' | 'right';
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  onClick?: () => void;
  type?: 'button' | 'submit';
}

const VARIANTS = {
  primary: {
    background: 'linear-gradient(135deg, #4f46e5, #6366f1)',
    color: '#fff',
    border: 'none',
    shadow: '0 2px 8px rgba(99, 102, 241, 0.3)',
    hoverShadow: '0 4px 12px rgba(99, 102, 241, 0.4)',
  },
  secondary: {
    background: '#f3f4f6',
    color: '#374151',
    border: '1px solid #e5e7eb',
    shadow: 'none',
    hoverShadow: '0 2px 8px rgba(0,0,0,0.05)',
  },
  outline: {
    background: '#fff',
    color: '#4f46e5',
    border: '1px solid #4f46e5',
    shadow: 'none',
    hoverShadow: '0 2px 8px rgba(99, 102, 241, 0.15)',
  },
  ghost: {
    background: 'transparent',
    color: '#6b7280',
    border: 'none',
    shadow: 'none',
    hoverShadow: 'none',
  },
  danger: {
    background: 'linear-gradient(135deg, #dc2626, #ef4444)',
    color: '#fff',
    border: 'none',
    shadow: '0 2px 8px rgba(239, 68, 68, 0.3)',
    hoverShadow: '0 4px 12px rgba(239, 68, 68, 0.4)',
  },
};

const SIZES = {
  sm: { padding: '8px 14px', fontSize: 12, gap: 6, iconSize: 14 },
  md: { padding: '10px 18px', fontSize: 13, gap: 8, iconSize: 16 },
  lg: { padding: '14px 24px', fontSize: 14, gap: 10, iconSize: 18 },
};

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  icon,
  iconPosition = 'left',
  loading = false,
  disabled = false,
  fullWidth = false,
  onClick,
  type = 'button',
}: Props) {
  const variantStyle = VARIANTS[variant];
  const sizeStyle = SIZES[size];

  return (
    <button
      type={type}
      disabled={disabled || loading}
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: sizeStyle.gap,
        padding: sizeStyle.padding,
        fontSize: sizeStyle.fontSize,
        fontWeight: 600,
        borderRadius: 10,
        cursor: disabled || loading ? 'not-allowed' : 'pointer',
        transition: 'all 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
        opacity: disabled ? 0.5 : 1,
        width: fullWidth ? '100%' : 'auto',
        background: variantStyle.background,
        color: variantStyle.color,
        border: variantStyle.border,
        boxShadow: variantStyle.shadow,
        flexDirection: iconPosition === 'right' ? 'row-reverse' : 'row',
      }}
      onMouseOver={e => {
        if (!disabled && !loading) {
          e.currentTarget.style.transform = 'translateY(-1px)';
          e.currentTarget.style.boxShadow = variantStyle.hoverShadow;
        }
      }}
      onMouseOut={e => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = variantStyle.shadow;
      }}
    >
      {loading ? (
        <span style={{
          width: sizeStyle.iconSize,
          height: sizeStyle.iconSize,
          border: '2px solid currentColor',
          borderTopColor: 'transparent',
          borderRadius: '50%',
          animation: 'btnSpin 0.6s linear infinite',
        }}>
          <style>{`@keyframes btnSpin{to{transform:rotate(360deg)}}`}</style>
        </span>
      ) : icon ? (
        <span style={{ fontSize: sizeStyle.iconSize }}>{icon}</span>
      ) : null}
      {children}
    </button>
  );
}
