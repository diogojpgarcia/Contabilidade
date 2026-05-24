import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Clock, SlidersHorizontal, Search } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { useToast } from '../../context/ToastContext';
import CategoryPicker from '../CategoryPicker.jsx';
import ModernTransactionList from '../ModernTransactionList';
import FintechTransactionCard from '../FintechTransactionCard';
import { generateInsights, computeFinancialScore, shiftMonth, formatMonthLabel } from '../../utils/insights';
import { filterByFinancialMonth, shiftFinancialMonth, getFinancialMonthLabel, getFinancialMonthRange } from '../../utils/financialMonth';
import PageHeader from '../PageHeader';
import { AlertTriangle, Zap, TrendingUp, TrendingDown, BarChart2, Calendar } from '../icons';
import { getCategoryMeta } from '../../utils/categoryIcons';
import './StatsTab.css';
import './HomeTab.modern.css';

/* ── getCategoryIconEl ────────────────────────────────────────────────────────
   Replaces the old getCategoryIcon() string map.
   Used only by the legacy (non-fintech) branches that are never active in
   production — kept alive so the module compiles without errors.            */
function getCategoryIconEl(categoryName, type = 'expense') {
  const { Icon, color } = getCategoryMeta(categoryName, type);
  return <Icon size={16} color={color} strokeWidth={2} />;
}


/* Transfer flow helper (mirrors ModernTransactionList / DefaultTransactionList) */
function getTransferFlow(tx) {
  const desc = (tx.description || '').trim();
  const toMatch   = desc.match(/^Transferência para (.+)$/i);
  const fromMatch = desc.match(/^Transferência de (.+)$/i);
  if (toMatch)   return `${tx.category} → ${toMatch[1]}`;
  if (fromMatch) return `${fromMatch[1]} → ${tx.category}`;
  return desc || tx.category || 'Transferência';
}

const StatsTab = ({ transactions, filteredTransactions, currentMonth, onMonthChange, budgets = {}, onTransactionDeleted, onCategoryChange, onAccountChange, onTransactionEdited, patrimony = {}, financialMonthStartDay = 1, onNavigate, financialFocus = null }) => {
  const { categories, theme } = useAppContext();
  const { showError } = useToast();

  const [pickerTx, setPickerTx] = useState(null);

  const [activeView, setActiveView] = useState('overview'); // 'overview' or 'log'

  // Scroll outer container to top when switching between views
  const statsTabRef = useRef(null);
  useEffect(() => {
    const outer = statsTabRef.current?.closest('.main-content-new');
    if (outer) outer.scrollTop = 0;
  }, []); // só no mount, não em cada mudança de view
  const [deleting, setDeleting] = useState(null);
  const [filterDate, setFilterDate] = useState(''); // Filter by specific date
  const [expandedId, setExpandedId] = useState(null); // modern-theme expanded card
  const [historyView, setHistoryView] = useState('all');
  const [selectedAccountId, setSelectedAccountId] = useState(null); // null = all accounts
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [searchQuery,    setSearchQuery]    = useState('');
  const [showAccFilter,  setShowAccFilter]  = useState(false);
  const [showSearch,     setShowSearch]     = useState(false);


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

  // Category monthly breakdown — used by the interactive chart in the fintech branch
  const getCategoryMonthlyData = (categoryName) => {
    return getLast6Months().map(month => {
      const monthTxs = filterByFinancialMonth(transactions, month, financialMonthStartDay);
      const amount = monthTxs
        .filter(t => t.type === 'expense' && t.category === categoryName)
        .reduce((s, t) => s + parseFloat(t.amount), 0);
      return {
        month: month.substring(5) + '/' + month.substring(2, 4),
        amount,
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
      showError('Erro ao apagar transação: ' + error.message);
    } finally {
      setDeleting(null);
    }
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
  // 6-month chart still needs all transactions so it can look at past months
  const monthlyData       = useMemo(() => getMonthlyData(),                                 [transactions, currentMonth]);
  const maxAmount         = useMemo(
    () => Math.max(...monthlyData.map(m => Math.max(m.income, m.expenses))) || 1,
    [monthlyData]
  );

  const insights = useMemo(() => {
    try {
      return generateInsights({ transactions, budgets, categories, selectedMonth: currentMonth, startDay: financialMonthStartDay, focus: financialFocus });
    } catch (e) {
      console.error('[Insights] generateInsights threw:', e);
      return [];
    }
  }, [transactions, budgets, categories, currentMonth, financialMonthStartDay, financialFocus]);

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

  /* ── SOFT-FUTURE BRANCH ────────────────────────────────────────────────── */
  if (theme === 'fintech') {
  return (
    <div ref={statsTabRef} style={{
      display: 'flex',
      flexDirection: 'column',
      background: 'transparent',
      paddingBottom: 'calc(88px + env(safe-area-inset-bottom))',
    }}>

      {/* ── HEADER ── */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '16px 20px 8px',
      }}>
        <span style={{ fontSize: '24px', fontWeight: 600, color: '#FFFFFF' }}>
          Estatísticas
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button onClick={goToPreviousMonth} style={{ background: 'rgba(255,255,255,0.07)', border: 'none', borderRadius: '8px', width: '30px', height: '30px', color: '#FFFFFF', fontSize: '16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>‹</button>
          <span style={{ fontSize: '13px', color: '#94A3B8', fontWeight: 500, minWidth: '90px', textAlign: 'center' }}>{monthName}</span>
          <button onClick={goToNextMonth} disabled={currentMonth === new Date().toISOString().slice(0, 7)} style={{ background: 'rgba(255,255,255,0.07)', border: 'none', borderRadius: '8px', width: '30px', height: '30px', color: '#FFFFFF', fontSize: '16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: currentMonth === new Date().toISOString().slice(0, 7) ? 0.4 : 1 }}>›</button>
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
                  background: activeView === key ? 'rgba(0,221,255,0.10)' : 'rgba(255,255,255,0.04)',
                  border: activeView === key ? '1px solid rgba(0,221,255,0.28)' : '1px solid rgba(255,255,255,0.07)',
                  borderRadius: '14px',
                  color: activeView === key ? '#00DDFF' : '#475569',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  WebkitTapHighlightColor: 'transparent',
                  fontFamily: 'inherit',
                }}
              >
                <Icon size={18} strokeWidth={1.75} color={activeView === key ? '#00DDFF' : '#475569'} />
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
      {activeView === 'overview' && (() => {
        const pct      = monthIncome > 0 ? Math.min((monthExpenses / monthIncome) * 100, 100) : 0;
        const barColor = pct >= 90 ? '#F87171' : pct >= 70 ? '#FB923C' : '#00DDFF';
        const maxVal   = Math.max(...monthlyData.map(m => Math.max(m.income, m.expenses))) || 1;
        const W = 340; const H = 72;
        const cx = (i) => (i / 5) * W;
        const cyI = (v) => 68 - (v / maxVal) * 64;
        const cyE = (v) => 68 - (v / maxVal) * 64;
        const incomeAreaPath  = `M${cx(0)},${cyI(monthlyData[0]?.income||0)} ` + monthlyData.map((d,i) => `L${cx(i)},${cyI(d.income)}`).join(' ')  + ` L${W},${H} L0,${H} Z`;
        const expenseAreaPath = `M${cx(0)},${cyE(monthlyData[0]?.expenses||0)} ` + monthlyData.map((d,i) => `L${cx(i)},${cyE(d.expenses)}`).join(' ') + ` L${W},${H} L0,${H} Z`;
        const incomeLinePts  = monthlyData.map((d,i) => `${cx(i)},${cyI(d.income)}`).join(' ');
        const expenseLinePts = monthlyData.map((d,i) => `${cx(i)},${cyE(d.expenses)}`).join(' ');
        const CAT_COLORS = ['#00DDFF', '#22C55E', '#F59E0B', '#F87171', '#8B5CF6'];
        return (
          <div style={{ display: 'flex', flexDirection: 'column' }}>

            {/* ── 1. CARD PRINCIPAL ── */}
            <div style={{
              borderRadius: '20px',
              background: 'linear-gradient(160deg, #141E2E 0%, #0D1520 100%)',
              border: '1px solid rgba(255,255,255,0.07)',
              margin: '0 16px',
              overflow: 'hidden',
              boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
            }}>

              {/* Top section */}
              <div style={{ padding: '20px 20px 12px' }}>
                <div style={{ fontSize: '11px', color: '#94A3B8', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '8px' }}>
                  Saldo do Mês
                </div>
                <div style={{ fontSize: '36px', fontWeight: 700, color: monthSaldo >= 0 ? '#22C55E' : '#F87171', letterSpacing: '-0.02em', lineHeight: 1, marginBottom: '6px' }}>
                  {monthSaldo >= 0 ? '+' : '−'}{fmt(Math.abs(monthSaldo))}
                </div>
                <div style={{ fontSize: '13px', color: saldoDelta >= 0 ? '#22C55E' : '#F87171', marginBottom: '14px' }}>
                  {saldoDeltaLabel}
                </div>
                <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)', marginBottom: '14px' }} />

                {/* 3-column row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                  {/* Receitas */}
                  <div>
                    <div style={{ fontSize: '10px', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>Receitas</div>
                    <div style={{ fontSize: '15px', fontWeight: 600, color: '#22C55E' }}>+{fmt(monthIncome)}</div>
                  </div>
                  {/* Barra centro */}
                  <div style={{ flex: 1, maxWidth: '120px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#94A3B8', marginBottom: '4px' }}>
                      <span style={{ textTransform: 'uppercase', letterSpacing: '0.06em' }}>Gasto</span>
                      <span style={{ color: barColor, fontWeight: 600 }}>{pct.toFixed(0)}%</span>
                    </div>
                    <div style={{ height: '3px', background: 'rgba(255,255,255,0.08)', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: `linear-gradient(90deg, #00DDFF, ${barColor})`, borderRadius: '3px', transition: 'width 0.4s ease' }} />
                    </div>
                  </div>
                  {/* Despesas */}
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '10px', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>Despesas</div>
                    <div style={{ fontSize: '15px', fontWeight: 600, color: '#F87171' }}>−{fmt(monthExpenses)}</div>
                  </div>
                </div>
              </div>

              {/* Barra de labels — sempre renderizada, altura fixa */}
              {(() => {
                const CAT_COLORS = ['#00DDFF','#22C55E','#F59E0B','#F87171','#8B5CF6'];
                return (
                  <div>
                    {/* Labels com altura fixa — opacidade 0 quando não há seleção */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '6px 16px',
                      height: '32px',
                      flexWrap: 'nowrap',
                      overflow: 'hidden',
                    }}>
                      <div style={{
                        display: 'flex',
                        gap: '6px',
                        flex: 1,
                        overflowX: 'auto',
                        overflowY: 'hidden',
                        scrollbarWidth: 'none',
                        touchAction: 'pan-x',
                        opacity: selectedCategories.length > 0 ? 1 : 0,
                        transition: 'opacity 0.15s ease',
                        paddingBottom: '2px',
                      }}>
                        <style>{`.cat-label-scroll::-webkit-scrollbar { display: none; }`}</style>
                        {selectedCategories.map(cat => {
                          const idx = categoryData.findIndex(c => c.category === cat);
                          const color = CAT_COLORS[idx % 5] || '#00DDFF';
                          return (
                            <div key={cat} style={{
                              display: 'flex', alignItems: 'center', gap: '4px',
                              background: `${color}18`, borderRadius: '12px',
                              padding: '2px 8px', flexShrink: 0,
                            }}>
                              <div style={{ width: 6, height: 6, borderRadius: '50%', background: color }} />
                              <span style={{ fontSize: '11px', color: color, whiteSpace: 'nowrap' }}>{cat}</span>
                            </div>
                          );
                        })}
                      </div>
                      <button
                        onClick={() => setSelectedCategories([])}
                        style={{
                          fontSize: '11px', color: '#64748B',
                          background: 'none', border: 'none', cursor: 'pointer',
                          flexShrink: 0, paddingLeft: '8px',
                          opacity: selectedCategories.length > 0 ? 1 : 0,
                          pointerEvents: selectedCategories.length > 0 ? 'auto' : 'none',
                          transition: 'opacity 0.15s ease',
                        }}
                      >
                        Limpar ×
                      </button>
                    </div>

                    {/* SVG — multi-categoria ou geral */}
                    {selectedCategories.length > 0 ? (() => {
                      const maxVal = Math.max(
                        ...selectedCategories.flatMap(cat =>
                          getCategoryMonthlyData(cat).map(d => d.amount)
                        ), 1
                      );
                      return (
                        <svg width="100%" height={72} viewBox="0 0 340 72"
                          preserveAspectRatio="none" style={{ display: 'block' }}>
                          <defs>
                            {selectedCategories.map((cat, ci) => {
                              const idx = categoryData.findIndex(c => c.category === cat);
                              const color = CAT_COLORS[idx % 5] || '#00DDFF';
                              return (
                                <linearGradient key={cat} id={`catGrad${ci}`} x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="0%" stopColor={color} stopOpacity="0.2" />
                                  <stop offset="100%" stopColor={color} stopOpacity="0" />
                                </linearGradient>
                              );
                            })}
                          </defs>
                          {selectedCategories.map((cat, ci) => {
                            const idx = categoryData.findIndex(c => c.category === cat);
                            const color = CAT_COLORS[idx % 5] || '#00DDFF';
                            const catData = getCategoryMonthlyData(cat);
                            const pts = catData.map((d, i) => ({
                              x: (i / 5) * 340,
                              y: 68 - (d.amount / maxVal) * 60,
                            }));
                            const linePoints = pts.map(p => `${p.x},${p.y}`).join(' ');
                            const areaPath = `M${pts[0].x},${pts[0].y} ` +
                              pts.slice(1).map(p => `L${p.x},${p.y}`).join(' ') +
                              ` L340,68 L0,68 Z`;
                            return (
                              <g key={cat}>
                                <path d={areaPath} fill={`url(#catGrad${ci})`} />
                                <polyline points={linePoints} fill="none"
                                  stroke={color} strokeWidth="2"
                                  strokeLinecap="round" strokeLinejoin="round" />
                                <circle
                                  cx={pts[pts.length-1].x}
                                  cy={pts[pts.length-1].y}
                                  r="3" fill={color}
                                />
                              </g>
                            );
                          })}
                        </svg>
                      );
                    })() : (() => {
                      const maxValG = Math.max(...monthlyData.map(m => Math.max(m.income, m.expenses)), 1);
                      const incPts = monthlyData.map((d, i) => `${(i/5)*340},${68-(d.income/maxValG)*60}`).join(' ');
                      const expPts = monthlyData.map((d, i) => `${(i/5)*340},${68-(d.expenses/maxValG)*60}`).join(' ');
                      const incArea = `M0,${68-(monthlyData[0].income/maxValG)*60} ` +
                        monthlyData.map((d,i) => `L${(i/5)*340},${68-(d.income/maxValG)*60}`).join(' ') + ' L340,68 L0,68 Z';
                      const expArea = `M0,${68-(monthlyData[0].expenses/maxValG)*60} ` +
                        monthlyData.map((d,i) => `L${(i/5)*340},${68-(d.expenses/maxValG)*60}`).join(' ') + ' L340,68 L0,68 Z';
                      return (
                        <svg width="100%" height={72} viewBox="0 0 340 72" preserveAspectRatio="none" style={{ display: 'block' }}>
                          <defs>
                            <linearGradient id="incGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#22C55E" stopOpacity="0.25" />
                              <stop offset="100%" stopColor="#22C55E" stopOpacity="0" />
                            </linearGradient>
                            <linearGradient id="expGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#F87171" stopOpacity="0.2" />
                              <stop offset="100%" stopColor="#F87171" stopOpacity="0" />
                            </linearGradient>
                          </defs>
                          <path d={incArea} fill="url(#incGrad)" />
                          <path d={expArea} fill="url(#expGrad)" />
                          <polyline points={incPts} fill="none" stroke="#22C55E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          <polyline points={expPts} fill="none" stroke="#F87171" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      );
                    })()}
                  </div>
                );
              })()}

              {/* Labels dos meses */}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 16px 14px' }}>
                {monthlyData.map((d, i) => (
                  <span key={i} style={{ fontSize: '10px', color: '#64748B' }}>{d.month}</span>
                ))}
              </div>
            </div>

            {/* ── 2. TOP CATEGORIAS ── */}
            {categoryData.length > 0 && (
              <div style={{ margin: '12px 16px 0' }}>
                <div style={{ fontSize: '11px', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px' }}>
                  Top Categorias
                </div>
                {categoryData.slice(0, 5).map((cat, i) => {
                  const isSelected = selectedCategories.includes(cat.category);
                  return (
                    <div
                      key={cat.category}
                      onClick={() => setSelectedCategories(prev =>
                        prev.includes(cat.category)
                          ? prev.filter(c => c !== cat.category)
                          : [...prev, cat.category]
                      )}
                      style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px', cursor: 'pointer' }}
                    >
                      {/* Ponto colorido */}
                      <div style={{
                        width: '8px', height: '8px', borderRadius: '50%', background: CAT_COLORS[i % 5], flexShrink: 0,
                        transform: isSelected ? 'scale(1.5)' : 'scale(1)',
                        boxShadow: isSelected ? `0 0 8px ${CAT_COLORS[i % 5]}` : 'none',
                        transition: 'all 0.2s',
                      }} />
                      {/* Nome */}
                      <div style={{ flex: 1, fontSize: '14px', color: isSelected ? '#FFFFFF' : '#FFFFFF', fontWeight: isSelected ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cat.category}</div>
                      {/* Barra + % */}
                      <div style={{ width: '100px', flexShrink: 0 }}>
                        <div style={{ fontSize: '12px', color: CAT_COLORS[i % 5], textAlign: 'right', marginBottom: '3px' }}>{cat.percentage.toFixed(0)}%</div>
                        <div style={{ height: '3px', background: 'rgba(255,255,255,0.07)', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${cat.percentage}%`, background: CAT_COLORS[i % 5], borderRadius: '3px', opacity: isSelected ? 1 : 0.7 }} />
                        </div>
                      </div>
                      {/* Valor */}
                      <div style={{ width: '64px', fontSize: '13px', color: '#94A3B8', textAlign: 'right', flexShrink: 0 }}>{fmt(cat.amount)}</div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── 3. SCORE + INSIGHTS ── */}
            <div style={{ margin: '12px 16px 0', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', padding: '16px' }}>
              {/* Score */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: `conic-gradient(${financialScore.color} 0% ${financialScore.score}%, rgba(255,255,255,0.08) ${financialScore.score}% 100%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <div style={{ width: '35px', height: '35px', borderRadius: '50%', background: '#0D1520', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700, color: financialScore.color }}>{financialScore.score}</div>
                </div>
                <div>
                  <div style={{ fontSize: '10px', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '3px' }}>Score Financeiro</div>
                  <div style={{ fontSize: '15px', fontWeight: 600, color: '#FFFFFF' }}>{financialScore.label}</div>
                </div>
              </div>
              {/* Divisor */}
              {insights.length > 0 && <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)', margin: '12px 0' }} />}
              {/* Insights */}
              {insights.slice(0, 3).map((item, i) => {
                const CONFIG = {
                  risk: { color: '#F87171', bg: 'rgba(248,113,113,0.08)', emoji: '⚠️' },
                  warn: { color: '#FB923C', bg: 'rgba(251,146,60,0.08)',  emoji: '⚡' },
                  good: { color: '#22C55E', bg: 'rgba(34,197,94,0.08)',   emoji: '📈' },
                  info: { color: '#94A3B8', bg: 'rgba(148,163,184,0.06)', emoji: '💡' },
                };
                const cfg = CONFIG[item.color] || CONFIG.info;
                return (
                  <div
                    key={i}
                    onClick={() => item.meta?.action === 'openHistory' && setActiveView('log')}
                    style={{
                      display: 'flex', gap: '12px', alignItems: 'flex-start',
                      padding: '12px', borderRadius: '12px',
                      background: cfg.bg,
                      borderLeft: `3px solid ${cfg.color}`,
                      marginBottom: i < 2 ? '8px' : 0,
                      cursor: item.meta ? 'pointer' : 'default',
                    }}
                  >
                    <span style={{ fontSize: '20px', lineHeight: 1, marginTop: '1px', flexShrink: 0 }}>{cfg.emoji}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: '#FFFFFF', marginBottom: '3px' }}>{item.title}</div>
                      <div style={{ fontSize: '12px', color: '#94A3B8', lineHeight: 1.5 }}>{item.message}</div>
                      {item.explanation && (
                        <div style={{ fontSize: '11px', color: '#64748B', marginTop: '4px', lineHeight: 1.4 }}>{item.explanation}</div>
                      )}
                    </div>
                    {item.meta && <span style={{ color: '#64748B', fontSize: '16px', alignSelf: 'center' }}>›</span>}
                  </div>
                );
              })}
            </div>

          </div>
        );
      })()}

      {/* ══ HISTÓRICO ══ */}
      {activeView === 'log' && (
        <>
          {/* Type chips + search + filter buttons */}
          <div style={{
            display: 'flex', gap: 5, padding: '0 20px 10px',
            overflowX: 'auto', scrollbarWidth: 'none', touchAction: 'pan-x',
            alignItems: 'center',
          }}>
            {[
              { key: 'all',      label: 'Todos'          },
              { key: 'expense',  label: 'Despesas'       },
              { key: 'income',   label: 'Receitas'       },
              { key: 'transfer', label: 'Transferências' },
            ].map(({ key, label }) => {
              const cfg = {
                all:      { color: '#94A3B8', bg: 'rgba(255,255,255,0.06)',  border: 'rgba(255,255,255,0.11)'  },
                expense:  { color: '#F87171', bg: 'rgba(248,113,113,0.10)', border: 'rgba(248,113,113,0.25)'  },
                income:   { color: '#4ADE80', bg: 'rgba(74,222,128,0.10)',  border: 'rgba(74,222,128,0.25)'   },
                transfer: { color: '#00DDFF', bg: 'rgba(0,221,255,0.10)',   border: 'rgba(0,221,255,0.25)'    },
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
                    border: active ? `1px solid ${cfg.border}` : '1px solid rgba(255,255,255,0.07)',
                    color: active ? cfg.color : '#475569',
                  }}
                >{label}</button>
              );
            })}

            {/* Separator */}
            <div style={{ width: 1, height: 18, background: 'rgba(255,255,255,0.07)', flexShrink: 0, marginLeft: 2 }} />

            {/* Search icon button */}
            <button
              onClick={() => { setShowSearch(v => !v); if (showSearch) setSearchQuery(''); }}
              style={{
                flexShrink: 0, width: 28, height: 28, borderRadius: 8, cursor: 'pointer',
                WebkitTapHighlightColor: 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: showSearch ? 'rgba(0,221,255,0.10)' : 'rgba(255,255,255,0.03)',
                border: showSearch ? '1px solid rgba(0,221,255,0.28)' : '1px solid rgba(255,255,255,0.07)',
                color: showSearch ? '#00DDFF' : '#475569',
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
                background: showAccFilter ? 'rgba(251,191,36,0.10)' : 'rgba(255,255,255,0.03)',
                border: showAccFilter ? '1px solid rgba(251,191,36,0.28)' : '1px solid rgba(255,255,255,0.07)',
                color: showAccFilter ? '#FBBF24' : '#475569',
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
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(0,221,255,0.20)',
              borderRadius: 8, padding: '4px 9px',
              animation: 'expandSearch 0.15s ease',
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
                  color: '#94A3B8', fontSize: 11, width: '100%', fontFamily: 'inherit',
                }}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  style={{ background: 'none', border: 'none', color: '#334155', cursor: 'pointer', padding: 0, fontSize: 13, lineHeight: 1 }}
                >✕</button>
              )}
            </div>
          )}

          {/* Account filter chips */}
          {showAccFilter && (
            <div style={{
              display: 'flex', gap: 5, padding: '0 20px 6px',
              overflowX: 'auto', scrollbarWidth: 'none', touchAction: 'pan-x',
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
                    border: selectedAccountId === acc.id ? '1px solid rgba(251,191,36,0.25)' : '1px solid rgba(255,255,255,0.07)',
                    color: selectedAccountId === acc.id ? '#FBBF24' : '#475569',
                  }}
                >{acc.name}</button>
              ))}
            </div>
          )}

          {/* Day-grouped transaction list */}
          {visibleTransactions.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#475569', fontSize: 13, padding: '40px 20px' }}>
              Sem transações
            </div>
          ) : (
            <div style={{ padding: '0 16px' }}>
              {(() => {
                const groups = [];
                const seenDates = {};
                visibleTransactions.forEach(tx => {
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
                          fontSize: 10, fontWeight: 600, color: '#475569',
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
            </div>
          )}
        </>
      )}

    </div>
  );
}

  /* ── MODERN / FINTECH BRANCH ───────────────────────────────────────────── */
  if (theme === 'modern') {
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
            <div className="hist-sub-tabs-wrap">
              <button
                onClick={() => setHistoryView('daily')}
                className={`hist-sub-btn${historyView === 'daily' ? ' active' : ''}`}
              >Diário</button>
              <button
                onClick={() => setHistoryView('patrimony')}
                className={`hist-sub-btn${historyView === 'patrimony' ? ' active' : ''}`}
              >Património</button>
            </div>
          </div>
        )}

        {/* Account filter — only shown in log view and when there are accounts */}
        {activeView === 'log' && (patrimony.accounts || []).length > 0 && (
          <div className="account-filter-wrap">
            <div className="account-filter-scroll">
              <button
                className={`account-filter-btn${selectedAccountId === null ? ' active' : ''}`}
                onClick={() => setSelectedAccountId(null)}
              >
                Todas
              </button>
              {(patrimony.accounts || []).map(acc => (
                <button
                  key={acc.id}
                  className={`account-filter-btn${selectedAccountId === acc.id ? ' active' : ''}`}
                  onClick={() => setSelectedAccountId(acc.id)}
                >
                  {acc.name}
                </button>
              ))}
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
            <div className="stats-saldo-card">
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
                <div className="stats-overview-card">
                  {/* Spend ratio bar */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#71717a', marginBottom: 6 }}>
                    <span>Gasto mensal</span>
                    <span style={{ color: barColor, fontWeight: 600 }}>{pct.toFixed(0)}%</span>
                  </div>
                  <div className="stats-bar-track">
                    <div style={{ height: '100%', width: `${pct}%`, borderRadius: 999, background: `linear-gradient(90deg, var(--stats-bar-base, #6366f1), ${barColor})`, transition: 'width 0.4s ease' }} />
                  </div>
                  {/* Spending trend */}
                  <div style={{ marginTop: 10, fontSize: '0.8125rem', color: trendUp ? '#f87171' : '#4ade80', display: 'flex', alignItems: 'center', gap: 5 }}>
                    {trendUp
                      ? <><TrendingUp size={14} strokeWidth={2} color="#f87171" /> A gastar mais que o mês passado</>
                      : <><TrendingDown size={14} strokeWidth={2} color="#4ade80" /> A gastar menos que o mês passado</>
                    }
                  </div>
                </div>
              );
            })()}

            {/* Top 3 categories */}
            {categoryData.length > 0 && (
              <div className="stats-overview-card">
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
              const FEED_ICON  = {
                alert:       <AlertTriangle size={17} color="#f87171" strokeWidth={2} />,
                warning:     <Zap size={17} color="#facc15" strokeWidth={2} />,
                opportunity: <TrendingUp size={17} color="#4ade80" strokeWidth={2} />,
                info:        <BarChart2 size={17} color="#a0aabb" strokeWidth={2} />,
                forecast:    <Calendar size={17} color="#a0aabb" strokeWidth={2} />,
              };
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
                  onNavigate('budget', item.meta.categoryLabel ? { categoryLabel: item.meta.categoryLabel } : null);
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
                        <Calendar size={17} color="#a0aabb" strokeWidth={2} />
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
                  <div className="stats-overview-card" style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: feed.length > 0 ? 8 : 0 }}>
                    <div style={{ width: 48, height: 48, borderRadius: '50%', background: `conic-gradient(${financialScore.color} 0% ${financialScore.score}%, var(--stats-ring-track, #27272a) ${financialScore.score}% 100%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <div className="stats-score-inner" style={{ width: 35, height: 35, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700, color: financialScore.color }}>{financialScore.score}</div>
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
            {/* Search + filter button */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 20px 6px' }}>
              <div style={{
                flex: 1, display: 'flex', alignItems: 'center', gap: 5,
                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: 8, padding: '4px 9px',
              }}>
                <Search size={12} color="#2D3748" strokeWidth={1.75} style={{ flexShrink: 0 }} />
                <input
                  type="text"
                  placeholder="Pesquisar..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  style={{
                    background: 'none', border: 'none', outline: 'none',
                    color: '#94A3B8', fontSize: 11, width: '100%', fontFamily: 'inherit',
                  }}
                />
              </div>
              <button
                onClick={() => setShowAccFilter(v => !v)}
                style={{
                  width: 28, height: 28, borderRadius: 8, cursor: 'pointer',
                  background: showAccFilter ? 'rgba(0,221,255,0.10)' : 'rgba(255,255,255,0.04)',
                  border: showAccFilter ? '1px solid rgba(0,221,255,0.28)' : '1px solid rgba(255,255,255,0.06)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: showAccFilter ? '#00DDFF' : '#475569',
                  transition: 'all 0.15s', WebkitTapHighlightColor: 'transparent',
                }}
              >
                <SlidersHorizontal size={13} strokeWidth={1.75} />
              </button>
            </div>

            {/* Account filter chips */}
            {showAccFilter && (
              <div style={{
                display: 'flex', gap: 5, padding: '0 20px 6px',
                overflowX: 'auto', scrollbarWidth: 'none', touchAction: 'pan-x',
              }}>
                {[{ id: null, name: 'Todas as contas' }, ...(patrimony.accounts || [])].map(acc => (
                  <button
                    key={acc.id ?? 'all'}
                    onClick={() => setSelectedAccountId(acc.id)}
                    style={{
                      flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4,
                      padding: '5px 10px', borderRadius: 8, fontSize: 10, fontWeight: 500,
                      cursor: 'pointer', WebkitTapHighlightColor: 'transparent', fontFamily: 'inherit',
                      background: selectedAccountId === acc.id ? 'rgba(251,191,36,0.10)' : 'rgba(255,255,255,0.03)',
                      border: selectedAccountId === acc.id ? '1px solid rgba(251,191,36,0.25)' : '1px solid rgba(255,255,255,0.07)',
                      color: selectedAccountId === acc.id ? '#FBBF24' : '#475569',
                    }}
                  >{acc.name}</button>
                ))}
              </div>
            )}

            {/* Type filter chips */}
            <div style={{
              display: 'flex', gap: 5, padding: '0 20px 10px',
              overflowX: 'auto', scrollbarWidth: 'none', touchAction: 'pan-x',
            }}>
              {[
                { key: 'all',      label: 'Todos',          color: '#94A3B8', bg: 'rgba(255,255,255,0.06)',  border: 'rgba(255,255,255,0.11)'  },
                { key: 'expense',  label: 'Despesas',       color: '#F87171', bg: 'rgba(248,113,113,0.10)', border: 'rgba(248,113,113,0.25)'  },
                { key: 'income',   label: 'Receitas',       color: '#4ADE80', bg: 'rgba(74,222,128,0.10)',  border: 'rgba(74,222,128,0.25)'   },
                { key: 'transfer', label: 'Transferências', color: '#00DDFF', bg: 'rgba(0,221,255,0.10)',   border: 'rgba(0,221,255,0.25)'    },
              ].map(({ key, label, color, bg, border }) => (
                <button
                  key={key}
                  onClick={() => setHistoryView(key)}
                  style={{
                    flexShrink: 0, padding: '5px 10px', borderRadius: 8,
                    fontSize: 10, fontWeight: 500, cursor: 'pointer',
                    WebkitTapHighlightColor: 'transparent', fontFamily: 'inherit',
                    background: historyView === key ? bg : 'rgba(255,255,255,0.03)',
                    border: historyView === key ? `1px solid ${border}` : '1px solid rgba(255,255,255,0.07)',
                    color: historyView === key ? color : '#475569',
                  }}
                >{label}</button>
              ))}
            </div>

            {/* Day-grouped transaction list */}
            {visibleTransactions.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#334155', fontSize: 13, padding: '40px 20px' }}>
                Sem transações
              </div>
            ) : (
              <div style={{ padding: '0 20px' }}>
                {(() => {
                  const groups = [];
                  const seen = {};
                  visibleTransactions.forEach(tx => {
                    const d = tx.date || '';
                    if (!seen[d]) { seen[d] = []; groups.push({ date: d, txs: seen[d] }); }
                    seen[d].push(tx);
                  });

                  const fmtDayLabel = (dateStr) => {
                    if (!dateStr) return '—';
                    const d = new Date(dateStr + 'T00:00:00');
                    const today = new Date();
                    const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
                    if (d.toDateString() === today.toDateString())     return 'hoje · ' + d.toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' });
                    if (d.toDateString() === yesterday.toDateString()) return 'ontem · ' + d.toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' });
                    return d.toLocaleDateString('pt-PT', { weekday: 'short', day: 'numeric', month: 'short' });
                  };

                  return groups.map(({ date, txs }, gi) => {
                    const net = txs.reduce((s, t) => {
                      const a = parseFloat(t.amount) || 0;
                      return s + (t.type === 'income' ? a : -a);
                    }, 0);
                    return (
                      <div key={date}>
                        <div style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          paddingTop: gi === 0 ? 0 : 8, paddingBottom: 5,
                          borderTop: gi === 0 ? 'none' : '1px solid rgba(255,255,255,0.04)',
                          marginTop: gi === 0 ? 0 : 6,
                        }}>
                          <span style={{ fontSize: 10, fontWeight: 600, color: '#2D3748', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
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
              </div>
            )}
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
                      <span className="category-icon">{getCategoryIconEl(item.category, 'expense')}</span>
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
                style={{ marginLeft: '6px' }}
              >💳</button>
              <button
                onClick={() => setHistoryView('patrimony')}
                className={`today-btn-compact${historyView === 'patrimony' ? ' active' : ''}`}
                title="Transferências e ajustes"
              >🔁</button>
            </div>
          </div>

          {/* Account filter — only shown when there are accounts */}
          {(patrimony.accounts || []).length > 0 && (
            <div className="account-filter-wrap">
              <div className="account-filter-scroll">
                <button
                  className={`account-filter-btn${selectedAccountId === null ? ' active' : ''}`}
                  onClick={() => setSelectedAccountId(null)}
                >
                  Todas
                </button>
                {(patrimony.accounts || []).map(acc => (
                  <button
                    key={acc.id}
                    className={`account-filter-btn${selectedAccountId === acc.id ? ' active' : ''}`}
                    onClick={() => setSelectedAccountId(acc.id)}
                  >
                    {acc.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {visibleTransactions.length === 0 ? (
            <div className="empty-state">
              <span className="sf-icon-large">◌</span>
              <p>
                {selectedAccountId
                  ? 'Sem transações para esta conta'
                  : filterDate
                  ? 'Sem transações neste dia'
                  : 'Sem transações neste mês'}
              </p>
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
                      <div className={`modern-tx-icon ${tx.type}`}>{getCategoryIconEl(tx.category, tx.type)}</div>
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
                      {isTr ? '↔' : getCategoryIconEl(transaction.category, transaction.type)}
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
