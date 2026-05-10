import React, { useState, useEffect, useRef, useMemo } from 'react';
import CategoryPicker from '../CategoryPicker.jsx';
import ModernTransactionList from '../ModernTransactionList';
import FintechTransactionCard from '../FintechTransactionCard';
import { generateInsights, computeFinancialScore, shiftMonth, formatMonthLabel } from '../../utils/insights';
import { filterByFinancialMonth, shiftFinancialMonth, getFinancialMonthLabel, getFinancialMonthRange } from '../../utils/financialMonth';
import PageHeader from '../PageHeader';
import './StatsTab.css';
import './HomeTab.modern.css';


/* Transfer flow helper (mirrors ModernTransactionList / DefaultTransactionList) */
function getTransferFlow(tx) {
  const desc = (tx.description || '').trim();
  const toMatch   = desc.match(/^Transferência para (.+)$/i);
  const fromMatch = desc.match(/^Transferência de (.+)$/i);
  if (toMatch)   return `${tx.category} → ${toMatch[1]}`;
  if (fromMatch) return `${fromMatch[1]} → ${tx.category}`;
  return desc || tx.category || 'Transferência';
}

const StatsTab = ({ transactions, filteredTransactions, currentMonth, onMonthChange, categories, budgets = {}, onTransactionDeleted, onCategoryChange, onAccountChange, patrimony = {}, theme = 'default', financialMonthStartDay = 1, onNavigate }) => {
  console.log('REAL STATS TAB LOADED');
  console.log('RENDER STATS');
  console.log('ACTIVE THEME:', theme);
  console.log('transactions:', transactions);
  console.log('budgets:', budgets);

  const [pickerTx, setPickerTx] = useState(null);

  const [activeView, setActiveView] = useState('overview'); // 'overview' or 'log'

  // Scroll outer container to top when switching between views
  const statsTabRef = useRef(null);
  useEffect(() => {
    const outer = statsTabRef.current?.closest('.main-content-new');
    if (outer) outer.scrollTop = 0;
  }, [activeView]);
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
      const monthTransactions = filterByFinancialMonth(transactions, month, financialMonthStartDay);
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
  const goToPreviousMonth = () => onMonthChange(shiftFinancialMonth(currentMonth, -1));
  const goToNextMonth     = () => onMonthChange(shiftFinancialMonth(currentMonth,  1));

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
      return generateInsights({ transactions, budgets, categories, selectedMonth: currentMonth, startDay: financialMonthStartDay });
    } catch (e) {
      console.error('[Insights] generateInsights threw:', e);
      return [];
    }
  }, [transactions, budgets, categories, currentMonth, financialMonthStartDay]);

  const financialScore = useMemo(() => {
    try {
      return computeFinancialScore({ transactions, budgets, categories, selectedMonth: currentMonth, startDay: financialMonthStartDay });
    } catch (e) {
      return { score: 0, color: '#52525b', label: '—' };
    }
  }, [transactions, budgets, categories, currentMonth, financialMonthStartDay]);

  const forecast = useMemo(() => {
    const today    = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const { start: fmStart, end: fmEnd } = getFinancialMonthRange(currentMonth, financialMonthStartDay);
    if (todayStr < fmStart || todayStr > fmEnd) return null;
    const startDate   = new Date(fmStart + 'T00:00:00');
    const endDate     = new Date(fmEnd   + 'T00:00:00');
    const daysInMonth = Math.round((endDate - startDate) / 86400000) + 1;
    const daysPassed  = Math.round((today   - startDate) / 86400000) + 1;
    const totalExpenses = filterByFinancialMonth(transactions, currentMonth, financialMonthStartDay)
      .filter(t => t.type === 'expense')
      .reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);
    if (daysPassed < 3 || totalExpenses === 0) return null;
    const dailyAvg  = totalExpenses / daysPassed;
    const projected = Math.round(dailyAvg * daysInMonth);
    const totalBudget = categories.expense.reduce((s, c) => s + (budgets[c.id] || 0), 0);
    const threeMonthAvg = [1, 2, 3].reduce((sum, delta) => {
      const m = shiftMonth(currentMonth, -delta);
      return sum + filterByFinancialMonth(transactions, m, financialMonthStartDay)
        .filter(t => t.type === 'expense')
        .reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);
    }, 0) / 3;
    const vsAvg     = threeMonthAvg > 0 ? projected - threeMonthAvg : null;
    const vsBudget  = totalBudget > 0   ? projected - totalBudget   : null;
    const riskLevel = (vsBudget !== null && vsBudget > 0) || (vsAvg !== null && vsAvg > threeMonthAvg * 0.15)
      ? 'high' : vsAvg !== null && vsAvg > 0 ? 'medium' : 'low';
    return { projected, dailyAvg, totalBudget, threeMonthAvg, vsAvg, vsBudget, riskLevel, daysLeft: daysInMonth - daysPassed };
  }, [transactions, budgets, categories, currentMonth, financialMonthStartDay]);

  // Month label — shows financial period range when startDay > 1
  const monthName = getFinancialMonthLabel(currentMonth, financialMonthStartDay);

  // ── derived totals for chips ──
  const monthIncome   = filteredTransactions.filter(t => t.type === 'income') .reduce((s, t) => s + parseFloat(t.amount), 0);
  const monthExpenses = filteredTransactions.filter(t => t.type === 'expense').reduce((s, t) => s + parseFloat(t.amount), 0);
  const monthSaldo    = monthIncome - monthExpenses;

  // ── previous-month totals for delta ──
  const prevMonthKey      = shiftFinancialMonth(currentMonth, -1);
  const prevMonthTxs      = filterByFinancialMonth(transactions, prevMonthKey, financialMonthStartDay);
  const prevMonthIncome   = prevMonthTxs.filter(t => t.type === 'income') .reduce((s, t) => s + parseFloat(t.amount), 0);
  const prevMonthExpenses = prevMonthTxs.filter(t => t.type === 'expense').reduce((s, t) => s + parseFloat(t.amount), 0);
  const prevMonthSaldo    = prevMonthIncome - prevMonthExpenses;
  const saldoDelta        = monthSaldo - prevMonthSaldo;

  const fmt = (n) => {
    const abs = Math.abs(n).toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return `€${abs}`;
  };
  const saldoDeltaLabel = (saldoDelta >= 0 ? '↑ +' : '↓ ') + fmt(Math.abs(saldoDelta)) + ' vs mês anterior';

  /* ── MODERN / FINTECH BRANCH ───────────────────────────────────────────── */
  if (theme === 'modern' || theme === 'fintech') {
    return (
      <div className="m-page" ref={statsTabRef}>
        <PageHeader title="Estatísticas" />

        {/* View toggle */}
        <div className="m-toggle">
          <button className={`m-toggle-btn ${activeView === 'overview' ? 'active' : ''}`} onClick={() => setActiveView('overview')}>Visão Geral</button>
          <button className={`m-toggle-btn ${activeView === 'log'      ? 'active' : ''}`} onClick={() => setActiveView('log')}>Histórico</button>
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

            {/* Progress bar — expenses vs income */}
            {(() => {
              const pct = monthIncome > 0 ? Math.min((monthExpenses / monthIncome) * 100, 100) : 0;
              const barColor = pct >= 90 ? '#f87171' : pct >= 70 ? '#fb923c' : '#6366f1';
              const trendUp  = monthExpenses > prevMonthExpenses;
              return (
                <div style={{ background: '#18181b', borderRadius: 16, padding: '16px', marginBottom: 12 }}>
                  {/* Spend ratio bar */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#71717a', marginBottom: 6 }}>
                    <span>Gasto mensal</span>
                    <span style={{ color: barColor, fontWeight: 600 }}>{pct.toFixed(0)}%</span>
                  </div>
                  <div style={{ width: '100%', height: 6, background: '#27272a', borderRadius: 999, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, borderRadius: 999, background: `linear-gradient(90deg, #6366f1, ${barColor})`, transition: 'width 0.4s ease' }} />
                  </div>
                  {/* Spending trend */}
                  <div style={{ marginTop: 10, fontSize: '0.8125rem', color: trendUp ? '#f87171' : '#4ade80' }}>
                    {trendUp ? '↑ A gastar mais que o mês passado' : '↓ A gastar menos que o mês passado'}
                  </div>
                </div>
              );
            })()}

            {/* Top 3 categories */}
            {categoryData.length > 0 && (
              <div style={{ background: '#18181b', borderRadius: 16, padding: '16px', marginBottom: 12 }}>
                <div style={{ fontSize: '0.68rem', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>Top categorias</div>
                {categoryData.slice(0, 3).map((cat, i) => (
                  <div key={cat.category} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: i < 2 ? 8 : 0 }}>
                    <span style={{ fontSize: '0.875rem', color: '#d4d4d8' }}>{cat.category}</span>
                    <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#fff' }}>{fmt(cat.amount)}</span>
                  </div>
                ))}
              </div>
            )}

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

            {/* ── Análise: Score + priority insights ── */}
            {(() => {
              const COLOR_TO_FEED = { risk: 'alert', warn: 'warning', good: 'opportunity', info: 'info' };
              const FEED_STYLE = {
                alert:       { border: 'rgba(239,68,68,0.3)',    bg: 'rgba(239,68,68,0.08)',  glow: '0 0 16px rgba(239,68,68,0.12)' },
                warning:     { border: 'rgba(234,179,8,0.3)',    bg: 'rgba(234,179,8,0.08)',  glow: 'none' },
                opportunity: { border: 'rgba(74,222,128,0.3)',   bg: 'rgba(74,222,128,0.08)', glow: 'none' },
                info:        { border: 'rgba(255,255,255,0.08)', bg: '#18181b',               glow: 'none' },
                forecast:    { border: 'rgba(234,179,8,0.3)',    bg: 'rgba(234,179,8,0.07)',  glow: 'none' },
              };
              const FEED_ICON  = { alert: '⚠️', warning: '⚡', opportunity: '📈', info: '📊', forecast: '📅' };
              const RISK_COLOR = { high: '#f87171', medium: '#facc15', low: '#4ade80' };
              const COLOR_SEV  = { risk: 9, warn: 6, good: 2, info: 3 };
              const COLOR_REL  = { risk: 9, warn: 7, good: 5, info: 4 };
              const ps = (s, r) => s * 0.6 + r * 0.4;

              const scoredInsights = insights.map(item => ({
                kind: 'insight',
                feedType: COLOR_TO_FEED[item.color] || 'info',
                priorityScore: ps(COLOR_SEV[item.color] || 3, COLOR_REL[item.color] || 4),
                ...item,
              }));

              const forecastEntry = forecast ? (() => {
                const sev = { high: 9, medium: 6, low: 3 }[forecast.riskLevel] || 5;
                const rel = { high: 9, medium: 7, low: 5 }[forecast.riskLevel] || 6;
                return { kind: 'forecast', feedType: forecast.riskLevel === 'high' ? 'alert' : 'forecast', priorityScore: ps(sev, rel), ...forecast };
              })() : null;

              const feed = [
                ...scoredInsights,
                ...(forecastEntry ? [forecastEntry] : []),
              ].sort((a, b) => b.priorityScore - a.priorityScore).slice(0, 3);

              const handleInsightTap = (item) => {
                if (!item.meta) return;
                if (item.meta.action === 'openHistory') {
                  setActiveView('log');
                } else if (item.meta.action === 'openBudget' && onNavigate) {
                  onNavigate('budget');
                }
              };

              const renderInsight = (item, i) => {
                const s = FEED_STYLE[item.feedType] || FEED_STYLE.info;
                const isNav = !!item.meta;
                return (
                  <div
                    key={i}
                    onClick={() => handleInsightTap(item)}
                    style={{
                      borderRadius: 14, padding: '14px 16px', display: 'flex', gap: 12, alignItems: 'flex-start',
                      background: s.bg, border: `1px solid ${s.border}`, boxShadow: s.glow,
                      cursor: isNav ? 'pointer' : 'default',
                      WebkitTapHighlightColor: 'transparent',
                    }}
                  >
                    <div style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '1rem', marginTop: 1 }}>
                      {FEED_ICON[item.feedType]}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#fff', marginBottom: 2 }}>{item.title}</div>
                      <div style={{ fontSize: '0.75rem', color: '#a1a1aa', lineHeight: 1.4 }}>{item.message}</div>
                      {item.explanation && <div style={{ fontSize: '0.7rem', color: '#52525b', marginTop: 3, lineHeight: 1.4 }}>{item.explanation}</div>}
                    </div>
                    {isNav && <div style={{ fontSize: '0.75rem', color: '#52525b', alignSelf: 'center', flexShrink: 0 }}>›</div>}
                  </div>
                );
              };

              const renderForecast = (fc, i) => {
                const rc = RISK_COLOR[fc.riskLevel];
                const s  = FEED_STYLE[fc.riskLevel === 'high' ? 'alert' : 'forecast'];
                return (
                  <div key={i} style={{ borderRadius: 14, padding: '14px 16px', background: s.bg, border: `1px solid ${s.border}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <span style={{ fontSize: '1rem' }}>📅</span>
                        <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#fff' }}>Previsão do mês</div>
                      </div>
                      <span style={{ fontSize: '0.65rem', fontWeight: 700, color: rc, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        {{ high: 'Risco alto', medium: 'Atenção', low: 'Controlado' }[fc.riskLevel]}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                      <div>
                        <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff' }}>{fmt(fc.projected)}</div>
                        <div style={{ fontSize: '0.72rem', color: '#71717a', marginTop: 2 }}>{fmt(Math.round(fc.dailyAvg))}/dia · {fc.daysLeft} dias restantes</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        {fc.vsBudget !== null && <div style={{ fontSize: '0.75rem', fontWeight: 600, color: fc.vsBudget > 0 ? '#f87171' : '#4ade80' }}>{fc.vsBudget > 0 ? `+${fmt(fc.vsBudget)} acima` : `−${fmt(Math.abs(fc.vsBudget))} abaixo`} do orç.</div>}
                        {fc.vsAvg !== null && <div style={{ fontSize: '0.7rem', color: fc.vsAvg > 0 ? '#fb923c' : '#71717a', marginTop: 2 }}>{fc.vsAvg > 0 ? '+' : '−'}{fmt(Math.abs(Math.round(fc.vsAvg)))} vs média 3m</div>}
                      </div>
                    </div>
                  </div>
                );
              };

              return (
                <div style={{ marginTop: 4, marginBottom: 8 }}>
                  <div style={{ fontSize: '0.6rem', color: '#52525b', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10, paddingLeft: 2 }}>Análise</div>
                  {/* Financial score ring */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, background: '#18181b', borderRadius: 16, padding: '14px 16px', marginBottom: feed.length > 0 ? 8 : 0 }}>
                    <div style={{ width: 48, height: 48, borderRadius: '50%', background: `conic-gradient(${financialScore.color} 0% ${financialScore.score}%, #27272a ${financialScore.score}% 100%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <div style={{ width: 35, height: 35, borderRadius: '50%', background: '#18181b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700, color: financialScore.color }}>{financialScore.score}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.6rem', color: '#52525b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>Score Financeiro</div>
                      <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#fff' }}>{financialScore.label}</div>
                    </div>
                  </div>
                  {/* Priority feed — max 3 items, no goals */}
                  {feed.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {feed.map((item, i) =>
                        item.kind === 'forecast' ? renderForecast(item, i) : renderInsight(item, i)
                      )}
                    </div>
                  )}
                </div>
              );
            })()}

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
                      onAccountChange={onAccountChange}
                      onDelete={onTransactionDeleted}
                      categories={categories}
                      accounts={patrimony.accounts || []}
                    />
                  ))}
                </div>
              ) : (
                <ModernTransactionList
                  transactions={visibleTransactions}
                  onCategoryChange={onCategoryChange}
                  onAccountChange={onAccountChange}
                  onTransactionDeleted={onTransactionDeleted}
                  categories={categories}
                  patrimony={patrimony}
                />
              )}
            </div>

          </>
        )}

        {pickerTx && (
          <CategoryPicker
            transaction={pickerTx}
            onSelect={handlePickerSelect}
            onClose={() => setPickerTx(null)}
            categories={categories}
          />
        )}
      </div>
    );
  }

  /* ── DEFAULT BRANCH ──────────────────────────────────────────────────── */
  return (
    <div className="stats-tab" ref={statsTabRef}>
      <PageHeader title="Estatísticas" subtitle="Visão geral das finanças" />

      {/* View Toggle */}
      <div className="view-toggle">
        <button
          className={`toggle-btn ${activeView === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveView('overview')}
        >
          <span className="sf-icon">◧</span>
          <span>Visão Geral</span>
        </button>
        <button
          className={`toggle-btn ${activeView === 'log' ? 'active' : ''}`}
          onClick={() => setActiveView('log')}
        >
          <span className="sf-icon">◫</span>
          <span>Histórico</span>
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

          {/* ── Análise: Score + priority insights ── */}
          <div className="categories-section" style={{ marginTop: 12 }}>
            <h3>Análise</h3>
            {/* Financial score */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, background: 'var(--bg-primary)', borderRadius: 12, padding: '14px 16px', marginBottom: insights.length > 0 ? 12 : 0 }}>
              <div style={{ width: 48, height: 48, borderRadius: '50%', background: `conic-gradient(${financialScore.color} 0% ${financialScore.score}%, var(--bg-tertiary) ${financialScore.score}% 100%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <div style={{ width: 35, height: 35, borderRadius: '50%', background: 'var(--bg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700, color: financialScore.color }}>{financialScore.score}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.6rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>Score Financeiro</div>
                <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>{financialScore.label}</div>
              </div>
            </div>
            {/* Top 3 priority insights */}
            {insights.slice(0, 3).map((item, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 0', borderTop: '0.5px solid var(--separator)' }}>
                <div style={{ fontSize: '1.1rem', marginTop: 1, flexShrink: 0 }}>
                  {item.color === 'risk' ? '⚠️' : item.color === 'warn' ? '⚡' : item.color === 'good' ? '📈' : '📊'}
                </div>
                <div>
                  <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>{item.title}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>{item.message}</div>
                  {item.explanation && <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', marginTop: 3, lineHeight: 1.4 }}>{item.explanation}</div>}
                </div>
              </div>
            ))}
            {insights.length === 0 && (
              <div style={{ fontSize: '0.875rem', color: 'var(--text-tertiary)', padding: '12px 0', textAlign: 'center' }}>
                Sem insights relevantes este mês
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

      {/* Category Picker */}
      {pickerTx && (
        <CategoryPicker
          transaction={pickerTx}
          onSelect={handlePickerSelect}
          onClose={() => setPickerTx(null)}
          categories={categories}
        />
      )}
    </div>
  );
};

export default StatsTab;
