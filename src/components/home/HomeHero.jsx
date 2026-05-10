import React from 'react';
import { getFinancialMonthRange } from '../../utils/financialMonth';

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

const HomeHero = ({ patrimonyTotal, monthlyBalance, currentMonth, financialMonthStartDay = 1 }) => {
  const progress = getProgress(currentMonth, financialMonthStartDay);

  return (
    <div className="h-hero">
      <div className="h-hero-patrimony-label">Património total</div>
      <div className="h-hero-patrimony-value">{fmt(patrimonyTotal)}€</div>

      <div className="h-hero-balance-row">
        <div className={`h-hero-balance-badge ${monthlyBalance >= 0 ? 'positive' : 'negative'}`}>
          {monthlyBalance >= 0 ? '+' : ''}{fmt(monthlyBalance)}€ este mês
        </div>
      </div>

      {progress && (
        <div className="h-hero-progress">
          <div className="h-hero-progress-label">
            Dia {progress.passed} de {progress.total} ({progress.pct}%)
          </div>
          <div className="h-hero-progress-track">
            <div className="h-hero-progress-fill" style={{ width: `${progress.pct}%` }} />
          </div>
        </div>
      )}
    </div>
  );
};

export default HomeHero;
