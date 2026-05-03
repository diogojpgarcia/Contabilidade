import React, { useState, useMemo } from 'react';
import CategoryPicker from '../CategoryPicker.jsx';
import ModernTransactionList from '../ModernTransactionList';
import FintechTransactionCard from '../FintechTransactionCard';
import { Bubble, Card } from '../ui';
import { generateInsights, shiftMonth } from '../../utils/insights';
import './StatsTab.css';
import './HomeTab.modern.css';

const INSIGHT_ICONS = {
  budget_exceeded:   '⚠',
  budget_warning:    '⚡',
  prediction:        '◎',
  category_increase: '↑',
  top_category:      '★',
  trend:             '↗',
};

const INSIGHT_COLORS = {
  risk: '#ef4444',
  warn: '#F59E0B',
  good: '#22c55e',
  info: '#6B7280',
};

/* Transfer flow helper (mirrors ModernTransactionList / DefaultTransactionList) */
function getTransferFlow(tx) {
  const desc = (tx.description || '').trim();
  const toMatch   = desc.match(/^Transferência para (.+)$/i);
  const fromMatch = desc.match(/^Transferência de (.+)$/i);
  if (toMatch)   return `${tx.category} → ${toMatch[1]}`;
  if (fromMatch) return `${fromMatch[1]} → ${tx.category}`;
  return desc || tx.category || 'Transferência';
}

const StatsTab = ({ transactions, filteredTransactions, currentMonth, onMonthChange, categories, budgets = {}, onTransactionDeleted, onCategoryChange, theme = 'default' }) => {
  console.log('REAL STATS TAB LOADED');
  console.log('RENDER STATS');
  console.log('ACTIVE THEME:', theme);
  console.log('transactions:', transactions);
  console.log('budgets:', budgets);

  const [pickerTx, setPickerTx] = useState(null);

  const [activeView, setActiveView] = useState('overview'); // 'overview' or 'log'
  const [deleting, setDeleting] = useState(null);
  const [filterDate, setFilterDate] = useState(''); // Filter by specific date
  const [expandedId, setExpandedId] = useState(null); // modern-theme expanded card
  const [historyView, setHistoryView] = useState('daily'); // 'daily' | 'patrimony'

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
  // Further filter the log list by historyView (daily = expense+income, patrimony = transfer+adjustment)
  // Transfer pairs (out + in) share the same date/amount/flow — dedupe keeps only the first.
  const visibleTransactions = useMemo(() => {
    const filtered = monthTransactions.filter(t =>
      historyView === 'daily'
        ? (t.type === 'expense' || t.type === 'income' || !t.type)
        : (t.type === 'transfer' || t.type === 'adjustment')
    );
    // Deduplicate paired transfer records
    const seen = new Set();
    return filtered.filter(t => {
      if (t.type !== 'transfer') return true;
      const key = `${t.date}|${t.amount}|${getTransferFlow(t)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [monthTransactions, historyView]);
  // 6-month chart still needs all transactions so it can look at past months
  const monthlyData       = useMemo(() => getMonthlyData(),                                 [transactions, currentMonth]);
  const maxAmount         = useMemo(
    () => Math.max(...monthlyData.map(m => Math.max(m.income, m.expenses))) || 1,
    [monthlyData]
  );

  const insights = useMemo(() => {
    try {
      const items = generateInsights({ transactions, budgets, categories, selectedMonth: currentMonth });
      console.log('items:', items);
      return items;
    } catch (e) {
      console.error('[Insights] generateInsights threw:', e);
      return [];
    }
  }, [transactions, budgets, categories, currentMonth]);

  // Get month name from the global currentMonth
  const [year, month] = currentMonth.split('-');
  const monthName = new Date(year, parseInt(month) - 1, 1).toLocaleDateString('pt-PT', {
    month: 'long',
    year: 'numeric'
  });

  // ── derived totals for chips ──
  const monthIncome   = filteredTransactions.filter(t => t.type === 'income') .reduce((s, t) => s + parseFloat(t.amount), 0);
  const monthExpenses = filteredTransactions.filter(t => t.type === 'expense').reduce((s, t) => s + parseFloat(t.amount), 0);
  const monthSaldo    = monthIncome - monthExpenses;

  // ── previous-month totals for delta ──
  const prevMonthKey      = shiftMonth(currentMonth, -1);
  const prevMonthIncome   = transactions.filter(t => t.type === 'income'  && t.date && t.date.startsWith(prevMonthKey)).reduce((s, t) => s + parseFloat(t.amount), 0);
  const prevMonthExpenses = transactions.filter(t => t.type === 'expense' && t.date && t.date.startsWith(prevMonthKey)).reduce((s, t) => s + parseFloat(t.amount), 0);
  const prevMonthSaldo    = prevMonthIncome - prevMonthExpenses;
  const saldoDelta        = monthSaldo - prevMonthSaldo;

  const fmt = (n) => {
    const abs = Math.abs(n).toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return `€${abs}`;
  };
  const saldoDeltaLabel = (saldoDelta >= 0 ? '↑ +' : '↓ ') + fmt(Math.abs(saldoDelta)) + ' vs mês anterior';

  console.log('INSIGHTS ITEMS:', insights);

  /* ── MODERN / FINTECH BRANCH ───────────────────────────────────────────── */
  if (theme === 'modern' || theme === 'fintech') {
    return (
      <div className="m-page">
        {/* Header */}
        <div className="m-stats-header">
          <span className="m-stats-title">Estatísticas</span>
        </div>

        {/* View toggle */}
        <div className="m-toggle">
          <button className={`m-toggle-btn ${activeView === 'overview'  ? 'active' : ''}`} onClick={() => setActiveView('overview')}>Resumo</button>
          <button className={`m-toggle-btn ${activeView === 'log'       ? 'active' : ''}`} onClick={() => setActiveView('log')}>Histórico</button>
          <button className={`m-toggle-btn ${activeView === 'insights'  ? 'active' : ''}`} onClick={() => setActiveView('insights')}>Insights</button>
        </div>

        {/* Diário / Património — only shown in Histórico */}
        {activeView === 'log' && (
          <div style={{ display: 'flex', justifyContent: 'center', margin: '12px 0 0' }}>
            <div style={{ display: 'inline-flex', gap: 4, background: '#18181b', padding: 4, borderRadius: 12 }}>
              <button
                onClick={() => setHistoryView('daily')}
                style={{
                  padding: '6px 20px', borderRadius: 8, border: 'none', cursor: 'pointer',
                  fontSize: '0.8125rem', fontWeight: 500,
                  background: historyView === 'daily' ? '#6366f1' : 'transparent',
                  color:      historyView === 'daily' ? '#fff' : '#71717a',
                }}
              >Diário</button>
              <button
                onClick={() => setHistoryView('patrimony')}
                style={{
                  padding: '6px 20px', borderRadius: 8, border: 'none', cursor: 'pointer',
                  fontSize: '0.8125rem', fontWeight: 500,
                  background: historyView === 'patrimony' ? '#6366f1' : 'transparent',
                  color:      historyView === 'patrimony' ? '#fff' : '#71717a',
                }}
              >Património</button>
            </div>
          </div>
        )}

        {/* Month nav */}
        <div className="m-month-nav">
          <button className="m-month-nav-btn" onClick={goToPreviousMonth}>‹</button>
          <span className="m-month-nav-name">{monthName}</span>
          <button className="m-month-nav-btn" onClick={goToNextMonth} disabled={currentMonth === new Date().toISOString().slice(0, 7)}>›</button>
        </div>

        {/* ── OVERVIEW ── */}
        {activeView === 'overview' && (
          <div style={{ padding: '0 16px' }}>

            {/* Main summary card */}
            <div style={{
              borderRadius: 20, padding: 20,
              background: 'linear-gradient(135deg, rgba(99,102,241,0.22) 0%, rgba(168,85,247,0.12) 100%)',
              border: '1px solid rgba(255,255,255,0.1)',
              boxShadow: '0 8px 32px rgba(99,102,241,0.12)',
              marginBottom: 16,
            }}>
              <div style={{ fontSize: '0.72rem', color: '#a1a1aa', letterSpacing: '0.05em', textTransform: 'uppercase' }}>💰 Saldo do mês</div>
              <div style={{
                fontSize: '2rem', fontWeight: 700, lineHeight: 1.15, marginTop: 6,
                color: monthSaldo >= 0 ? '#4ade80' : '#f87171',
              }}>
                {monthSaldo >= 0 ? '+' : '−'}{fmt(Math.abs(monthSaldo))}
              </div>
              <div style={{ fontSize: '0.8rem', color: saldoDelta >= 0 ? '#4ade80' : '#f87171', marginTop: 6, opacity: 0.85 }}>
                {saldoDeltaLabel}
              </div>
              <div style={{ height: '1px', background: 'rgba(255,255,255,0.07)', margin: '14px 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                <div>
                  <div style={{ fontSize: '0.68rem', color: '#71717a', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Receitas</div>
                  <span style={{ color: '#4ade80', fontWeight: 600 }}>+{fmt(monthIncome)}</span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.68rem', color: '#71717a', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Despesas</div>
                  <span style={{ color: '#f87171', fontWeight: 600 }}>−{fmt(monthExpenses)}</span>
                </div>
              </div>
            </div>

            {/* 6-month chart */}
            <div className="m-chart" style={{ borderRadius: 16, overflow: 'hidden' }}>
              <div className="m-chart-label">Evolução 6 meses</div>
              <div className="m-chart-grid">
                {monthlyData.map((data, i) => (
                  <div key={i} className="m-chart-col">
                    <div className="m-bars">
                      <div className="m-bar income"  style={{ height: `${maxAmount > 0 ? (data.income   / maxAmount) * 60 : 2}px` }} />
                      <div className="m-bar expense" style={{ height: `${maxAmount > 0 ? (data.expenses / maxAmount) * 60 : 2}px` }} />
                    </div>
                    <span className="m-chart-mo">{data.month}</span>
                  </div>
                ))}
              </div>
            </div>

          </div>
        )}

        {/* ── LOG ── */}
        {activeView === 'log' && (
          <>
            <div className="m-tx-list">
              {visibleTransactions.length === 0 ? (
                <div className="m-empty">
                  {historyView === 'patrimony' ? 'Sem transferências este mês' : 'Sem transações neste mês'}
                </div>
              ) : theme === 'fintech' ? (
                /* ── Fintech card list (isolated rollout) ── */
                <div className="ftc-list">
                  {visibleTransactions.map(tx => (
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
                  transactions={visibleTransactions}
                  onCategoryChange={onCategoryChange}
                  onTransactionDeleted={onTransactionDeleted}
                />
              )}
            </div>

          </>
        )}

        {/* ── INSIGHTS ── */}
        {activeView === 'insights' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16, padding: '0 16px' }}>
            {insights.map((item, i) => (
              <div key={i} style={{ background: '#18181b', borderRadius: 12, padding: 16, display: 'flex', gap: 12, alignItems: 'center' }}>
                <div style={{ width: 40, height: 40, borderRadius: 8, background: 'rgba(99,102,241,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span>{INSIGHT_ICONS[item.type] || '📊'}</span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.875rem', fontWeight: 500, color: '#fff' }}>{item.title}</div>
                  <div style={{ fontSize: '0.75rem', color: '#a1a1aa' }}>{item.message}</div>
                </div>
                <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#fff', flexShrink: 0 }}>{item.value}</div>
              </div>
            ))}
          </div>
        )}

        {pickerTx && (
          <CategoryPicker
            transaction={pickerTx}
            onSelect={handlePickerSelect}
            onClose={() => setPickerTx(null)}
          />
        )}
      </div>
    );
  }

  /* ── DEFAULT BRANCH ──────────────────────────────────────────────────── */
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
                >×</button>
              )}
              <button
                onClick={() => setHistoryView('daily')}
                className={`today-btn-compact${historyView === 'daily' ? ' active' : ''}`}
                title="Transações diárias"
                style={{ marginLeft: '6px', background: historyView === 'daily' ? '#6366f1' : undefined, color: historyView === 'daily' ? '#fff' : undefined }}
              >💳</button>
              <button
                onClick={() => setHistoryView('patrimony')}
                className={`today-btn-compact${historyView === 'patrimony' ? ' active' : ''}`}
                title="Transferências e ajustes"
                style={{ background: historyView === 'patrimony' ? '#6366f1' : undefined, color: historyView === 'patrimony' ? '#fff' : undefined }}
              >🔁</button>
            </div>
          </div>
          {visibleTransactions.length === 0 ? (
            <div className="empty-state">
              <span className="sf-icon-large">◌</span>
              <p>{filterDate ? 'Sem transações neste dia' : 'Sem transações neste mês'}</p>
            </div>
          ) : theme === 'modern' ? (
            /* ── Modern expandable cards ── */
            <div className="modern-tx-list">
              {visibleTransactions.map((tx) => {
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
              {visibleTransactions.map((transaction, index) => {
                const isTr = transaction.type === 'transfer';
                return (
                <div
                  key={transaction.id || index}
                  className={`transaction-item ${transaction.type}`}
                >
                  <div className="transaction-left">
                    <span className="transaction-icon">
                      {isTr ? '↔' : getCategoryIcon(transaction.category)}
                    </span>
                    <div className="transaction-details">
                      {isTr ? (
                        /* Transfer: "From → To" as primary label */
                        <span className="transaction-category" style={{ fontWeight: 600 }}>
                          {getTransferFlow(transaction)}
                        </span>
                      ) : (
                        <span
                          className={`transaction-category${onCategoryChange ? ' transaction-category--editable' : ''}`}
                          onClick={() => handleCategoryClick(transaction)}
                          title={onCategoryChange ? 'Toca para alterar categoria' : undefined}
                        >
                          {transaction.category}
                          {onCategoryChange && <span className="category-edit-hint">&#8250;</span>}
                        </span>
                      )}
                      {!isTr && transaction.description && (
                        <span className="transaction-description">{transaction.description}</span>
                      )}
                    </div>
                  </div>
                  <div className="transaction-right">
                    <div className="transaction-info">
                      <span
                        className={`transaction-amount ${transaction.type}`}
                        style={isTr ? { color: 'var(--text-secondary, #888)', fontWeight: 500 } : undefined}
                      >
                        {isTr
                          ? `${parseFloat(transaction.amount).toFixed(2)}€`
                          : `${transaction.type === 'income' ? '+' : '-'}${parseFloat(transaction.amount).toFixed(2)}€`}
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
                );
              })}
            </div>
          )}
          
          {/* Summary at bottom */}
          {visibleTransactions.length > 0 && (
            <div className="log-summary">
              <div className="summary-row">
                <span className="summary-label">Total Receitas</span>
                <span className="summary-value income">
                  +{visibleTransactions
                    .filter(t => t.type === 'income')
                    .reduce((sum, t) => sum + parseFloat(t.amount), 0)
                    .toFixed(2)}€
                </span>
              </div>
              <div className="summary-row">
                <span className="summary-label">Total Despesas</span>
                <span className="summary-value expense">
                  -{visibleTransactions
                    .filter(t => t.type === 'expense')
                    .reduce((sum, t) => sum + parseFloat(t.amount), 0)
                    .toFixed(2)}€
                </span>
              </div>
              <div className="summary-row total">
                <span className="summary-label">Saldo</span>
                <span className={`summary-value ${
                  visibleTransactions
                    .filter(t => t.type === 'income')
                    .reduce((sum, t) => sum + parseFloat(t.amount), 0) -
                  visibleTransactions
                    .filter(t => t.type === 'expense')
                    .reduce((sum, t) => sum + parseFloat(t.amount), 0) >= 0
                    ? 'income'
                    : 'expense'
                }`}>
                  {(visibleTransactions
                    .filter(t => t.type === 'income')
                    .reduce((sum, t) => sum + parseFloat(t.amount), 0) -
                  visibleTransactions
                    .filter(t => t.type === 'expense')
                    .reduce((sum, t) => sum + parseFloat(t.amount), 0)).toFixed(2)}€
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {activeView === 'insights' && (
        <div style={{ padding: '0 16px' }}>
          <div style={{ padding: '8px 0', fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>INSIGHTS COUNT: {insights.length}</div>
          {insights.map(item => (
            <Card key={item.type} style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Bubble color={INSIGHT_COLORS[item.color] || INSIGHT_COLORS.info} icon={INSIGHT_ICONS[item.type] || '◉'} size={38} />
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{item.title}</div>
                  <div style={{ fontWeight: 700, color: INSIGHT_COLORS[item.color] || INSIGHT_COLORS.info }}>{item.value}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>{item.message}</div>
                </div>
              </div>
            </Card>
          ))}
        </div>
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
