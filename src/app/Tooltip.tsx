'use client';
import { useState, useRef, useEffect, ReactNode } from 'react';

interface Props {
  content: string;
  children: ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  delay?: number;
}

export default function Tooltip({ content, children, position = 'top', delay = 300 }: Props) {
  const [visible, setVisible] = useState(false);
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const timeoutRef = useRef<NodeJS.Timeout>();
  const triggerRef = useRef<HTMLDivElement>(null);

  const showTooltip = () => {
    timeoutRef.current = setTimeout(() => {
      if (triggerRef.current) {
        const rect = triggerRef.current.getBoundingClientRect();
        
        let x = rect.left + rect.width / 2;
        let y = rect.top;
        
        switch (position) {
          case 'bottom':
            y = rect.bottom;
            break;
          case 'left':
            x = rect.left;
            y = rect.top + rect.height / 2;
            break;
          case 'right':
            x = rect.right;
            y = rect.top + rect.height / 2;
            break;
        }
        
        setCoords({ x, y });
        setVisible(true);
      }
    }, delay);
  };

  const hideTooltip = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setVisible(false);
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  if (!content) {
    return <>{children}</>;
  }

  const styles = `
    @keyframes tooltipFadeIn {
      from { opacity: 0; transform: scale(0.95); }
      to { opacity: 1; transform: scale(1); }
    }
    
    .tooltip-trigger {
      display: inline-flex;
    }
    
    .tooltip {
      position: fixed;
      z-index: 10000;
      padding: 8px 12px;
      background: var(--gray-900);
      color: white;
      font-size: 12px;
      font-weight: 500;
      border-radius: var(--radius-md);
      white-space: nowrap;
      pointer-events: none;
      animation: tooltipFadeIn 0.15s ease-out forwards;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
    }
    
    .tooltip::after {
      content: '';
      position: absolute;
      border: 6px solid transparent;
    }
    
    .tooltip.top {
      transform: translate(-50%, -100%);
      margin-top: -8px;
    }
    
    .tooltip.top::after {
      top: 100%;
      left: 50%;
      transform: translateX(-50%);
      border-top-color: var(--gray-900);
    }
    
    .tooltip.bottom {
      transform: translate(-50%, 0);
      margin-top: 8px;
    }
    
    .tooltip.bottom::after {
      bottom: 100%;
      left: 50%;
      transform: translateX(-50%);
      border-bottom-color: var(--gray-900);
    }
    
    .tooltip.left {
      transform: translate(-100%, -50%);
      margin-left: -8px;
    }
    
    .tooltip.left::after {
      left: 100%;
      top: 50%;
      transform: translateY(-50%);
      border-left-color: var(--gray-900);
    }
    
    .tooltip.right {
      transform: translate(0, -50%);
      margin-left: 8px;
    }
    
    .tooltip.right::after {
      right: 100%;
      top: 50%;
      transform: translateY(-50%);
      border-right-color: var(--gray-900);
    }
  `;

  return (
    <>
      <style>{styles}</style>
      <div
        ref={triggerRef}
        className="tooltip-trigger"
        onMouseEnter={showTooltip}
        onMouseLeave={hideTooltip}
        onFocus={showTooltip}
        onBlur={hideTooltip}
      >
        {children}
      </div>
      {visible && (
        <div
          className={`tooltip ${position}`}
          style={{ left: coords.x, top: coords.y }}
        >
          {content}
        </div>
      )}
    </>
  );
}
