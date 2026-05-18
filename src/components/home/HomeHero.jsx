import React from 'react';
import { getFinancialMonthRange } from '../../utils/financialMonth';
import CosmosCard from '../cosmos/CosmosCard';

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

/* ── Sparkline — in-flow element, no position absolute ──────────────────── */
const SPARK_PTS  = '0,50 15,42 30,46 45,30 60,35 75,18 88,10';
const AREA_PATH  = `M ${SPARK_PTS.replace(/ /g, ' L ')} L 88,56 L 0,56 Z`;

const HeroSparkline = () => (
  <svg
    width="88" height="56" viewBox="0 0 88 56"
    aria-hidden="true"
    style={{ display: 'block', overflow: 'visible' }}
  >
    {/* Area fill */}
    <path d={AREA_PATH} fill="rgba(0,221,255,0.08)" stroke="none" />
    {/* Trend line */}
    <polyline
      points={SPARK_PTS}
      stroke="#00DDFF"
      strokeWidth="2"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

/* ── Hero ────────────────────────────────────────────────────────────────── */
const HomeHero = ({ patrimonyTotal, monthlyBalance, currentMonth, financialMonthStartDay = 1 }) => {
  const progress   = getProgress(currentMonth, financialMonthStartDay);
  const isPositive = monthlyBalance >= 0;

  return (
    <CosmosCard variant="hero" glow>

      {/* Two-column row layout */}
      <div style={{
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 0,
        padding: '16px 20px 28px 20px',
      }}>

        {/* ── LEFT COLUMN — all text content ── */}
        <div style={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          textAlign: 'left',
        }}>

          {/* Label */}
          <div className="h-hero-patrimony-label">Património total</div>

          {/* Big number */}
          <div className="h-hero-patrimony-value">{fmt(patrimonyTotal)}€</div>

          {/* Trend context */}
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

          {/* Month progress bar — unchanged */}
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

        </div>{/* end left column */}

        {/* ── RIGHT COLUMN — sparkline only ── */}
        <div style={{
          width: 88,
          flexShrink: 0,
          marginTop: 4,
        }}>
          <HeroSparkline />
        </div>

      </div>{/* end row */}

    </CosmosCard>
  );
};

export default HomeHero;
