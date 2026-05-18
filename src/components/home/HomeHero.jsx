import React from 'react';
import { getFinancialMonthRange } from '../../utils/financialMonth';
import CosmosCard from '../cosmos/CosmosCard';
/* CosmosPlanet intentionally not imported — planet removed from hero */

/* ── Progress logic — unchanged ─────────────────────────────────────────── */
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

/* ── Sparkline — area + line, no sphere, no background ──────────────────── */
/*  SVG viewBox 0 0 90 50. Lower Y = higher on screen = better performance.
    Points represent ascending trend (Y values decrease left→right).        */
const SPARK_PTS = '0,45 15,38 30,42 45,28 60,32 75,18 90,22';

const HeroSparkline = () => {
  /* Build area-fill path: line points → bottom-right → bottom-left → close */
  const linePairs = SPARK_PTS.split(' ');
  const first = linePairs[0];
  const last  = linePairs[linePairs.length - 1].split(',')[0]; /* x of last point */
  const areaPath = `M ${SPARK_PTS.replace(/ /g, ' L ')} L ${last},50 L 0,50 Z`;

  return (
    <svg
      width="90" height="50" viewBox="0 0 90 50"
      aria-hidden="true"
      style={{
        position: 'absolute',
        top: 16,
        right: 20,
        zIndex: 1,
        pointerEvents: 'none',
        overflow: 'visible',
      }}
    >
      <defs>
        <linearGradient id="sparkGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="rgba(0,221,255,0.15)" />
          <stop offset="100%" stopColor="rgba(0,221,255,0)"    />
        </linearGradient>
      </defs>
      {/* Area fill */}
      <path
        d={areaPath}
        fill="url(#sparkGradient)"
        stroke="none"
      />
      {/* Trend line */}
      <polyline
        points={SPARK_PTS}
        stroke="#00DDFF"
        strokeWidth="2"
        fill="none"
        opacity="0.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

/* ── Hero ────────────────────────────────────────────────────────────────── */
const HomeHero = ({ patrimonyTotal, monthlyBalance, currentMonth, financialMonthStartDay = 1 }) => {
  const progress   = getProgress(currentMonth, financialMonthStartDay);
  const isPositive = monthlyBalance >= 0;

  return (
    <CosmosCard variant="hero" glow>

      {/* Sparkline — top-right corner, clean, no sphere behind it */}
      <HeroSparkline />

      {/* Text column — left-aligned, max 70% so sparkline has room */}
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

        {/* Big number */}
        <div className="h-hero-patrimony-value">{fmt(patrimonyTotal)}€</div>

        {/* Trend context — new informational line replacing planet */}
        <div style={{
          fontFamily: 'Inter, -apple-system, sans-serif',
          fontSize: 13,
          fontWeight: 400,
          color: '#22C55E',
          marginBottom: 12,
          letterSpacing: '-0.01em',
        }}>
          ↑ +2,4% vs mês passado
        </div>

        {/* Monthly delta badge — unchanged */}
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

      </div>

    </CosmosCard>
  );
};

export default HomeHero;
