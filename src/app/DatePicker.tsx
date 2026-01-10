'use client';
import { useState, useRef, useEffect } from 'react';

interface Props {
  value?: Date | null;
  onChange?: (date: Date | null) => void;
  label?: string;
  placeholder?: string;
  minDate?: Date;
  maxDate?: Date;
  error?: string;
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export default function DatePicker({ 
  value, 
  onChange, 
  label, 
  placeholder = 'Select date',
  minDate,
  maxDate,
  error
}: Props) {
  const [open, setOpen] = useState(false);
  const [viewDate, setViewDate] = useState(value || new Date());
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const getDaysInMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const getFirstDayOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1).getDay();

  const isSelected = (day: number) => {
    if (!value) return false;
    return value.getDate() === day && 
           value.getMonth() === viewDate.getMonth() && 
           value.getFullYear() === viewDate.getFullYear();
  };

  const isToday = (day: number) => {
    const today = new Date();
    return today.getDate() === day && 
           today.getMonth() === viewDate.getMonth() && 
           today.getFullYear() === viewDate.getFullYear();
  };

  const isDisabled = (day: number) => {
    const date = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
    if (minDate && date < minDate) return true;
    if (maxDate && date > maxDate) return true;
    return false;
  };

  const handleSelect = (day: number) => {
    if (isDisabled(day)) return;
    const newDate = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
    onChange?.(newDate);
    setOpen(false);
  };

  const prevMonth = () => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
  const nextMonth = () => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));

  const fmtDate = (date: Date | null) => {
    if (!date) return '';
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const daysInMonth = getDaysInMonth(viewDate);
  const firstDay = getFirstDayOfMonth(viewDate);
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const blanks = Array.from({ length: firstDay }, (_, i) => i);

  return (
    <div ref={ref} style={{ position: 'relative', marginBottom: 16 }}>
      <style>{`
        .dp-label{display:block;margin-bottom:6px;font-size:13px;font-weight:600;color:#374151}
        .dp-input{width:100%;padding:12px 16px;padding-right:40px;border:1px solid #e5e7eb;border-radius:10px;font-size:14px;cursor:pointer;background:#fff;transition:all .15s}
        .dp-input:focus{outline:none;border-color:#6366f1;box-shadow:0 0 0 3px rgba(99,102,241,.1)}
        .dp-input.error{border-color:#ef4444}
        .dp-icon{position:absolute;right:14px;top:50%;transform:translateY(-50%);font-size:16px;color:#9ca3af;pointer-events:none}
        .dp-dropdown{position:absolute;top:100%;left:0;width:280px;background:#fff;border:1px solid #e5e7eb;border-radius:16px;margin-top:8px;padding:16px;box-shadow:0 10px 40px rgba(0,0,0,.12);z-index:100;animation:dpIn .15s ease}
        @keyframes dpIn{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}
        .dp-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px}
        .dp-month{font-size:14px;font-weight:700;color:#111}
        .dp-nav{display:flex;gap:4px}
        .dp-nav-btn{width:32px;height:32px;display:flex;align-items:center;justify-content:center;border:none;background:#f3f4f6;border-radius:8px;cursor:pointer;font-size:14px;color:#6b7280;transition:all .15s}
        .dp-nav-btn:hover{background:#e5e7eb;color:#111}
        .dp-weekdays{display:grid;grid-template-columns:repeat(7,1fr);gap:4px;margin-bottom:8px}
        .dp-weekday{text-align:center;font-size:11px;font-weight:600;color:#9ca3af;padding:4px}
        .dp-days{display:grid;grid-template-columns:repeat(7,1fr);gap:4px}
        .dp-day{width:32px;height:32px;display:flex;align-items:center;justify-content:center;border:none;background:none;border-radius:8px;cursor:pointer;font-size:13px;color:#374151;transition:all .15s}
        .dp-day:hover:not(.disabled):not(.selected){background:#f3f4f6}
        .dp-day.today{font-weight:700;color:#4f46e5}
        .dp-day.selected{background:#4f46e5;color:#fff}
        .dp-day.disabled{color:#d1d5db;cursor:not-allowed}
        .dp-day.blank{visibility:hidden}
        .dp-error{font-size:12px;color:#ef4444;margin-top:6px}
      `}</style>

      {label && <label className="dp-label">{label}</label>}
      
      <div style={{ position: 'relative' }}>
        <input
          type="text"
          className={`dp-input ${error ? 'error' : ''}`}
          placeholder={placeholder}
          value={fmtDate(value || null)}
          readOnly
          onClick={() => setOpen(!open)}
        />
        <span className="dp-icon">📅</span>
      </div>

      {open && (
        <div className="dp-dropdown">
          <div className="dp-header">
            <span className="dp-month">{MONTHS[viewDate.getMonth()]} {viewDate.getFullYear()}</span>
            <div className="dp-nav">
              <button className="dp-nav-btn" onClick={prevMonth}>‹</button>
              <button className="dp-nav-btn" onClick={nextMonth}>›</button>
            </div>
          </div>

          <div className="dp-weekdays">
            {DAYS.map(d => <div key={d} className="dp-weekday">{d}</div>)}
          </div>

          <div className="dp-days">
            {blanks.map(i => <div key={`blank-${i}`} className="dp-day blank" />)}
            {days.map(day => (
              <button
                key={day}
                className={`dp-day ${isSelected(day) ? 'selected' : ''} ${isToday(day) ? 'today' : ''} ${isDisabled(day) ? 'disabled' : ''}`}
                onClick={() => handleSelect(day)}
              >
                {day}
              </button>
            ))}
          </div>
        </div>
      )}

      {error && <div className="dp-error">{error}</div>}
    </div>
  );
}
