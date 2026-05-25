import React, { useMemo } from 'react';
import { getUpcomingPayments } from '../utils/recurringPayments';

/* ── Sparkline helper ────────────────────────────────────────────────────── */
function buildPath(points, w, h, pad = 3) {
  const minV = Math.min(...points);
  const maxV = Math.max(...points);
  const range = maxV - minV || 1;
  const uw = w - pad * 2;
  const uh = h - pad * 2;
  return points
    .map((v, i) => {
      const x = pad + (i / (points.length - 1)) * uw;
      const y = pad + (1 - (v - minV) / range) * uh;
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');
}

const CARD_STYLE_BASE = {
  flex: 1,
  minWidth: 0,
  borderRadius: 16,
  padding: 16,
  display: 'flex',
  flexDirection: 'column',
  cursor: 'pointer',
  WebkitTapHighlightColor: 'transparent',
  transition: 'opacity 0.15s',
};

/* ── Card 1 — Spending Trend (dynamic) ──────────────────────────────────── */
const SpendTrendCard = ({ transactions, currentMonth, onNavigate }) => {
  const { pct, isDown, currentExp, sparkPoints } = useMemo(() => {
    const [year, month] = (currentMonth || '').split('-').map(Number);
    const prevDate = new Date(year, month - 2, 1);
    const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;

    const txs = transactions || [];
    const curExp = txs
      .filter(t => t.type === 'expense' && (t.date || '').startsWith(currentMonth))
      .reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);
    const prevExp = txs
      .filter(t => t.type === 'expense' && (t.date || '').startsWith(prevMonth))
      .reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);

    const diff = prevExp > 0 ? Math.round(((curExp - prevExp) / prevExp) * 100) : 0;

    // Last 6 months of expenses for sparkline
    const monthlyTotals = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(year, month - 1 - i, 1);
      const mk = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const total = txs
        .filter(t => t.type === 'expense' && (t.date || '').startsWith(mk))
        .reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);
      monthlyTotals.push(total || 0);
    }

    return {
      pct: Math.abs(diff),
      isDown: diff <= 0,
      currentExp: curExp,
      sparkPoints: monthlyTotals,
    };
  }, [transactions, currentMonth]);

  const color = isDown ? 'var(--cosmos-income)' : 'var(--cosmos-expense)';
  const hasData = sparkPoints.some(v => v > 0);

  return (
    <div
      style={{ ...CARD_STYLE_BASE, background: 'var(--cosmos-accent-soft)', border: '1px solid var(--cosmos-accent-border)' }}
      onClick={() => onNavigate?.('stats')}
      role="button"
      aria-label="Ver tendência de gastos nos stats"
    >
      <span style={{ fontFamily: 'Inter, -apple-system, sans-serif', fontSize: 11, color: 'var(--cosmos-text-3)' }}>
        Tendência de Gastos
      </span>
      <span style={{ fontFamily: 'Inter, -apple-system, sans-serif', fontSize: 20, fontWeight: 600, color, marginTop: 6, letterSpacing: '-0.02em' }}>
        {pct === 0 ? '—' : `${isDown ? '−' : '+'}${pct}%`}
      </span>
      <span style={{ fontFamily: 'Inter, -apple-system, sans-serif', fontSize: 10, color: 'var(--cosmos-text-3)', marginTop: 2 }}>
        vs mês anterior
      </span>
      {hasData && (
        <svg width="100%" height="30" viewBox="0 0 60 30" aria-hidden="true" style={{ display: 'block', marginTop: 8 }}>
          <path
            d={buildPath(sparkPoints, 60, 30)}
            stroke={color}
            strokeWidth="1.5"
            fill="none"
            opacity="0.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
      <span style={{ fontFamily: 'Inter, -apple-system, sans-serif', fontSize: 10, color: 'var(--cosmos-accent)', marginTop: 8 }}>
        Ver detalhes →
      </span>
    </div>
  );
};

/* ── Card 2 — Upcoming Payments (dynamic) ───────────────────────────────── */
const UpcomingCard = ({ recurringPayments, onNavigate }) => {
  const { count, totalAmount } = useMemo(() => {
    const upcoming = getUpcomingPayments(recurringPayments || [], 7);
    const total = upcoming.reduce((s, p) => {
      const amt = parseFloat(p.estimatedAmount || p.amount) || 0;
      return s + amt;
    }, 0);
    return { count: upcoming.length, totalAmount: total };
  }, [recurringPayments]);

  return (
    <div
      style={{ ...CARD_STYLE_BASE, background: 'var(--cosmos-surface-1)', border: '1px solid var(--cosmos-border-card)' }}
      onClick={() => onNavigate?.('budget', { view: 'recurring' })}
      role="button"
      aria-label="Ver próximos pagamentos recorrentes"
    >
      <span style={{ fontFamily: 'Inter, -apple-system, sans-serif', fontSize: 11, color: 'var(--cosmos-text-3)' }}>
        Próximos Pagamentos
      </span>
      <span style={{ fontFamily: 'Inter, -apple-system, sans-serif', fontSize: 20, fontWeight: 600, color: 'var(--cosmos-text-1)', marginTop: 6, letterSpacing: '-0.02em' }}>
        {count}
      </span>
      <span style={{ fontFamily: 'Inter, -apple-system, sans-serif', fontSize: 10, color: 'var(--cosmos-text-3)', marginTop: 2 }}>
        {count === 1 ? 'pagamento esta semana' : 'pagamentos esta semana'}
      </span>
      {totalAmount > 0 && (
        <span style={{ fontFamily: 'Inter, -apple-system, sans-serif', fontSize: 13, fontWeight: 600, color: 'var(--cosmos-expense)', marginTop: 8 }}>
          {totalAmount.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€
        </span>
      )}
      <span style={{ fontFamily: 'Inter, -apple-system, sans-serif', fontSize: 10, color: 'var(--cosmos-accent)', marginTop: count > 0 && totalAmount > 0 ? 4 : 8 }}>
        Ver recorrentes →
      </span>
    </div>
  );
};

/* ── InsightsSection ─────────────────────────────────────────────────────── */
const InsightsSection = ({ transactions, currentMonth, recurringPayments, onNavigate }) => (
  <section aria-label="Insights financeiros" style={{ padding: '0 20px', marginTop: 24 }}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
      <span style={{ fontFamily: 'Inter, -apple-system, sans-serif', fontSize: 16, fontWeight: 600, color: 'var(--cosmos-text-1)' }}>
        Insights
      </span>
      <button
        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'Inter, -apple-system, sans-serif', fontSize: 13, color: 'var(--cosmos-accent)', WebkitTapHighlightColor: 'transparent' }}
        onClick={() => onNavigate?.('stats')}
      >
        Ver todos →
      </button>
    </div>
    <div style={{ display: 'flex', gap: 12 }}>
      <SpendTrendCard transactions={transactions} currentMonth={currentMonth} onNavigate={onNavigate} />
      <UpcomingCard recurringPayments={recurringPayments} onNavigate={onNavigate} />
    </div>
  </section>
);

export default InsightsSection;
