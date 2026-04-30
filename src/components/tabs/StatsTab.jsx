import React, { useState, useMemo } from 'react';
import InsightsPanel from '../InsightsPanel.jsx';
import CategoryPicker from '../CategoryPicker.jsx';
import './StatsTab.css';
import './HomeTab.modern.css';

const StatsTab = ({ transactions, filteredTransactions, currentMonth, onMonthChange, categories, onTransactionDeleted, onCategoryChange, uiTheme = 'default' }) => {
  const [pickerTx, setPickerTx] = useState(null);

  const [activeView, setActiveView] = useState('overview'); // 'overview' or 'log'
  const [deleting, setDeleting] = useState(null);
  const [filterDate, setFilterDate] = useState(''); // Filter by specific date
  const [expandedId, setExpandedId] = useState(null); // modern-theme expanded card

  // Complete icon mapping for all categories
  const getCategoryIcon = (categoryName) => {
    const iconMap = {
      // Despesas
      'Habitação': '⌂',
      'Alimentação': '⚑',
      'Transporte': '⚐',
      'Saúde': '✚',
      'Educação': '⊞',
      'Comunicações': '◎',
      'Utilities': '⚡',
      'Roupa & Calçado': '◫',
      'Tecnologia': '◧',
      'Subscrições': '◉',
      'Lazer & Entretenimento': '◐',
      'Viagens & Férias': '✈︎',
      'Presentes & Doações': '◆',
      'Serviços Financeiros': '◈',
      'Animais de Estimação': '◧',
      'Crianças & Família': '◎',
      'Cuidados Pessoais': '◐',
      'Casa & Jardim': '⌂',
      'Impostos & Taxas': '◫',
      'Emergências': '⚠',
      'Outros': '◌',
      
      // Receitas
      'Salário Principal': '◈',
      'Subsídios': '◐',
      'Trabalho Extra / Freelance': '◧',
      'Investimentos': '◭',
      'Rendas Recebidas': '⌂',
      'Reembolsos': '◎',
      'Vendas': '◫',
      'Prémios & Sorteios': '◆',
      'Prendas & Doações Recebidas': '◆',
      'Outros Rendimentos': '◌'
    };
    return iconMap[categoryName] || '◌';
  };

  // Compute expenses by category from already-filtered transactions
  const computeExpensesByCategory = (txns) => {
    const byCategory = {};
    txns.filter(t => t.type === 'expense').forEach(t => {
      byCategory[t.category] = (byCategory[t.category] || 0) + parseFloat(t.amount);
    });
    const total = Object.values(byCategory).reduce((sum, val) => sum + val, 0);
    return Object.entries(byCategory)
      .map(([category, amount]) => ({
        category,
        amount,
        percentage: total > 0 ? (amount / total) * 100 : 0
      }))
      .sort((a, b) => b.amount - a.amount);
  };

  // Get sorted (and optionally date-filtered) transactions from already-filtered list
  const computeMonthTransactions = (txns) => {
    let sorted = [...txns].sort(
      (a, b) => new Date(b.created_at || b.timestamp || 0) - new Date(a.created_at || a.timestamp || 0)
    );
    if (filterDate) {
      sorted = sorted.filter(t => t.date === filterDate);
    }
    return sorted;
  };

  // Get last 6 months for chart
  const getLast6Months = () => {
    const months = [];
    const [year, month] = currentMonth.split('-').map(Number);
    
    for (let i = 5; i >= 0; i--) {
      const date = new Date(year, month - 1 - i, 1);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      months.push(monthKey);
    }
    
    return months;
  };

  // Get monthly data for chart
  const getMonthlyData = () => {
    const months = getLast6Months();
    
    return months.map(month => {
      const monthTransactions = transactions.filter(t => t.date && t.date.slice(0, 7) === month);
      const income = monthTransactions
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + parseFloat(t.amount), 0);
      const expenses = monthTransactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + parseFloat(t.amount), 0);
      
      return {
        month: month.substring(5) + '/' + month.substring(2, 4),
        income,
        expenses,
        balance: income - expenses
      };
    });
  };

  // Navigate months — delegates to App so currentMonth is the single source of truth
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

  // Format date
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const day = date.getDate();
    const month = date.toLocaleDateString('pt-PT', { month: 'short' });
    return `${day} ${month}`;
  };

  const handleCategoryClick = (tx) => {
    if (onCategoryChange) setPickerTx(tx);
  };

  const handlePickerSelect = (newCategory) => {
    if (pickerTx && onCategoryChange) {
      onCategoryChange(pickerTx.id, newCategory, pickerTx.description);
    }
    setPickerTx(null);
  };

  // Handle delete transaction — App.jsx owns the DB call and state update
  const handleDeleteTransaction = async (transactionId) => {
    if (!window.confirm('Tens a certeza que queres apagar esta transação?')) {
      return;
    }

    setDeleting(transactionId);

    try {
      if (onTransactionDeleted) {
        await onTransactionDeleted(transactionId);
      }
    } catch (error) {
      console.error('Error deleting transaction:', error);
      alert('Erro ao apagar transação: ' + error.message);
    } finally {
      setDeleting(null);
    }
  };

  // Derived from filteredTransactions (already filtered by currentMonth in App)
  const categoryData      = useMemo(() => computeExpensesByCategory(filteredTransactions),  [filteredTransactions]);
  const monthTransactions = useMemo(() => computeMonthTransactions(filteredTransactions),   [filteredTransactions, filterDate]);
  // 6-month chart still needs all transactions so it can look at past months
  const monthlyData       = useMemo(() => getMonthlyData(),                                 [transactions, currentMonth]);
  const maxAmount         = useMemo(
    () => Math.max(...monthlyData.map(m => Math.max(m.income, m.expenses))) || 1,
    [monthlyData]
  );

  // Get month name from the global currentMonth
  const [year, month] = currentMonth.split('-');
  const monthName = new Date(year, parseInt(month) - 1, 1).toLocaleDateString('pt-PT', {
    month: 'long',
    year: 'numeric'
  });

  return (
    <div className="stats-tab">
      <div className="stats-header">
        <h2>Estatísticas</h2>
        <p>Visão geral das finanças</p>
      </div>

      {/* View Toggle */}
      <div className="view-toggle view-toggle-3">
        <button
          className={`toggle-btn ${activeView === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveView('overview')}
        >
          <span className="sf-icon">◧</span>
          <span>Resumo</span>
        </button>
        <button
          className={`toggle-btn ${activeView === 'log' ? 'active' : ''}`}
          onClick={() => setActiveView('log')}
        >
          <span className="sf-icon">◫</span>
          <span>Histórico</span>
        </button>
        <button
          className={`toggle-btn ${activeView === 'insights' ? 'active' : ''}`}
          onClick={() => setActiveView('insights')}
        >
          <span className="sf-icon">◐</span>
          <span>Insights</span>
        </button>
      </div>

      {/* Month Selector */}
      <div className="month-selector">
        <button className="month-nav" onClick={goToPreviousMonth}>
          <span className="sf-icon">‹</span>
        </button>
        <div className="month-display">
          <span className="month-name">{monthName}</span>
        </div>
        <button 
          className="month-nav" 
          onClick={goToNextMonth}
          disabled={currentMonth === new Date().toISOString().slice(0, 7)}
        >
          <span className="sf-icon">›</span>
        </button>
      </div>

      {/* Overview View */}
      {activeView === 'overview' && (
        <>
          {/* Evolution Chart */}
          <div className="chart-section">
            <h3>Evolução (6 meses)</h3>
            <div className="chart-container">
              {monthlyData.map((data, index) => {
                const incomeHeight = (data.income / maxAmount) * 100;
                const expensesHeight = (data.expenses / maxAmount) * 100;
                
                return (
                  <div key={index} className="chart-column">
                    <div className="bars-container">
                      <div 
                        className="bar income-bar" 
                        style={{ height: `${incomeHeight}%` }}
                        title={`Receitas: ${data.income.toFixed(0)}€`}
                      />
                      <div 
                        className="bar expense-bar" 
                        style={{ height: `${expensesHeight}%` }}
                        title={`Despesas: ${data.expenses.toFixed(0)}€`}
                      />
                    </div>
                    <span className="month-label">{data.month}</span>
                  </div>
                );
              })}
            </div>
            <div className="chart-legend">
              <div className="legend-item">
                <span className="legend-color income"></span>
                <span>Receitas</span>
              </div>
              <div className="legend-item">
                <span className="legend-color expense"></span>
                <span>Despesas</span>
              </div>
            </div>
          </div>

          {/* Category Breakdown */}
          <div className="categories-section">
            <h3>Despesas por Categoria</h3>
            {categoryData.length === 0 ? (
              <div className="empty-state">
                <span className="sf-icon-large">◌</span>
                <p>Sem despesas neste mês</p>
              </div>
            ) : (
              <div className="categories-list">
                {categoryData.map((item, index) => (
                  <div key={index} className="category-item">
                    <div className="category-info">
                      <span className="category-icon">{getCategoryIcon(item.category)}</span>
                      <span className="category-name">{item.category}</span>
                    </div>
                    <div className="category-stats">
                      <span className="category-amount">{item.amount.toFixed(2)}€</span>
                      <div className="category-bar-container">
                        <div 
                          className="category-bar-fill" 
                          style={{ width: `${item.percentage}%` }}
                        />
                      </div>
                      <span className="category-percentage">{item.percentage.toFixed(0)}%</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Transaction Log View */}
      {activeView === 'log' && (
        <div className="transaction-log">
          <div className="log-header">
            <h3>Todas as Transações</h3>
            <div className="date-filter">
              <div className="date-input-wrapper">
                <input
                  type="date"
                  className="date-filter-input"
                  value={filterDate}
                  onChange={(e) => setFilterDate(e.target.value)}
                  max={new Date().toISOString().split('T')[0]}
                />
                <span className="calendar-icon">◷</span>
              </div>
              {filterDate && (
                <button 
                  className="clear-filter-btn"
                  onClick={() => setFilterDate('')}
                  title="Limpar filtro"
                >
                  ×
                </button>
              )}
            </div>
          </div>
          {monthTransactions.length === 0 ? (
            <div className="empty-state">
              <span className="sf-icon-large">◌</span>
              <p>{filterDate ? 'Sem transações neste dia' : 'Sem transações neste mês'}</p>
            </div>
          ) : uiTheme === 'modern' ? (
            /* ── Modern expandable cards ── */
            <div className="modern-tx-list">
              {monthTransactions.map((tx) => {
                const isExpanded = expandedId === tx.id;
                return (
                  <div
                    key={tx.id}
                    className={`modern-tx-card ${tx.type}${isExpanded ? ' expanded' : ''}`}
                    onClick={() => setExpandedId(isExpanded ? null : tx.id)}
                  >
                    <div className="modern-tx-row">
                      <div className={`modern-tx-icon ${tx.type}`}>{getCategoryIcon(tx.category)}</div>
                      <div className="modern-tx-main">
                        <span className="modern-tx-desc">{tx.description || tx.category}</span>
                        <span className="modern-tx-cat">{tx.category}</span>
                      </div>
                      <div className={`modern-tx-amount ${tx.type}`}>
                        {tx.type === 'income' ? '+' : '-'}{parseFloat(tx.amount).toFixed(2)}€
                      </div>
                    </div>
                    {isExpanded && (
                      <div className="modern-tx-details" onClick={(e) => e.stopPropagation()}>
                        <span className="modern-tx-date">{formatDate(tx.date)}</span>
                        {onCategoryChange && (
                          <button
                            className="modern-tx-edit-cat"
                            onClick={() => { handleCategoryClick(tx); setExpandedId(null); }}
                          >
                            ✎ Categoria
                          </button>
                        )}
                        <button
                          className="modern-tx-delete"
                          onClick={() => handleDeleteTransaction(tx.id)}
                          disabled={deleting === tx.id}
                        >
                          {deleting === tx.id ? '⏳' : '🗑'}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            /* ── Default list ── */
            <div className="transactions-list">
              {monthTransactions.map((transaction, index) => (
                <div
                  key={transaction.id || index}
                  className={`transaction-item ${transaction.type}`}
                >
                  <div className="transaction-left">
                    <span className="transaction-icon">
                      {getCategoryIcon(transaction.category)}
                    </span>
                    <div className="transaction-details">
                      <span
                        className={`transaction-category${onCategoryChange ? ' transaction-category--editable' : ''}`}
                        onClick={() => handleCategoryClick(transaction)}
                        title={onCategoryChange ? 'Toca para alterar categoria' : undefined}
                      >
                        {transaction.category}
                        {onCategoryChange && <span className="category-edit-hint">&#8250;</span>}
                      </span>
                      {transaction.description && (
                        <span className="transaction-description">{transaction.description}</span>
                      )}
                    </div>
                  </div>
                  <div className="transaction-right">
                    <div className="transaction-info">
                      <span className={`transaction-amount ${transaction.type}`}>
                        {transaction.type === 'income' ? '+' : '-'}{parseFloat(transaction.amount).toFixed(2)}€
                      </span>
                      <span className="transaction-date">{formatDate(transaction.date)}</span>
                    </div>
                    <button
                      className="delete-btn"
                      onClick={() => handleDeleteTransaction(transaction.id)}
                      disabled={deleting === transaction.id}
                      title="Apagar transação"
                    >
                      {deleting === transaction.id ? '⏳' : '🗑️'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          
          {/* Summary at bottom */}
          {monthTransactions.length > 0 && (
            <div className="log-summary">
              <div className="summary-row">
                <span className="summary-label">Total Receitas</span>
                <span className="summary-value income">
                  +{monthTransactions
                    .filter(t => t.type === 'income')
                    .reduce((sum, t) => sum + parseFloat(t.amount), 0)
                    .toFixed(2)}€
                </span>
              </div>
              <div className="summary-row">
                <span className="summary-label">Total Despesas</span>
                <span className="summary-value expense">
                  -{monthTransactions
                    .filter(t => t.type === 'expense')
                    .reduce((sum, t) => sum + parseFloat(t.amount), 0)
                    .toFixed(2)}€
                </span>
              </div>
              <div className="summary-row total">
                <span className="summary-label">Saldo</span>
                <span className={`summary-value ${
                  monthTransactions
                    .filter(t => t.type === 'income')
                    .reduce((sum, t) => sum + parseFloat(t.amount), 0) -
                  monthTransactions
                    .filter(t => t.type === 'expense')
                    .reduce((sum, t) => sum + parseFloat(t.amount), 0) >= 0
                    ? 'income'
                    : 'expense'
                }`}>
                  {(monthTransactions
                    .filter(t => t.type === 'income')
                    .reduce((sum, t) => sum + parseFloat(t.amount), 0) -
                  monthTransactions
                    .filter(t => t.type === 'expense')
                    .reduce((sum, t) => sum + parseFloat(t.amount), 0)).toFixed(2)}€
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {activeView === 'insights' && (
        <InsightsPanel
          transactions={transactions}
          currentMonth={currentMonth}
        />
      )}

      {/* Category Picker */}
      {pickerTx && (
        <CategoryPicker
          transaction={pickerTx}
          onSelect={handlePickerSelect}
          onClose={() => setPickerTx(null)}
        />
      )}
    </div>
  );
};

export default StatsTab;
