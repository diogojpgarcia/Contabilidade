import React from 'react';
import ModernTransactionList      from '../ModernTransactionList';
import DefaultTransactionList     from '../DefaultTransactionList';
import FintechTransactionCard     from '../FintechTransactionCard';
import './HomeTab.css';

/* ── Transfer dedup (mirrors StatsTab / ModernTransactionList) ──────────── */
function getTransferFlow(tx) {
  const desc = (tx.description || '').trim();
  const toMatch   = desc.match(/^Transferência para (.+)$/i);
  const fromMatch = desc.match(/^Transferência de (.+)$/i);
  if (toMatch)   return `${tx.category} → ${toMatch[1]}`;
  if (fromMatch) return `${fromMatch[1]} → ${tx.category}`;
  return desc || tx.category || 'Transferência';
}

function dedupeTransfers(txs) {
  const seen = new Set();
  return txs.filter(tx => {
    if (tx.type !== 'transfer') return true;
    const key = `${tx.date}|${parseFloat(tx.amount || 0).toFixed(2)}|${getTransferFlow(tx)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/* ── Formatting helpers ──────────────────────────────────────────────────── */
function fmtBalance(val) {
  return val.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const VIEW_LABELS = { total: 'Total', accounts: 'Contas', investments: 'Investimentos', realestate: 'Imóveis' };

const HomeTab = ({
  balance, income, expenses, totalBalance = 0, transactions,
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

  /* ── MODERN / FINTECH BRANCH ─────────────────────────────────────────── */
  if (theme === 'modern' || theme === 'fintech') {
    return (
      <div className="m-home">
        {/* Month navigation */}
        <div className="m-month-bar">
          <button className="m-month-btn" onClick={goToPreviousMonth}>‹</button>
          <span className="m-month-name">{formatMonth(currentMonth)}</span>
          <button className="m-month-btn" onClick={goToNextMonth}>›</button>
          <button className="m-today-btn" onClick={goToToday}>Hoje</button>
        </div>

        {/* Monthly balance */}
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

        {/* ── Total (lifetime) balance card ── */}
        <div className="m-total-balance-card">
          <div className="m-total-balance-inner">
            <div className="m-total-balance-left">
              <span className="m-total-balance-label">Saldo total</span>
              <span className="m-total-balance-sub">Desde o início</span>
            </div>
            <span className="m-total-balance-value">
              {fmtBalance(totalBalance)}€
            </span>
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
            {fmtBalance(patrimonyValue)}€
          </span>
        </div>

        {/* Transaction list */}
        <div className="m-txs">
          {theme === 'fintech' ? (
            <div className="ftc-list">
              {dedupeTransfers(transactions).map(tx => (
                <FintechTransactionCard
                  key={tx.id}
                  tx={tx}
                  onCategoryChange={onCategoryChange}
                  onDelete={onTransactionDeleted}
                />
              ))}
            </div>
          ) : (
            <ModernTransactionList
              transactions={transactions}
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
            {fmtBalance(patrimonyValue)}€
          </div>
          <div className="hero-status">{VIEW_LABELS[homePatrimonyView]}</div>
        </div>
      </div>

      {/* Total balance + mini cards row */}
      <div className="mini-cards">
        <div className="mini-card income">
          <div className="mini-card-label">Receitas</div>
          <div className="mini-card-amount">+{income.toFixed(2)}€</div>
        </div>
        <div className="mini-card expense">
          <div className="mini-card-label">Despesas</div>
          <div className="mini-card-amount">-{expenses.toFixed(2)}€</div>
        </div>
        <div className="mini-card total-balance">
          <div className="mini-card-label">Saldo total</div>
          <div className="mini-card-amount">{fmtBalance(totalBalance)}€</div>
        </div>
      </div>

      {/* Month Navigation */}
      <div className="month-navigation-compact">
        <button className="month-btn-compact" onClick={goToPreviousMonth}>&#8249;</button>
        <div className="month-display-compact">{formatMonth(currentMonth)}</div>
        <button className="month-btn-compact" onClick={goToNextMonth}>&#8250;</button>
        <button className="today-btn-compact" onClick={goToToday}>Hoje</button>
      </div>

      {/* Transaction list */}
      <div className="transactions-section">
        <h3 className="section-title">Recentes</h3>
        <DefaultTransactionList
          transactions={transactions}
          onCategoryChange={onCategoryChange}
        />
      </div>
    </div>
  );
};

export default HomeTab;
