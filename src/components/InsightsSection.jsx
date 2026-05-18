import React from 'react';

/* ── Sparkline helper (reused pattern from HomeHero) ────────────────────── */
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

/* Descending trend for "Tendência de Gastos" */
const SPEND_POINTS = [80, 72, 78, 60, 55, 48];

const SpendSparkline = () => (
  <svg
    width="60" height="30" viewBox="0 0 60 30"
    aria-hidden="true"
    style={{ display: 'block', marginTop: 8 }}
  >
    <path
      d={buildPath(SPEND_POINTS, 60, 30)}
      stroke="#22C55E"
      strokeWidth="1.5"
      fill="none"
      opacity="0.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

/* ── Card 1 — Spending Trend ────────────────────────────────────────────── */
const SpendTrendCard = () => (
  <div style={{
    flex: 1,
    minWidth: 0,
    background: 'rgba(0,221,255,0.06)',
    border: '1px solid rgba(0,221,255,0.15)',
    borderRadius: 16,
    padding: 16,
    display: 'flex',
    flexDirection: 'column',
  }}>
    <span style={{
      fontFamily: 'Inter, -apple-system, sans-serif',
      fontSize: 11,
      fontWeight: 400,
      color: '#94A3B8',
      lineHeight: 1.3,
    }}>
      Tendência de Gastos
    </span>
    <span style={{
      fontFamily: 'Inter, -apple-system, sans-serif',
      fontSize: 20,
      fontWeight: 600,
      color: '#22C55E',
      marginTop: 6,
      letterSpacing: '-0.02em',
    }}>
      −12%
    </span>
    <span style={{
      fontFamily: 'Inter, -apple-system, sans-serif',
      fontSize: 10,
      fontWeight: 400,
      color: '#94A3B8',
      marginTop: 2,
    }}>
      vs mês anterior
    </span>
    <SpendSparkline />
  </div>
);

/* ── Card 2 — Upcoming Payments ─────────────────────────────────────────── */
const UpcomingCard = () => (
  <div style={{
    flex: 1,
    minWidth: 0,
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: 16,
    padding: 16,
    display: 'flex',
    flexDirection: 'column',
  }}>
    <span style={{
      fontFamily: 'Inter, -apple-system, sans-serif',
      fontSize: 11,
      fontWeight: 400,
      color: '#94A3B8',
      lineHeight: 1.3,
    }}>
      Próximos Pagamentos
    </span>
    <span style={{
      fontFamily: 'Inter, -apple-system, sans-serif',
      fontSize: 20,
      fontWeight: 600,
      color: '#FFFFFF',
      marginTop: 6,
      letterSpacing: '-0.02em',
    }}>
      3
    </span>
    <span style={{
      fontFamily: 'Inter, -apple-system, sans-serif',
      fontSize: 10,
      fontWeight: 400,
      color: '#94A3B8',
      marginTop: 2,
    }}>
      esta semana
    </span>
    {/* Three dots with decreasing opacity */}
    <div style={{
      display: 'flex',
      gap: 4,
      marginTop: 14,
    }}>
      {[1, 0.6, 0.3].map((opacity, i) => (
        <div
          key={i}
          aria-hidden="true"
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: '#00DDFF',
            opacity,
          }}
        />
      ))}
    </div>
  </div>
);

/* ── InsightsSection ─────────────────────────────────────────────────────── */
const InsightsSection = ({ onNavigate }) => (
  <section
    aria-label="Insights financeiros"
    style={{ padding: '0 20px', marginTop: 24 }}
  >
    {/* Header */}
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 14,
    }}>
      <span style={{
        fontFamily: 'Inter, -apple-system, sans-serif',
        fontSize: 16,
        fontWeight: 600,
        color: '#FFFFFF',
      }}>
        Insights
      </span>
      <button
        style={{
          background: 'none',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
          fontFamily: 'Inter, -apple-system, sans-serif',
          fontSize: 13,
          fontWeight: 400,
          color: '#00DDFF',
          WebkitTapHighlightColor: 'transparent',
        }}
        aria-label="Ver todos os insights"
        onClick={() => onNavigate?.('stats')}
      >
        Ver todos →
      </button>
    </div>

    {/* 2-card grid */}
    <div style={{ display: 'flex', gap: 12 }}>
      <SpendTrendCard />
      <UpcomingCard />
    </div>
  </section>
);

export default InsightsSection;
