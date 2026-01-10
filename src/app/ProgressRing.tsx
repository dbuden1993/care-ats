'use client';
import { useEffect, useState } from 'react';

interface Props {
  value: number; // 0-100
  size?: number;
  strokeWidth?: number;
  color?: string;
  bgColor?: string;
  showValue?: boolean;
  label?: string;
  animated?: boolean;
}

export default function ProgressRing({ 
  value, 
  size = 80, 
  strokeWidth = 8, 
  color = '#4f46e5', 
  bgColor = '#e5e7eb',
  showValue = true,
  label,
  animated = true 
}: Props) {
  const [displayValue, setDisplayValue] = useState(animated ? 0 : value);
  
  useEffect(() => {
    if (!animated) {
      setDisplayValue(value);
      return;
    }
    
    const duration = 800;
    const startTime = performance.now();
    const startValue = displayValue;
    
    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(startValue + (value - startValue) * eased);
      
      if (progress < 1) requestAnimationFrame(animate);
    };
    
    requestAnimationFrame(animate);
  }, [value, animated]);

  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (displayValue / 100) * circumference;

  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={bgColor}
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: animated ? 'none' : 'stroke-dashoffset 0.5s ease' }}
        />
      </svg>
      {showValue && (
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <span style={{ fontSize: size * 0.25, fontWeight: 700, color: '#111' }}>
            {Math.round(displayValue)}%
          </span>
          {label && (
            <span style={{ fontSize: size * 0.12, color: '#6b7280', marginTop: 2 }}>
              {label}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
