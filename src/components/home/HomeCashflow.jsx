import React from 'react';
import { shiftFinancialMonth, getCurrentFinancialMonth, getFinancialMonthLabel } from '../../utils/financialMonth';
import CosmosCard from '../cosmos/CosmosCard';

/* ── Logic unchanged ────────────────────────────────────────────────────── */
const HomeCashflow = ({ income, expenses, balance, currentMonth, onMonthChange, financialMonthStartDay = 1 }) => {
  const goPrev  = () => onMonthChange(shiftFinancialMonth(currentMonth, -1));
  const goNext  = () => onMonthChange(shiftFinancialMonth(currentMonth,  1));
  const goToday = () => onMonthChange(getCurrentFinancialMonth(financialMonthStartDay));
  const rawLabel = getFinancialMonthLabel(currentMonth, financialMonthStartDay);
  // Capitalise first letter: "maio de 2026" → "Maio de 2026"
  const label = rawLabel.charAt(0).toUpperCase() + rawLabel.slice(1);

  return (
    <CosmosCard variant="standard">

      {/* Header: month name + nav (left) | Ver detalhes (right) */}
      <div className="h-cashflow-header">
        <div className="h-cashflow-nav" aria-label="Navegação de mês">
          <button className="h-month-btn" onClick={goPrev} aria-label="Mês anterior">‹</button>
          <span className="h-cashflow-month-label">{label}</span>
          <button className="h-month-btn" onClick={goNext} aria-label="Próximo mês">›</button>
          <button className="h-today-btn" onClick={goToday}>Hoje</button>
        </div>
        <button className="h-cashflow-details-btn" aria-label="Ver detalhes das estatísticas">
          Ver detalhes →
        </button>
      </div>

      {/* 3-col cashflow grid */}
      <div className="h-cashflow-grid">
        <div className="h-cf-col">
          <span className="h-cf-label">Receitas</span>
          <span className="h-cf-amount income">+{income.toFixed(0)}€</span>
        </div>
        <div className="h-cf-col">
          <span className="h-cf-label">Despesas</span>
          <span className="h-cf-amount expense">−{expenses.toFixed(0)}€</span>
        </div>
        <div className="h-cf-col">
          <span className="h-cf-label">Saldo</span>
          <span className={`h-cf-amount ${balance >= 0 ? 'positive' : 'negative'}`}>
            {balance >= 0 ? '+' : ''}{balance.toFixed(0)}€
          </span>
        </div>
      </div>

    </CosmosCard>
  );
};

export default HomeCashflow;
