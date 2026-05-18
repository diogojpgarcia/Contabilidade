import React from 'react';
import { getFinancialMonthRange } from '../../utils/financialMonth';
import CosmosCard from '../cosmos/CosmosCard';
import CosmosPlanet from '../CosmosPlanet';

/* ── Logic unchanged ────────────────────────────────────────────────────── */
function getProgress(currentMonth, startDay) {
  const today    = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const { start, end } = getFinancialMonthRange(currentMonth, startDay);
  if (todayStr < start || todayStr > end) return null;
  const s      = new Date(start + 'T00:00:00');
  const e      = new Date(end   + 'T00:00:00');
  const total  = Math.round((e - s) / 86400000) + 1;
  const passed = Math.round((today - s) / 86400000) + 1;
  return { passed, total, pct: Math.min(100, Math.round((passed / total) * 100)) };
}

function fmt(val) {
  return val.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/* ── Sparkline — inline SVG, hardcoded trend, no library needed ─────────── */
const SPARKLINE_POINTS = [40, 55, 45, 70, 60, 80];
const SX = 80, SY = 40, PAD = 4;

function buildSparklinePath(points) {
  const minV = Math.min(...points);
  const maxV = Math.max(...points);
  const range = maxV - minV || 1;
  const w = SX - PAD * 2;
  const h = SY - PAD * 2;
  return points
    .map((v, i) => {
      const x = PAD + (i / (points.length - 1)) * w;
      const y = PAD + (1 - (v - minV) / range) * h;
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');
}

const Sparkline = () => (
  <svg
    width={SX}
    height={SY}
    viewBox={`0 0 ${SX} ${SY}`}
    aria-hidden="true"
    style={{
      position: 'absolute',
      top: 16,
      right: 16,
      zIndex: 1,
      pointerEvents: 'none',
    }}
  >
    <path
      d={buildSparklinePath(SPARKLINE_POINTS)}
      stroke="#00DDFF"
      strokeWidth="1.5"
      fill="none"
      opacity="0.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

/* ── Cosmos flagship hero ───────────────────────────────────────────────── */
const HomeHero = ({ patrimonyTotal, monthlyBalance, currentMonth, financialMonthStartDay = 1 }) => {
  const progress   = getProgress(currentMonth, financialMonthStartDay);
  const isPositive = monthlyBalance >= 0;

  return (
    <CosmosCard variant="hero" glow>

      {/* Decorative planet — upper-right, partially outside card bounds */}
      <div style={{ position: 'absolute', top: -10, right: -20, zIndex: 0 }}>
        <CosmosPlanet />
      </div>

      {/* Sparkline — top-right corner, floats over background */}
      <Sparkline />

      {/* Text column — left-aligned, max 70% width so sparkline has room */}
      <div style={{
        position: 'relative',
        zIndex: 1,
        maxWidth: '70%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        textAlign: 'left',
      }}>

        {/* Label */}
        <div className="h-hero-patrimony-label">Património total</div>

        {/* Big number — emotional anchor */}
        <div className="h-hero-patrimony-value">{fmt(patrimonyTotal)}€</div>

        {/* Monthly delta badge */}
        <div className="h-hero-balance-row">
          <span className={`h-hero-balance-badge ${isPositive ? 'positive' : 'negative'}`}>
            {isPositive ? '↑' : '↓'}&nbsp;
            {isPositive ? '+' : ''}{fmt(monthlyBalance)}€ este mês
          </span>
        </div>

        {/* Month progress — only shown in current financial month */}
        {progress && (
          <div className="h-hero-progress" style={{ width: '100%' }}>
            <div className="h-hero-progress-header">
              <span className="h-hero-progress-label">
                Dia {progress.passed} de {progress.total}
              </span>
              <span className="h-hero-progress-pct">{progress.pct}%</span>
            </div>
            <div className="h-hero-progress-track">
              <div className="h-hero-progress-fill" style={{ width: `${progress.pct}%` }} />
            </div>
          </div>
        )}

      </div>{/* end text column */}

    </CosmosCard>
  );
};

export default HomeHero;
