import React from 'react';
import { getFinancialMonthRange } from '../../utils/financialMonth';

/* ── Progress logic ──────────────────────────────────────────────────────── */
function getProgress(currentMonth, startDay) {
  const today    = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const { start, end } = getFinancialMonthRange(currentMonth, startDay);
  if (todayStr < start || todayStr > end) return null;
  const s     = new Date(start + 'T00:00:00');
  const e     = new Date(end   + 'T00:00:00');
  const total  = Math.round((e - s) / 86400000) + 1;
  const passed = Math.round((today - s) / 86400000) + 1;
  return { passed, total, pct: Math.min(100, Math.round((passed / total) * 100)) };
}

function fmt(val) {
  return val.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/* ── Sparkline ───────────────────────────────────────────────────────────── */
const HeroSparkline = () => (
  <svg
    width="80"
    height="52"
    viewBox="0 0 80 52"
    aria-hidden="true"
    style={{ display: 'block', overflow: 'hidden' }}
  >
    <defs>
      <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%"   stopColor="#00DDFF" stopOpacity="0.15" />
        <stop offset="100%" stopColor="#00DDFF" stopOpacity="0"    />
      </linearGradient>
    </defs>
    <path
      d="M0,48 L0,44 L13,38 L26,41 L39,28 L52,32 L65,18 L80,10 L80,48 Z"
      fill="url(#sparkFill)"
    />
    <polyline
      points="0,44 13,38 26,41 39,28 52,32 65,18 80,10"
      fill="none"
      stroke="#00DDFF"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

/* ── HomeHero ────────────────────────────────────────────────────────────── */
const HomeHero = ({ patrimonyTotal, monthlyBalance, currentMonth, financialMonthStartDay = 1 }) => {
  const progress   = getProgress(currentMonth, financialMonthStartDay);
  const isPositive = monthlyBalance >= 0;

  /* Badge colours */
  const badgeBg     = isPositive ? 'rgba(34,197,94,0.15)'  : 'rgba(231,76,60,0.15)';
  const badgeBorder = isPositive ? 'rgba(34,197,94,0.30)'  : 'rgba(231,76,60,0.30)';
  const badgeColor  = isPositive ? '#22C55E'                : '#E74C3C';
  const badgeArrow  = isPositive ? '↑' : '↓';
  const badgeSign   = isPositive ? '+' : '';

  return (
    <div style={{
      padding: '12px 20px 24px 20px',
      background: 'transparent',
      border: 'none',
    }}>

      {/* ── MAIN ROW: text left, sparkline right ── */}
      <div style={{
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: '8px',
      }}>

        {/* LEFT COLUMN */}
        <div style={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
        }}>

          <span style={{
            fontSize: '11px',
            fontWeight: 400,
            color: '#94A3B8',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            marginBottom: '4px',
          }}>
            Património Total
          </span>

          <span style={{
            fontSize: '44px',
            fontWeight: 700,
            color: '#FFFFFF',
            lineHeight: 1.05,
            letterSpacing: '-0.02em',
            marginBottom: '8px',
          }}>
            {fmt(patrimonyTotal)}€
          </span>

          <span style={{
            fontSize: '13px',
            fontWeight: 400,
            color: '#22C55E',
            marginBottom: '10px',
          }}>
            ↑ +2,4% vs mês passado
          </span>

          {/* Monthly balance pill */}
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            background: badgeBg,
            border: `1px solid ${badgeBorder}`,
            borderRadius: '20px',
            padding: '5px 13px',
            marginBottom: '16px',
          }}>
            <span style={{ color: badgeColor, fontSize: '13px' }}>{badgeArrow}</span>
            <span style={{ color: badgeColor, fontSize: '13px', fontWeight: 500 }}>
              {badgeSign}{fmt(monthlyBalance)}€ este mês
            </span>
          </div>

        </div>{/* end left column */}

        {/* RIGHT COLUMN — sparkline */}
        <div style={{
          width: '80px',
          flexShrink: 0,
          marginTop: '20px',
        }}>
          <HeroSparkline />
        </div>

      </div>{/* end main row */}

      {/* ── MONTH PROGRESS BAR ── */}
      {progress && (
        <div style={{ marginTop: '4px' }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginBottom: '6px',
          }}>
            <span style={{ fontSize: '12px', color: '#94A3B8' }}>
              Dia {progress.passed} de {progress.total}
            </span>
            <span style={{ fontSize: '12px', color: '#00DDFF' }}>
              {progress.pct}%
            </span>
          </div>
          <div style={{
            height: '3px',
            background: 'rgba(255,255,255,0.08)',
            borderRadius: '2px',
            overflow: 'hidden',
          }}>
            <div style={{
              height: '100%',
              width: `${progress.pct}%`,
              background: '#00DDFF',
              borderRadius: '2px',
            }} />
          </div>
        </div>
      )}

    </div>
  );
};

export default HomeHero;
