import React from 'react';
import './HomeTab.css';

const VIEW_LABELS = { total: 'Total', accounts: 'Contas', investments: 'Investimentos', realestate: 'Imóveis' };

const HomeTab = ({ balance, income, expenses, transactions, currentMonth, onMonthChange, patrimony = {}, homePatrimonyView = 'total', onPatrimonyViewChange }) => {
  const goToPreviousMonth = () => {
    const [year, month] = currentMonth.split('-').map(Number);
    const prevDate = new Date(year, month - 2, 1);
    onMonthChange(`${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`);
  };

  const goToNextMonth = () => {
    const [year, month] = currentMonth.split('-').map(Number);
    const nextDate = new Date(year, month, 1);
    onMonthChange(`${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}`);
  };

  const goToToday = () => {
    const today = new Date();
    onMonthChange(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`);
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

  const getCategoryIcon = (categoryName) => {
    const iconMap = {
      'Alimentação': '⚑', 'Habitação': '⌂', 'Transporte': '⚐', 'Saúde': '✚',
      'Lazer': '◉', 'Educação': '⊞', 'Roupa': '◫', 'Tecnologia': '◧',
      'Subscrições': '◉', 'Outros': '◌', 'Salário': '◈', 'Freelance': '◐',
      'Investimentos': '◭', 'Bonus': '◆', 'Outros Rendimentos': '◌'
    };
    return iconMap[categoryName] || '◌';
  };

  // Patrimony totals
  const p = patrimony;
  const sumAccounts   = (p.accounts   || []).reduce((s, x) => s + (parseFloat(x.balance) || 0), 0);
  const sumStocks     = (p.stocks     || []).reduce((s, x) => s + (parseFloat(x.qty) || 0) * (parseFloat(x.avgPrice) || 0), 0);
  const sumBonds      = (p.bonds      || []).reduce((s, x) => s + (parseFloat(x.value) || 0), 0);
  const sumRealestate = (p.realestate || []).reduce((s, x) => s + (parseFloat(x.value) || 0), 0);
  const sumVehicles   = (p.vehicles   || []).reduce((s, x) => s + (parseFloat(x.value) || 0), 0);
  const sumCrypto     = (p.crypto     || []).reduce((s, x) => s + (parseFloat(x.qty) || 0) * (parseFloat(x.price) || 0), 0);

  const patrimonyTotals = {
    total:       sumAccounts + sumStocks + sumBonds + sumRealestate + sumVehicles + sumCrypto,
    accounts:    sumAccounts,
    investments: sumStocks + sumBonds + sumCrypto,
    realestate:  sumRealestate + sumVehicles,
  };

  const patrimonyValue = patrimonyTotals[homePatrimonyView] || 0;

  return (
    <div className="home-tab">
      {/* Hero Cards Row */}
      <div className="hero-cards">
        {/* Left — Saldo do Mês */}
        <div className="hero-card hero-card-balance">
          <div className="hero-label">Saldo do Mês</div>
          <div className="hero-amount">
            {balance >= 0 ? '+' : ''}{balance.toFixed(2)}€
          </div>
          <div className="hero-status">{getBalanceStatus()}</div>
        </div>

        {/* Right — Património */}
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

      {/* Month Navigation - Compact */}
      <div className="month-navigation-compact">
        <button className="month-btn-compact" onClick={goToPreviousMonth}>&#8249;</button>
        <div className="month-display-compact">{formatMonth(currentMonth)}</div>
        <button className="month-btn-compact" onClick={goToNextMonth}>&#8250;</button>
        <button className="today-btn-compact" onClick={goToToday}>Hoje</button>
      </div>

      {/* Recent Transactions */}
      <div className="transactions-section">
        <h3 className="section-title">Recentes</h3>
        {transactions.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">◌</div>
            <p className="empty-text">Sem transações este mês</p>
          </div>
        ) : (
          <div className="transactions-list">
            {transactions.map((transaction, index) => (
              <div key={index} className="transaction-item">
                <div className="transaction-icon">{getCategoryIcon(transaction.category)}</div>
                <div className="transaction-details">
                  <div className="transaction-category">{transaction.category}</div>
                  {transaction.description && (
                    <div className="transaction-description">{transaction.description}</div>
                  )}
                </div>
                <div className={`transaction-amount ${transaction.type}`}>
                  {transaction.type === 'income' ? '+' : '-'}{parseFloat(transaction.amount).toFixed(2)}€
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default HomeTab;
