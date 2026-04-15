import React from 'react';
import './HomeTab.css';

const HomeTab = ({ balance, income, expenses, transactions, currentMonth, onMonthChange }) => {
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

  const goToToday = () => {
    const today = new Date();
    const todayMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    onMonthChange(todayMonth);
  };

  const formatMonth = (monthStr) => {
    const [year, month] = monthStr.split('-');
    const date = new Date(year, parseInt(month) - 1);
    return date.toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' });
  };

  const getBalanceStatus = () => {
    if (balance > 0) return 'No verde este mês';
    if (balance < 0) return 'No vermelho este mês';
    return 'Equilibrado este mês';
  };

  // Get category icon mapping
  const getCategoryIcon = (categoryName) => {
    const iconMap = {
      'Alimentação': '⚑',
      'Habitação': '⌂',
      'Transporte': '⚐',
      'Saúde': '✚',
      'Lazer': '◉',
      'Educação': '⊞',
      'Roupa': '◫',
      'Tecnologia': '◧',
      'Subscrições': '◉',
      'Outros': '◌',
      'Salário': '◈',
      'Freelance': '◐',
      'Investimentos': '◭',
      'Bonus': '◆',
      'Outros Rendimentos': '◌'
    };
    return iconMap[categoryName] || '◌';
  };

  return (
    <div className="home-tab">
      {/* Balance Hero Card */}
      <div className="balance-card">
        <div className="balance-label">Saldo do Mês</div>
        <div className="balance-amount">
          {balance >= 0 ? '+' : ''}{balance.toFixed(2)}€
        </div>
        <div className="balance-status">{getBalanceStatus()}</div>
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
        <button className="month-btn-compact" onClick={goToPreviousMonth}>‹</button>
        <div className="month-display-compact">{formatMonth(currentMonth)}</div>
        <button className="month-btn-compact" onClick={goToNextMonth}>›</button>
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
            {transactions.slice(0, 5).map((transaction, index) => (
              <div key={index} className="transaction-item">
                <div className="transaction-icon">
                  {getCategoryIcon(transaction.category)}
                </div>
                <div className="transaction-details">
                  <div className="transaction-category">{transaction.category}</div>
                  {transaction.description && (
                    <div className="transaction-description">{transaction.description}</div>
                  )}
                </div>
                <div className={`transaction-amount ${transaction.type}`}>
                  {transaction.type === 'income' ? '+' : '-'}
                  {parseFloat(transaction.amount).toFixed(2)}€
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
