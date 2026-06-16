import React, { useState, useMemo } from 'react';
import Overlay from '../Overlay';
import { getOccurrencesInRange, FREQ_LABELS } from '../../utils/recurringPayments';

const DAY_HEADERS = ['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'];

function buildCalendarWeeks(year, month) {
  // month is 0-indexed
  const firstDay = new Date(year, month, 1);
  const lastDay  = new Date(year, month + 1, 0);
  // 0=Sun…6=Sat → convert to Mon=0…Sun=6
  const startOffset = (firstDay.getDay() + 6) % 7;
  const cells = [];

  // Fill leading empty cells
  for (let i = 0; i < startOffset; i++) cells.push(null);

  // Fill days of month
  for (let d = 1; d <= lastDay.getDate(); d++) {
    const dt = new Date(year, month, d);
    cells.push(dt.toISOString().split('T')[0]);
  }

  // Chunk into weeks of 7
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7).concat(Array(7).fill(null)).slice(0, 7));
  }
  return weeks;
}

function toYYYYMM(year, month) {
  return `${year}-${String(month + 1).padStart(2, '0')}`;
}

const RecurringCalendar = ({ recurringPayments, onClose }) => {
  const today      = new Date().toISOString().split('T')[0];
  const todayDate  = new Date();
  const [viewYear,  setViewYear]  = useState(todayDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(todayDate.getMonth()); // 0-indexed
  const [selected,  setSelected]  = useState(today);

  const monthKey = toYYYYMM(viewYear, viewMonth);
  const monthStart = `${monthKey}-01`;
  const monthEnd   = new Date(viewYear, viewMonth + 1, 0).toISOString().split('T')[0];

  // Build map: date → [payments]
  const paymentsByDate = useMemo(() => {
    const map = {};
    for (const p of (recurringPayments || [])) {
      if (p.active === false) continue;
      for (const date of getOccurrencesInRange(p, monthStart, monthEnd)) {
        if (!map[date]) map[date] = [];
        map[date].push(p);
      }
    }
    return map;
  }, [recurringPayments, monthStart, monthEnd]);

  const weeks = useMemo(() => buildCalendarWeeks(viewYear, viewMonth), [viewYear, viewMonth]);

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  };

  const canGoBack = toYYYYMM(viewYear, viewMonth) > toYYYYMM(todayDate.getFullYear(), todayDate.getMonth());

  const monthLabel = new Date(viewYear, viewMonth, 1).toLocaleDateString('pt-PT', {
    month: 'long', year: 'numeric',
  });

  const selectedPayments = paymentsByDate[selected] || [];

  return (
    <Overlay onClose={onClose}>
      <div className="rp-cal-sheet" onClick={e => e.stopPropagation()}>
        <div className="rp-cal-handle" />

        <div className="rp-cal-header">
          <div className="rp-cal-nav">
            <button
              className="rp-cal-nav-btn"
              onClick={prevMonth}
              disabled={!canGoBack}
              style={!canGoBack ? { opacity: 0.3 } : undefined}
            >‹</button>
            <span className="rp-cal-month-label">{monthLabel}</span>
            <button className="rp-cal-nav-btn" onClick={nextMonth}>›</button>
          </div>
          <button className="rp-cal-close" onClick={onClose}>✕</button>
        </div>

        <div className="rp-cal-grid">
          <div className="rp-cal-day-headers">
            {DAY_HEADERS.map(h => (
              <div key={h} className="rp-cal-day-header">{h}</div>
            ))}
          </div>
          <div className="rp-cal-weeks">
            {weeks.map((week, wi) => (
              <div key={wi} className="rp-cal-week">
                {week.map((date, di) => {
                  if (!date) return <div key={di} className="rp-cal-cell empty" />;
                  const isToday    = date === today;
                  const isSelected = date === selected;
                  const payments   = paymentsByDate[date] || [];
                  return (
                    <div
                      key={date}
                      className={`rp-cal-cell${isToday ? ' today' : ''}${isSelected ? ' selected' : ''}`}
                      onClick={() => setSelected(date)}
                    >
                      <span className="rp-cal-day-num">{parseInt(date.slice(8))}</span>
                      {payments.length > 0 && (
                        <div className="rp-cal-dots">
                          {payments.slice(0, 3).map((p, i) => (
                            <span key={i} className="rp-cal-dot" />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Day detail */}
        <div className="rp-cal-detail">
          <div className="rp-cal-detail-date">
            {new Date(selected + 'T00:00:00').toLocaleDateString('pt-PT', {
              weekday: 'long', day: 'numeric', month: 'long',
            })}
          </div>
          {selectedPayments.length === 0 ? (
            <p className="rp-cal-detail-empty">Sem pagamentos neste dia</p>
          ) : (
            selectedPayments.map(p => (
              <div key={p.id} className="rp-cal-detail-item">
                <div className="rp-cal-detail-icon">
                  {p.icon || '↻'}
                </div>
                <div className="rp-cal-detail-body">
                  <div className="rp-cal-detail-title">{p.title}</div>
                  <div className="rp-cal-detail-sub">
                    {FREQ_LABELS[p.frequency] || p.frequency}
                    {p.notes ? ` · ${p.notes}` : ''}
                  </div>
                </div>
                <span className="rp-cal-detail-amt">
                  {(parseFloat(p.amount) || 0).toFixed(2)}€
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </Overlay>
  );
};

export default RecurringCalendar;
