'use client';
import { useState, useRef, useEffect } from 'react';

interface Props {
  content: React.ReactNode;
  children: React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  delay?: number;
}

export default function Tooltip({ content, children, position = 'top', delay = 300 }: Props) {
  const [show, setShow] = useState(false);
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout>();

  const handleMouseEnter = () => {
    timeoutRef.current = setTimeout(() => {
      if (triggerRef.current) {
        const rect = triggerRef.current.getBoundingClientRect();
        setCoords({
          x: rect.left + rect.width / 2,
          y: position === 'top' ? rect.top : rect.bottom
        });
        setShow(true);
      }
    }, delay);
  };

  const handleMouseLeave = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setShow(false);
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return (
    <>
      <div
        ref={triggerRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        style={{ display: 'inline-flex' }}
      >
        {children}
      </div>
      {show && (
        <div
          ref={tooltipRef}
          style={{
            position: 'fixed',
            left: coords.x,
            top: position === 'top' ? coords.y - 8 : coords.y + 8,
            transform: `translateX(-50%) translateY(${position === 'top' ? '-100%' : '0'})`,
            background: '#1f2937',
            color: '#fff',
            padding: '6px 10px',
            borderRadius: 6,
            fontSize: 12,
            fontWeight: 500,
            whiteSpace: 'nowrap',
            zIndex: 9999,
            boxShadow: '0 4px 12px rgba(0,0,0,.15)',
            animation: 'tooltipIn .15s ease',
          }}
        >
          <style>{`@keyframes tooltipIn{from{opacity:0;transform:translateX(-50%) translateY(${position === 'top' ? 'calc(-100% + 4px)' : '-4px'})}to{opacity:1;transform:translateX(-50%) translateY(${position === 'top' ? '-100%' : '0'})}}`}</style>
          {content}
          <div style={{
            position: 'absolute',
            left: '50%',
            transform: 'translateX(-50%)',
            ...(position === 'top' ? { bottom: -4 } : { top: -4 }),
            width: 0,
            height: 0,
            borderLeft: '5px solid transparent',
            borderRight: '5px solid transparent',
            ...(position === 'top' 
              ? { borderTop: '5px solid #1f2937' }
              : { borderBottom: '5px solid #1f2937' }
            ),
          }} />
        </div>
      )}
    </>
  );
}
