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

/* ── Cosmos flagship hero — Mockup 2 direction ──────────────────────────── */
const HomeHero = ({ patrimonyTotal, monthlyBalance, currentMonth, financialMonthStartDay = 1 }) => {
  const progress  = getProgress(currentMonth, financialMonthStartDay);
  const isPositive = monthlyBalance >= 0;

  return (
    <CosmosCard variant="hero" glow>

      {/* Decorative planet — upper-right, partially outside card bounds */}
      <div style={{ position: 'absolute', top: -10, right: -20, zIndex: 0 }}>
        <CosmosPlanet />
      </div>

      {/* Text content — sits above the planet */}
      <div style={{ position: 'relative', zIndex: 1 }}>

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
          <div className="h-hero-progress">
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

      </div>{/* end text layer */}

    </CosmosCard>
  );
};

export default HomeHero;
