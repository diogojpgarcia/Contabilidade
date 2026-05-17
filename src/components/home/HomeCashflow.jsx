import React from 'react';
import { shiftFinancialMonth, getCurrentFinancialMonth, getFinancialMonthLabel } from '../../utils/financialMonth';
import CosmosCard from '../cosmos/CosmosCard';
import CosmosSectionHeader from '../cosmos/CosmosSectionHeader';

/* ── Logic unchanged ────────────────────────────────────────────────────── */
const HomeCashflow = ({ income, expenses, balance, currentMonth, onMonthChange, financialMonthStartDay = 1 }) => {
  const goPrev  = () => onMonthChange(shiftFinancialMonth(currentMonth, -1));
  const goNext  = () => onMonthChange(shiftFinancialMonth(currentMonth,  1));
  const goToday = () => onMonthChange(getCurrentFinancialMonth(financialMonthStartDay));
  const label   = getFinancialMonthLabel(currentMonth, financialMonthStartDay);

  return (
    <CosmosCard variant="standard">

      {/* Header row: title left, month nav right */}
      <CosmosSectionHeader
        title="Este mês"
        action={
          <div className="h-month-nav-compact">
            <button className="h-month-btn" onClick={goPrev}>‹</button>
            <span className="h-month-name">{label}</span>
            <button className="h-month-btn" onClick={goNext}>›</button>
            <button className="h-today-btn" onClick={goToday}>Hoje</button>
          </div>
        }
        style={{ marginBottom: 14 }}
      />

      {/* 3-col cashflow grid — untouched */}
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
