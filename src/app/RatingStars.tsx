'use client';
import { useState } from 'react';

interface Props {
  value: number;
  max?: number;
  onChange?: (value: number) => void;
  size?: 'sm' | 'md' | 'lg';
  readonly?: boolean;
  showValue?: boolean;
  color?: string;
}

const SIZES = {
  sm: { star: 16, gap: 2 },
  md: { star: 24, gap: 4 },
  lg: { star: 32, gap: 6 },
};

export default function RatingStars({ 
  value, 
  max = 5, 
  onChange, 
  size = 'md', 
  readonly = false,
  showValue = false,
  color = '#f59e0b'
}: Props) {
  const [hoverValue, setHoverValue] = useState<number | null>(null);
  const s = SIZES[size];
  const displayValue = hoverValue ?? value;

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <div 
        style={{ display: 'flex', gap: s.gap }}
        onMouseLeave={() => setHoverValue(null)}
      >
        {Array.from({ length: max }, (_, i) => {
          const starValue = i + 1;
          const filled = starValue <= displayValue;
          const half = !filled && starValue - 0.5 <= displayValue;

          return (
            <span
              key={i}
              onClick={() => !readonly && onChange?.(starValue)}
              onMouseEnter={() => !readonly && setHoverValue(starValue)}
              style={{
                fontSize: s.star,
                cursor: readonly ? 'default' : 'pointer',
                color: filled || half ? color : '#e5e7eb',
                transition: 'all 0.15s',
                transform: hoverValue === starValue ? 'scale(1.2)' : 'scale(1)',
              }}
            >
              {filled ? '★' : half ? '★' : '☆'}
            </span>
          );
        })}
      </div>
      {showValue && (
        <span style={{ 
          fontSize: s.star * 0.6, 
          fontWeight: 700, 
          color: '#374151',
          minWidth: 30,
        }}>
          {value.toFixed(1)}
        </span>
      )}
    </div>
  );
}
