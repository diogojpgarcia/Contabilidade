import React, { useState } from 'react';
import ModernTransactionList  from '../ModernTransactionList';
import DefaultTransactionList from '../DefaultTransactionList';
import './HomeTab.css';

const VIEW_LABELS = { total: 'Total', accounts: 'Contas', investments: 'Investimentos', realestate: 'Imóveis' };

const HomeTab = ({
  balance, income, expenses, transactions,
  currentMonth, onMonthChange,
  patrimony = {}, homePatrimonyView = 'total', onPatrimonyViewChange,
  onCategoryChange,
  onTransactionDeleted,
  theme = 'default',
}) => {
  const goToPreviousMonth = () => {
    const [year, month] = currentMonth.split('-').map(Number);
    const d = new Date(year, month - 2, 1);
    onMonthChange(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };

  const goToNextMonth = () => {
    const [year, month] = currentMonth.split('-').map(Number);
    const d = new Date(year, month, 1);
    onMonthChange(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };

  const goToToday = () => {
    const t = new Date();
    onMonthChange(`${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}`);
  };

  const formatMonth = (monthStr) => {
    const [year, month] = monthStr.split('-');
    return new Date(year, parseInt(month) - 1).toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' });
  };

  const [historyView, setHistoryView] = useState('daily');

  // 'daily'     → income + expense (regular transactions)
  // 'patrimony' → transfers + adjustments
  const filtered = transactions.filter(t =>
    historyView === 'daily'
      ? (t.type === 'expense' || t.type === 'income' || !t.type)
      : (t.type === 'transfer' || t.type === 'adjustment')
  );

  const getBalanceStatus = () => {
    if (balance > 0) return 'No verde este mês';
    if (balance < 0) return 'No vermelho este mês';
    return 'Equilibrado este mês';
  };

  // Patrimony totals
  const p = patrimony;
  const sumAccounts   = (p.accounts   || []).reduce((s, x) => s + (parseFloat(x.balance)  || 0), 0);
  const sumStocks     = (p.stocks     || []).reduce((s, x) => s + (parseFloat(x.qty)      || 0) * (parseFloat(x.avgPrice) || 0), 0);
  const sumBonds      = (p.bonds      || []).reduce((s, x) => s + (parseFloat(x.value)    || 0), 0);
  const sumRealestate = (p.realestate || []).reduce((s, x) => s + (parseFloat(x.value)    || 0), 0);
  const sumVehicles   = (p.vehicles   || []).reduce((s, x) => s + (parseFloat(x.value)    || 0), 0);
  const sumCrypto     = (p.crypto     || []).reduce((s, x) => s + (parseFloat(x.qty)      || 0) * (parseFloat(x.price) || 0), 0);

  const patrimonyTotals = {
    total:       sumAccounts + sumStocks + sumBonds + sumRealestate + sumVehicles + sumCrypto,
    accounts:    sumAccounts,
    investments: sumStocks + sumBonds + sumCrypto,
    realestate:  sumRealestate + sumVehicles,
  };
  const patrimonyValue = patrimonyTotals[homePatrimonyView] || 0;

  /* ── MODERN BRANCH ───────────────────────────────────────────────────── */
  if (theme === 'modern') {
    return (
      <div className="m-home">
        {/* Month navigation + history view toggle */}
        <div className="m-month-bar">
          <button className="m-month-btn" onClick={goToPreviousMonth}>‹</button>
          <span className="m-month-name">{formatMonth(currentMonth)}</span>
          <button className="m-month-btn" onClick={goToNextMonth}>›</button>
          <button className="m-today-btn" onClick={goToToday}>Hoje</button>
          <div style={{ display: 'flex', gap: '4px', marginLeft: 'auto' }}>
            <button
              onClick={() => setHistoryView('daily')}
              style={{
                padding: '4px 10px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600,
                background: historyView === 'daily' ? 'var(--accent, #6366f1)' : 'var(--surface-2, #f0f0f5)',
                color:      historyView === 'daily' ? '#fff' : 'var(--text-secondary, #666)',
              }}
              title="Transações diárias"
            >💳 Diário</button>
            <button
              onClick={() => setHistoryView('patrimony')}
              style={{
                padding: '4px 10px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600,
                background: historyView === 'patrimony' ? 'var(--accent, #6366f1)' : 'var(--surface-2, #f0f0f5)',
                color:      historyView === 'patrimony' ? '#fff' : 'var(--text-secondary, #666)',
              }}
              title="Transferências e ajustes"
            >🔁 Património</button>
          </div>
        </div>

        {/* Balance */}
        <div className="m-balance-section">
          <div className={`m-balance-amount ${balance >= 0 ? 'positive' : 'negative'}`}>
            {balance >= 0 ? '+' : ''}{balance.toFixed(2)}€
          </div>
          <div className="m-balance-label">Saldo do mês</div>
        </div>

        {/* Income / Expense chips */}
        <div className="m-chips">
          <div className="m-chip income">
            <span className="m-chip-label">Receitas</span>
            <span className="m-chip-amount">+{income.toFixed(2)}€</span>
          </div>
          <div className="m-chip expense">
            <span className="m-chip-label">Despesas</span>
            <span className="m-chip-amount">−{expenses.toFixed(2)}€</span>
          </div>
        </div>

        {/* Patrimony compact row */}
        <div className="m-patrimony-row">
          <span className="m-patrimony-label">Património</span>
          <select
            className="m-patrimony-select"
            value={homePatrimonyView}
            onChange={(e) => onPatrimonyViewChange && onPatrimonyViewChange(e.target.value)}
          >
            {Object.entries(VIEW_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <span className="m-patrimony-value">
            {patrimonyValue.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€
          </span>
        </div>

        {/* Transaction list */}
        <div className="m-txs">
          {filtered.length === 0 && (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-tertiary, #aaa)', fontSize: '0.9rem' }}>
              {historyView === 'patrimony' ? 'Sem transferências este mês' : 'Sem transações este mês'}
            </div>
          )}
          {filtered.length > 0 && (
            <ModernTransactionList
              transactions={filtered}
              onCategoryChange={onCategoryChange}
              onTransactionDeleted={onTransactionDeleted}
            />
          )}
        </div>
      </div>
    );
  }

  /* ── DEFAULT BRANCH ──────────────────────────────────────────────────── */
  return (
    <div className="home-tab">
      {/* Hero Cards Row */}
      <div className="hero-cards">
        <div className="hero-card hero-card-balance">
          <div className="hero-label">Saldo do Mês</div>
          <div className="hero-amount">{balance >= 0 ? '+' : ''}{balance.toFixed(2)}€</div>
          <div className="hero-status">{getBalanceStatus()}</div>
        </div>

        <div className="hero-card hero-card-patrimony">
          <div className="hero-card-top">
            <div className="hero-label">Património</div>
            <select
              className="patrimony-select"
              value={homePatrimonyView}
              onChange={(e) => onPatrimonyViewChange && onPatrimonyViewChange(e.target.value)}
            >
              {Object.entries(VIEW_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <div className="hero-amount hero-amount-patrimony">
            {patrimonyValue.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€
          </div>
          <div className="hero-status">{VIEW_LABELS[homePatrimonyView]}</div>
        </div>
      </div>

      {/* Mini Cards */}
      <div className="mini-cards">
        <div className="mini-card income">
          <div className="mini-card-label">Receitas</div>
          <div className="mini-card-amount">+{income.toFixed(2)}€</div>
        </div>
        <div className="mini-card expense">
          <div className="mini-card-label">Despesas</div>
          <div className="mini-card-amount">-{expenses.toFixed(2)}€</div>
        </div>
      </div>

      {/* Month Navigation + history view toggle */}
      <div className="month-navigation-compact">
        <button className="month-btn-compact" onClick={goToPreviousMonth}>&#8249;</button>
        <div className="month-display-compact">{formatMonth(currentMonth)}</div>
        <button className="month-btn-compact" onClick={goToNextMonth}>&#8250;</button>
        <button className="today-btn-compact" onClick={goToToday}>Hoje</button>
        <button
          className={`today-btn-compact${historyView === 'daily' ? ' active' : ''}`}
          onClick={() => setHistoryView('daily')}
          title="Transações diárias"
          style={{ marginLeft: '4px', background: historyView === 'daily' ? '#6366f1' : undefined, color: historyView === 'daily' ? '#fff' : undefined }}
        >💳</button>
        <button
          className={`today-btn-compact${historyView === 'patrimony' ? ' active' : ''}`}
          onClick={() => setHistoryView('patrimony')}
          title="Transferências e ajustes"
          style={{ background: historyView === 'patrimony' ? '#6366f1' : undefined, color: historyView === 'patrimony' ? '#fff' : undefined }}
        >🔁</button>
      </div>

      {/* Transaction list */}
      <div className="transactions-section">
        <h3 className="section-title">{historyView === 'patrimony' ? 'Transferências' : 'Recentes'}</h3>
        <DefaultTransactionList
          transactions={filtered}
          onCategoryChange={onCategoryChange}
        />
      </div>
    </div>
  );
};

export default HomeTab;
