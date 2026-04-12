import React from 'react';
import './HomeTab.css';

const HomeTab = ({ 
  balance, 
  income, 
  expenses, 
  transactions,
  currentMonth,
  onMonthChange 
}) => {
  // Get last 5 transactions
  const recentTransactions = transactions.slice(0, 5);

  // Navigate months
  const goToPreviousMonth = () => {
    const [year, month] = currentMonth.split('-').map(Number);
    const prevDate = new Date(year, month - 2, 1);
    const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
    onMonthChange(prevMonth);
  };

  const goToNextMonth = () => {
    const [year, month] = currentMonth.split('-').map(Number);
    const nextDate = new Date(year, month, 1);
    const nextMonth = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}`;
    onMonthChange(nextMonth);
  };

  const goToCurrentMonth = () => {
    const now = new Date();
    const current = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    onMonthChange(current);
  };

  const isCurrentMonth = () => {
    const now = new Date();
    const current = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    return currentMonth === current;
  };

  return (
    <div className="home-tab">
      {/* Month Navigation */}
      <div className="month-nav">
        <button className="month-nav-btn" onClick={goToPreviousMonth}>
          ←
        </button>
        <div className="month-display-group">
          <h2 className="month-title">{currentMonth}</h2>
          {!isCurrentMonth() && (
            <button className="btn-current-month" onClick={goToCurrentMonth}>
              Hoje
            </button>
          )}
        </div>
        <button className="month-nav-btn" onClick={goToNextMonth}>
          →
        </button>
      </div>

      {/* Balance Card - Hero */}
      <div className={`balance-hero ${balance >= 0 ? 'positive' : 'negative'}`}>
        <div className="balance-label">Saldo do Mês</div>
        <div className="balance-amount">
          {balance >= 0 ? '+' : ''}{balance.toFixed(2)}€
        </div>
        <div className="balance-subtext">
          {balance >= 0 ? 'Estás no verde! 🎉' : 'Atenção aos gastos ⚠️'}
        </div>
      </div>

      {/* Mini Cards */}
      <div className="mini-cards">
        <div className="mini-card income-card">
          <div className="mini-card-icon">💰</div>
          <div className="mini-card-content">
            <div className="mini-card-label">Receitas</div>
            <div className="mini-card-value">+{income.toFixed(2)}€</div>
          </div>
        </div>

        <div className="mini-card expense-card">
          <div className="mini-card-icon">💳</div>
          <div className="mini-card-content">
            <div className="mini-card-label">Despesas</div>
            <div className="mini-card-value">-{expenses.toFixed(2)}€</div>
          </div>
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="recent-section">
        <h3 className="section-title">Transações Recentes</h3>
        {recentTransactions.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📝</div>
            <p>Ainda sem transações este mês</p>
            <p className="empty-subtext">Adiciona a primeira!</p>
          </div>
        ) : (
          <div className="transactions-list">
            {recentTransactions.map(t => (
              <div key={t.id} className="transaction-item">
                <div className="transaction-left">
                  <div className="transaction-category">{t.category}</div>
                  <div className="transaction-description">{t.description}</div>
                </div>
                <div className={`transaction-amount ${t.type}`}>
                  {t.type === 'income' ? '+' : '-'}{parseFloat(t.amount).toFixed(2)}€
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
