import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Clock, SlidersHorizontal, Search, BarChart2 } from 'lucide-react'; // v2
import { useAppContext } from '../../context/AppContext';
import CategoryPicker from '../CategoryPicker.jsx';
import FintechTransactionCard from '../FintechTransactionCard';
import StatsOverview from '../budget/StatsOverview';
import AIInsightsPanel from '../budget/AIInsightsPanel';
import FinancialProfileSheet from '../budget/FinancialProfileSheet';
import { generateInsights, computeFinancialScore, shiftMonth, buildInsightsSummary } from '../../utils/insights';
import { goalToFocus, normalizeProfile } from '../../utils/financialProfile';
import { filterByFinancialMonth, shiftFinancialMonth, getFinancialMonthLabel, getFinancialMonthRange, getCurrentFinancialMonth } from '../../utils/financialMonth';
import { toBudgetLabel } from '../../utils/categories-professional';
import './StatsTab.css';


/* Transfer flow helper (mirrors ModernTransactionList / DefaultTransactionList) */
function getTransferFlow(tx) {
  const desc = (tx.description || '').trim();
  const toMatch   = desc.match(/^Transferência para (.+)$/i);
  const fromMatch = desc.match(/^Transferência de (.+)$/i);
  if (toMatch)   return `${tx.category} → ${toMatch[1]}`;
  if (fromMatch) return `${fromMatch[1]} → ${tx.category}`;
  return desc || tx.category || 'Transferência';
}

const StatsTab = ({ transactions, filteredTransactions, currentMonth, onMonthChange, budgets = {}, onTransactionDeleted, onCategoryChange, onAccountChange, onTransactionEdited, patrimony = {}, financialMonthStartDay = 1, financialFocus = null, financialProfile = null, onProfileChange }) => {
  const { categories } = useAppContext();

  const [pickerTx, setPickerTx] = useState(null);

  const [activeView, setActiveView] = useState('overview'); // 'overview' or 'log'
  const [profileOpen, setProfileOpen] = useState(false);

  // Scroll outer container to top when switching between views
  const statsTabRef = useRef(null);
  useEffect(() => {
    const outer = statsTabRef.current?.closest('.main-content-new');
    if (outer) outer.scrollTop = 0;
  }, []); // só no mount, não em cada mudança de view
  const [filterDate] = useState(''); // Filter by specific date
  const [historyView, setHistoryView] = useState('all');
  const [selectedAccountId, setSelectedAccountId] = useState(null); // null = all accounts
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [searchQuery,    setSearchQuery]    = useState('');
  const [showAccFilter,  setShowAccFilter]  = useState(false);
  const [showSearch,     setShowSearch]     = useState(false);
  const [txPage,         setTxPage]         = useState(1);
  const TX_PAGE_SIZE = 50;
  // Reset to page 1 whenever filters change so the list always starts from the top
  useEffect(() => { setTxPage(1); }, [historyView, selectedAccountId, searchQuery, currentMonth]);


  // Compute expenses by category from already-filtered transactions
  const computeExpensesByCategory = (txns) => {
    const byCategory = {};
    txns.filter(t => t.type === 'expense').forEach(t => {
      const cat = toBudgetLabel(t.category); // agrupa sob a label canónica do orçamento
      byCategory[cat] = (byCategory[cat] || 0) + (parseFloat(t.amount) || 0);
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

  // Last 6 month keys — memoized, recomputes only when currentMonth changes
  const last6Months = useMemo(() => {
    const [year, month] = currentMonth.split('-').map(Number);
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(year, month - 1 - (5 - i), 1);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    });
  }, [currentMonth]);

  // Monthly chart data — memoized: only recalculates when transactions/month/startDay change
  const getMonthlyData = useMemo(() => {
    return last6Months.map(month => {
      const monthTxs = filterByFinancialMonth(transactions, month, financialMonthStartDay);
      const income   = monthTxs.filter(t => t.type === 'income').reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);
      const expenses = monthTxs.filter(t => t.type === 'expense').reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);
      return { month: month.substring(5) + '/' + month.substring(2, 4), income, expenses, balance: income - expenses };
    });
  }, [transactions, last6Months, financialMonthStartDay]);

  // Category breakdown — memoized per category set
  const getCategoryMonthlyData = useCallback((categoryName) => {
    return last6Months.map(month => {
      const monthTxs = filterByFinancialMonth(transactions, month, financialMonthStartDay);
      const amount   = monthTxs.filter(t => t.type === 'expense' && toBudgetLabel(t.category) === categoryName).reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);
      return { month: month.substring(5) + '/' + month.substring(2, 4), amount };
    });
  }, [transactions, last6Months, financialMonthStartDay]);

  // Navigate months — delegates to App so currentMonth is the single source of truth
  const goToPreviousMonth = () => onMonthChange(shiftFinancialMonth(currentMonth, -1));
  const goToNextMonth     = () => onMonthChange(shiftFinancialMonth(currentMonth,  1));


  const handleCategoryClick = (tx) => {
    if (onCategoryChange) setPickerTx(tx);
  };

  const handlePickerSelect = (newCategory) => {
    if (pickerTx && onCategoryChange) {
      onCategoryChange(pickerTx.id, newCategory, pickerTx.description);
    }
    setPickerTx(null);
  };


  // Derived from filteredTransactions (already filtered by currentMonth in App)
  const categoryData      = useMemo(() => computeExpensesByCategory(filteredTransactions),  [filteredTransactions]);
  const monthTransactions = useMemo(() => computeMonthTransactions(filteredTransactions),   [filteredTransactions, filterDate]);
  const visibleTransactions = useMemo(() => {
    const typeFiltered = monthTransactions.filter(t => {
      if (historyView === 'all')      return true;
      if (historyView === 'expense')  return t.type === 'expense';
      if (historyView === 'income')   return t.type === 'income';
      if (historyView === 'transfer') return t.type === 'transfer' || t.type === 'adjustment';
      return true;
    });

    const accountFiltered = selectedAccountId
      ? typeFiltered.filter(t => t.account_id === selectedAccountId)
      : typeFiltered;

    const searchFiltered = searchQuery.trim()
      ? accountFiltered.filter(t => {
          const q = searchQuery.toLowerCase();
          return (t.description || '').toLowerCase().includes(q)
            || (t.category || '').toLowerCase().includes(q);
        })
      : accountFiltered;

    const seen = new Set();
    return searchFiltered.filter(t => {
      if (t.type !== 'transfer') return true;
      const key = `${t.date}|${t.amount}|${getTransferFlow(t)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [monthTransactions, historyView, selectedAccountId, searchQuery]);

  // Reset pagination whenever filters or month change
  const pagedTransactions = visibleTransactions.slice(0, txPage * TX_PAGE_SIZE);
  const hasMore = pagedTransactions.length < visibleTransactions.length;

  // 6-month chart still needs all transactions so it can look at past months
  const monthlyData = getMonthlyData; // already memoized above

  const insights = useMemo(() => {
    try {
      const focus = goalToFocus(financialProfile?.goal) || financialFocus;
      return generateInsights({ transactions, budgets, categories, selectedMonth: currentMonth, startDay: financialMonthStartDay, focus });
    } catch (e) {
      console.error('[Insights] generateInsights threw:', e);
      return [];
    }
  }, [transactions, budgets, categories, currentMonth, financialMonthStartDay, financialFocus, financialProfile]);

  const financialScore = useMemo(() => {
    try {
      return computeFinancialScore({ transactions, budgets, categories, selectedMonth: currentMonth, startDay: financialMonthStartDay });
    } catch {
      return { score: 0, color: 'var(--cosmos-text-3)', label: '—' };
    }
  }, [transactions, budgets, categories, currentMonth, financialMonthStartDay]);

  // Resumo anonimizado para a análise IA (só quando o mês tem dados).
  const aiSummary = useMemo(() => {
    try {
      const emergencyIncludesAforro = normalizeProfile(financialProfile || {}).emergencyIncludesAforro;
      const s = buildInsightsSummary({ transactions, budgets, categories, patrimony, selectedMonth: currentMonth, startDay: financialMonthStartDay, emergencyIncludesAforro });
      return (s.income > 0 || s.expenses > 0) ? s : null;
    } catch {
      return null;
    }
  }, [transactions, budgets, categories, patrimony, currentMonth, financialMonthStartDay, financialProfile]);

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
  const monthIncome   = filteredTransactions.filter(t => t.type === 'income') .reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);
  const monthExpenses = filteredTransactions.filter(t => t.type === 'expense').reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);
  const monthSaldo    = monthIncome - monthExpenses;

  // ── previous-month totals for delta ──
  const prevMonthKey      = shiftFinancialMonth(currentMonth, -1);
  const prevMonthTxs      = filterByFinancialMonth(transactions, prevMonthKey, financialMonthStartDay);
  const prevMonthIncome   = prevMonthTxs.filter(t => t.type === 'income') .reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);
  const prevMonthExpenses = prevMonthTxs.filter(t => t.type === 'expense').reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);
  const prevMonthSaldo    = prevMonthIncome - prevMonthExpenses;
  const saldoDelta        = monthSaldo - prevMonthSaldo;

  const fmt = (n) => {
    const abs = Math.abs(n).toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return `€${abs}`;
  };
  const saldoDeltaLabel = (saldoDelta >= 0 ? '↑ +' : '↓ ') + fmt(Math.abs(saldoDelta)) + ' vs mês anterior';

  return (
    <div ref={statsTabRef} style={{
      display: 'flex',
      flexDirection: 'column',
      background: 'transparent',
    }}>

      {/* ── HEADER ── */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '16px 20px 8px',
      }}>
        <span style={{ fontSize: '24px', fontWeight: 600, color: 'var(--cosmos-text-1)' }}>
          Estatísticas
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button onClick={goToPreviousMonth} style={{ background: 'var(--cosmos-border-divider)', border: 'none', borderRadius: '8px', width: '30px', height: '30px', color: 'var(--cosmos-text-1)', fontSize: '16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>‹</button>
          <span style={{ fontSize: '13px', color: 'var(--cosmos-text-3)', fontWeight: 500, minWidth: '90px', textAlign: 'center' }}>{monthName}</span>
          <button onClick={goToNextMonth} disabled={currentMonth === getCurrentFinancialMonth(financialMonthStartDay)} style={{ background: 'var(--cosmos-border-divider)', border: 'none', borderRadius: '8px', width: '30px', height: '30px', color: 'var(--cosmos-text-1)', fontSize: '16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: currentMonth === getCurrentFinancialMonth(financialMonthStartDay) ? 0.4 : 1 }}>›</button>
        </div>
      </div>

      {/* ── VIEW TOGGLE ── */}
      {(() => {
        const NAV = [
          { key: 'overview', Icon: BarChart2, label: 'Visão Geral' },
          { key: 'log',      Icon: Clock,     label: 'Histórico'   },
        ];
        return (
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '6px',
            padding: '8px 20px 16px',
          }}>
            {NAV.map(({ key, Icon, label }) => (
              <button
                key={key}
                onClick={() => setActiveView(key)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '10px 4px 9px',
                  background: activeView === key ? 'var(--cosmos-accent-dim)' : 'var(--cosmos-border-subtle)',
                  border: activeView === key ? '1px solid var(--cosmos-accent-border)' : '1px solid var(--cosmos-border-divider)',
                  borderRadius: '14px',
                  color: activeView === key ? 'var(--cosmos-accent)' : 'var(--cosmos-text-3)',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  WebkitTapHighlightColor: 'transparent',
                  fontFamily: 'inherit',
                }}
              >
                <Icon size={18} strokeWidth={1.75} color={activeView === key ? 'var(--cosmos-accent)' : 'var(--cosmos-text-3)'} />
                <span style={{
                  fontSize: '9px',
                  fontWeight: 500,
                  letterSpacing: '0.02em',
                  textTransform: 'uppercase',
                  color: 'inherit',
                }}>{label}</span>
              </button>
            ))}
          </div>
        );
      })()}

      {/* ══ OVERVIEW ══ */}
      {activeView === 'overview' && (
        <StatsOverview
          monthSaldo={monthSaldo}
          monthIncome={monthIncome}
          monthExpenses={monthExpenses}
          saldoDelta={saldoDelta}
          saldoDeltaLabel={saldoDeltaLabel}
          monthlyData={monthlyData}
          categoryData={categoryData}
          selectedCategories={selectedCategories}
          setSelectedCategories={setSelectedCategories}
          getCategoryMonthlyData={getCategoryMonthlyData}
          insights={insights}
          financialScore={financialScore}
          fmt={fmt}
          onShowLog={() => setActiveView('log')}
        >
          <AIInsightsPanel
            summary={aiSummary}
            profile={financialProfile}
            onCustomize={() => setProfileOpen(true)}
          />
        </StatsOverview>
      )}

      {/* ══ HISTÓRICO ══ */}
      {activeView === 'log' && (
        <>
          {/* Type chips + search + filter buttons */}
          <div style={{
            display: 'flex', gap: 5, padding: '0 20px 10px',
            overflowX: 'auto', scrollbarWidth: 'none', touchAction: 'pan-x',
            alignItems: 'center',
            flexShrink: 0,  // scroll container (overflow-x) num flex-column: evita colapso vertical
          }}>
            {[
              { key: 'all',      label: 'Todos'          },
              { key: 'expense',  label: 'Despesas'       },
              { key: 'income',   label: 'Receitas'       },
              { key: 'transfer', label: 'Transferências' },
            ].map(({ key, label }) => {
              const cfg = {
                all:      { color: 'var(--cosmos-text-3)', bg: 'rgba(255,255,255,0.06)',  border: 'rgba(255,255,255,0.11)'  },
                expense:  { color: 'var(--cosmos-expense)', bg: 'rgba(248,113,113,0.10)', border: 'rgba(248,113,113,0.25)'  },
                income:   { color: 'var(--cosmos-income)', bg: 'rgba(74,222,128,0.10)',  border: 'rgba(74,222,128,0.25)'   },
                transfer: { color: 'var(--cosmos-accent)', bg: 'var(--cosmos-accent-dim)',   border: 'var(--cosmos-accent-border)'    },
              }[key];
              const active = historyView === key;
              return (
                <button
                  key={key}
                  onClick={() => setHistoryView(key)}
                  style={{
                    flexShrink: 0, padding: '5px 10px', borderRadius: 8,
                    fontSize: 10, fontWeight: 500, cursor: 'pointer',
                    WebkitTapHighlightColor: 'transparent', fontFamily: 'inherit',
                    background: active ? cfg.bg : 'rgba(255,255,255,0.03)',
                    border: active ? `1px solid ${cfg.border}` : '1px solid var(--cosmos-border-divider)',
                    color: active ? cfg.color : '#475569',
                  }}
                >{label}</button>
              );
            })}

            {/* Separator */}
            <div style={{ width: 1, height: 18, background: 'var(--cosmos-border-divider)', flexShrink: 0, marginLeft: 2 }} />

            {/* Search icon button */}
            <button
              onClick={() => { setShowSearch(v => !v); if (showSearch) setSearchQuery(''); }}
              style={{
                flexShrink: 0, width: 28, height: 28, borderRadius: 8, cursor: 'pointer',
                WebkitTapHighlightColor: 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: showSearch ? 'var(--cosmos-accent-dim)' : 'var(--cosmos-border-subtle)',
                border: showSearch ? '1px solid rgba(0,221,255,0.28)' : '1px solid var(--cosmos-border-divider)',
                color: showSearch ? 'var(--cosmos-accent)' : 'var(--cosmos-text-3)',
                transition: 'all 0.15s',
              }}
            >
              <Search size={12} strokeWidth={1.75} />
            </button>

            {/* Filter (accounts) icon button */}
            <button
              onClick={() => setShowAccFilter(v => !v)}
              style={{
                flexShrink: 0, width: 28, height: 28, borderRadius: 8, cursor: 'pointer',
                WebkitTapHighlightColor: 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: showAccFilter ? 'var(--cosmos-warning-dim)' : 'var(--cosmos-border-subtle)',
                border: showAccFilter ? '1px solid rgba(251,191,36,0.28)' : '1px solid var(--cosmos-border-divider)',
                color: showAccFilter ? 'var(--cosmos-warning)' : 'var(--cosmos-text-3)',
                transition: 'all 0.15s',
              }}
            >
              <SlidersHorizontal size={12} strokeWidth={1.75} />
            </button>
          </div>

          {/* Expandable search input */}
          {showSearch && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 5,
              margin: '-4px 20px 8px',
              background: 'var(--cosmos-border-subtle)', border: '1px solid var(--cosmos-accent-border)',
              borderRadius: 8, padding: '4px 9px',
              animation: 'expandSearch 0.15s ease',
              flexShrink: 0,
            }}>
              <Search size={12} color="#2D3748" strokeWidth={1.75} style={{ flexShrink: 0 }} />
              <input
                autoFocus
                type="text"
                placeholder="Pesquisar..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{
                  background: 'none', border: 'none', outline: 'none',
                  color: 'var(--cosmos-text-3)', fontSize: 11, width: '100%', fontFamily: 'inherit',
                }}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  style={{ background: 'none', border: 'none', color: 'var(--cosmos-text-2)', cursor: 'pointer', padding: 0, fontSize: 13, lineHeight: 1 }}
                >✕</button>
              )}
            </div>
          )}

          {/* Account filter chips */}
          {showAccFilter && (
            <div style={{
              display: 'flex', gap: 5, padding: '0 20px 6px',
              overflowX: 'auto', scrollbarWidth: 'none', touchAction: 'pan-x',
              flexShrink: 0,
            }}>
              {[{ id: null, name: 'Todas as contas' }, ...(patrimony.accounts || [])].map(acc => (
                <button
                  key={acc.id ?? 'all'}
                  onClick={() => setSelectedAccountId(acc.id)}
                  style={{
                    flexShrink: 0, padding: '5px 10px', borderRadius: 8,
                    fontSize: 10, fontWeight: 500, cursor: 'pointer',
                    WebkitTapHighlightColor: 'transparent', fontFamily: 'inherit',
                    background: selectedAccountId === acc.id ? 'rgba(251,191,36,0.10)' : 'rgba(255,255,255,0.03)',
                    border: selectedAccountId === acc.id ? '1px solid rgba(251,191,36,0.25)' : '1px solid var(--cosmos-border-divider)',
                    color: selectedAccountId === acc.id ? '#FBBF24' : '#475569',
                  }}
                >{acc.name}</button>
              ))}
            </div>
          )}

          {/* Day-grouped transaction list */}
          {visibleTransactions.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--cosmos-text-3)', fontSize: 13, padding: '40px 20px' }}>
              Sem transações
            </div>
          ) : (
            <div style={{ padding: '0 16px' }}>
              {(() => {
                const groups = [];
                const seenDates = {};
                pagedTransactions.forEach(tx => {
                  const d = tx.date || '';
                  if (!seenDates[d]) { seenDates[d] = []; groups.push({ date: d, txs: seenDates[d] }); }
                  seenDates[d].push(tx);
                });

                const fmtDayLabel = (dateStr) => {
                  if (!dateStr) return '—';
                  const d = new Date(dateStr + 'T00:00:00');
                  const today = new Date();
                  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
                  if (d.toDateString() === today.toDateString())
                    return 'hoje · ' + d.toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' });
                  if (d.toDateString() === yesterday.toDateString())
                    return 'ontem · ' + d.toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' });
                  return d.toLocaleDateString('pt-PT', { weekday: 'short', day: 'numeric', month: 'short' });
                };

                return groups.map(({ date, txs }, gi) => {
                  const net = txs.reduce((s, t) => {
                    const a = parseFloat(t.amount) || 0;
                    if (t.type === 'transfer') return s; // transfers are neutral
                    return s + (t.type === 'income' ? a : -a);
                  }, 0);
                  return (
                    <div key={date}>
                      <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        paddingTop: gi === 0 ? 2 : 10, paddingBottom: 4,
                        borderTop: gi === 0 ? 'none' : '1px solid rgba(255,255,255,0.05)',
                        marginTop: gi === 0 ? 0 : 4,
                      }}>
                        <span style={{
                          fontSize: 10, fontWeight: 600, color: 'var(--cosmos-text-3)',
                          letterSpacing: '0.04em', textTransform: 'uppercase',
                        }}>
                          {fmtDayLabel(date)}
                        </span>
                        <span style={{ fontSize: 10, fontWeight: 600, color: net >= 0 ? '#4ADE80' : '#F87171' }}>
                          {net >= 0 ? '+' : '−'}{Math.abs(net).toFixed(2)}€
                        </span>
                      </div>
                      {txs.map(tx => (
                        <FintechTransactionCard
                          key={tx.id}
                          tx={tx}
                          onCategoryChange={onCategoryChange}
                          onAccountChange={onAccountChange}
                          onDelete={onTransactionDeleted}
                          onEditTransaction={onTransactionEdited}
                          categories={categories}
                          accounts={patrimony.accounts || []}
                        />
                      ))}
                    </div>
                  );
                });
              })()}

              {/* Load more */}
              {hasMore && (
                <button
                  onClick={() => setTxPage(p => p + 1)}
                  style={{
                    display: 'block', width: '100%', margin: '12px 0 4px',
                    padding: '10px', borderRadius: 10, cursor: 'pointer',
                    background: 'var(--cosmos-surface-2)',
                    border: '1px solid var(--cosmos-border-divider)',
                    color: 'var(--cosmos-text-3)', fontSize: 12, fontWeight: 500,
                    fontFamily: 'inherit',
                  }}
                >
                  Carregar mais ({visibleTransactions.length - pagedTransactions.length} restantes)
                </button>
              )}
            </div>
          )}
        </>
      )}

      {profileOpen && (
        <FinancialProfileSheet
          profile={financialProfile}
          onSave={(p) => onProfileChange?.(p)}
          onClose={() => setProfileOpen(false)}
        />
      )}

    </div>
  );
};


export default StatsTab;
