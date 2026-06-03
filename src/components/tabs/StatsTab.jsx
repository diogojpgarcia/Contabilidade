import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Clock, SlidersHorizontal, Search, BarChart2 } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import CategoryPicker from '../CategoryPicker.jsx';
import FintechTransactionCard from '../FintechTransactionCard';
import { generateInsights, computeFinancialScore, shiftMonth } from '../../utils/insights';
import { filterByFinancialMonth, shiftFinancialMonth, getFinancialMonthLabel, getFinancialMonthRange } from '../../utils/financialMonth';
import { getCategoryMeta } from '../../utils/categoryIcons';
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

const StatsTab = ({ transactions, filteredTransactions, currentMonth, onMonthChange, budgets = {}, onTransactionDeleted, onCategoryChange, onAccountChange, onTransactionEdited, patrimony = {}, financialMonthStartDay = 1, onNavigate, financialFocus = null }) => {
  const { categories } = useAppContext();

  const [pickerTx, setPickerTx] = useState(null);

  const [activeView, setActiveView] = useState('overview'); // 'overview' or 'log'

  // Scroll outer container to top when switching between views
  const statsTabRef = useRef(null);
  useEffect(() => {
    const outer = statsTabRef.current?.closest('.main-content-new');
    if (outer) outer.scrollTop = 0;
  }, []); // só no mount, não em cada mudança de view
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
      byCategory[t.category] = (byCategory[t.category] || 0) + (parseFloat(t.amount) || 0);
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
        .reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);
      const expenses = monthTransactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);
      
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
        .reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);
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
      paddingBottom: 'var(--bottom-clearance)',
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
          <button onClick={goToNextMonth} disabled={currentMonth === new Date().toISOString().slice(0, 7)} style={{ background: 'var(--cosmos-border-divider)', border: 'none', borderRadius: '8px', width: '30px', height: '30px', color: 'var(--cosmos-text-1)', fontSize: '16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: currentMonth === new Date().toISOString().slice(0, 7) ? 0.4 : 1 }}>›</button>
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
      {activeView === 'overview' && (() => {
        const pct      = monthIncome > 0 ? Math.min((monthExpenses / monthIncome) * 100, 100) : 0;
        const barColor = pct >= 90 ? 'var(--cosmos-expense)' : pct >= 70 ? 'var(--cosmos-warning)' : 'var(--cosmos-accent)';
        const maxVal   = Math.max(...monthlyData.map(m => Math.max(m.income, m.expenses))) || 1;
        const W = 340; const H = 72;
        const cx = (i) => (i / 5) * W;
        const cyI = (v) => 68 - (v / maxVal) * 64;
        const cyE = (v) => 68 - (v / maxVal) * 64;
        const incomeAreaPath  = `M${cx(0)},${cyI(monthlyData[0]?.income||0)} ` + monthlyData.map((d,i) => `L${cx(i)},${cyI(d.income)}`).join(' ')  + ` L${W},${H} L0,${H} Z`;
        const expenseAreaPath = `M${cx(0)},${cyE(monthlyData[0]?.expenses||0)} ` + monthlyData.map((d,i) => `L${cx(i)},${cyE(d.expenses)}`).join(' ') + ` L${W},${H} L0,${H} Z`;
        const incomeLinePts  = monthlyData.map((d,i) => `${cx(i)},${cyI(d.income)}`).join(' ');
        const expenseLinePts = monthlyData.map((d,i) => `${cx(i)},${cyE(d.expenses)}`).join(' ');
        const CAT_COLORS = ['var(--cosmos-accent)', 'var(--cosmos-income)', 'var(--cosmos-warning)', 'var(--cosmos-expense)', '#8B5CF6'];
        return (
          <div style={{ display: 'flex', flexDirection: 'column' }}>

            {/* ── 1. CARD PRINCIPAL ── */}
            <div style={{
              borderRadius: '20px',
              background: 'var(--cosmos-surface-1)',
              border: '1px solid var(--cosmos-border-divider)',
              margin: '0 16px',
              overflow: 'hidden',
              boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
            }}>

              {/* Top section */}
              <div style={{ padding: '20px 20px 12px' }}>
                <div style={{ fontSize: '11px', color: 'var(--cosmos-text-3)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '8px' }}>
                  Saldo do Mês
                </div>
                <div style={{ fontSize: '36px', fontWeight: 700, color: monthSaldo >= 0 ? 'var(--cosmos-income)' : 'var(--cosmos-expense)', letterSpacing: '-0.02em', lineHeight: 1, marginBottom: '6px' }}>
                  {monthSaldo >= 0 ? '+' : '−'}{fmt(Math.abs(monthSaldo))}
                </div>
                <div style={{ fontSize: '13px', color: saldoDelta >= 0 ? 'var(--cosmos-income)' : 'var(--cosmos-expense)', marginBottom: '14px' }}>
                  {saldoDeltaLabel}
                </div>
                <div style={{ height: '1px', background: 'var(--cosmos-border-subtle)', marginBottom: '14px' }} />

                {/* 3-column row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                  {/* Receitas */}
                  <div>
                    <div style={{ fontSize: '10px', color: 'var(--cosmos-text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>Receitas</div>
                    <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--cosmos-income)' }}>+{fmt(monthIncome)}</div>
                  </div>
                  {/* Barra centro */}
                  <div style={{ flex: 1, maxWidth: '120px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--cosmos-text-3)', marginBottom: '4px' }}>
                      <span style={{ textTransform: 'uppercase', letterSpacing: '0.06em' }}>Gasto</span>
                      <span style={{ color: barColor, fontWeight: 600 }}>{pct.toFixed(0)}%</span>
                    </div>
                    <div style={{ height: '3px', background: 'var(--cosmos-border-divider)', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: `linear-gradient(90deg, var(--cosmos-accent), ${barColor})`, borderRadius: '3px', transition: 'width 0.4s ease' }} />
                    </div>
                  </div>
                  {/* Despesas */}
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '10px', color: 'var(--cosmos-text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>Despesas</div>
                    <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--cosmos-expense)' }}>−{fmt(monthExpenses)}</div>
                  </div>
                </div>
              </div>

              {/* Barra de labels — sempre renderizada, altura fixa */}
              {(() => {
                const CAT_COLORS = ['var(--cosmos-accent)', 'var(--cosmos-income)', 'var(--cosmos-warning)', 'var(--cosmos-expense)', '#8B5CF6'];
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
                          const color = CAT_COLORS[idx % 5] || 'var(--cosmos-accent)';
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
                          fontSize: '11px', color: 'var(--cosmos-text-3)',
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
                              const color = CAT_COLORS[idx % 5] || 'var(--cosmos-accent)';
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
                            const color = CAT_COLORS[idx % 5] || 'var(--cosmos-accent)';
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
                              <stop offset="0%" stopColor="var(--cosmos-income)" stopOpacity="0.25" />
                              <stop offset="100%" stopColor="var(--cosmos-income)" stopOpacity="0" />
                            </linearGradient>
                            <linearGradient id="expGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="var(--cosmos-expense)" stopOpacity="0.2" />
                              <stop offset="100%" stopColor="var(--cosmos-expense)" stopOpacity="0" />
                            </linearGradient>
                          </defs>
                          <path d={incArea} fill="url(#incGrad)" />
                          <path d={expArea} fill="url(#expGrad)" />
                          <polyline points={incPts} fill="none" stroke="var(--cosmos-income)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          <polyline points={expPts} fill="none" stroke="var(--cosmos-expense)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      );
                    })()}
                  </div>
                );
              })()}

              {/* Labels dos meses */}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 16px 14px' }}>
                {monthlyData.map((d, i) => (
                  <span key={i} style={{ fontSize: '10px', color: 'var(--cosmos-text-3)' }}>{d.month}</span>
                ))}
              </div>
            </div>

            {/* ── 2. TOP CATEGORIAS ── */}
            {categoryData.length > 0 && (
              <div style={{ margin: '12px 16px 0' }}>
                <div style={{ fontSize: '11px', color: 'var(--cosmos-text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px' }}>
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
                      <div style={{ flex: 1, fontSize: '14px', color: isSelected ? 'var(--cosmos-text-1)' : 'var(--cosmos-text-2)', fontWeight: isSelected ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cat.category}</div>
                      {/* Barra + % */}
                      <div style={{ width: '100px', flexShrink: 0 }}>
                        <div style={{ fontSize: '12px', color: CAT_COLORS[i % 5], textAlign: 'right', marginBottom: '3px' }}>{cat.percentage.toFixed(0)}%</div>
                        <div style={{ height: '3px', background: 'var(--cosmos-border-divider)', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${cat.percentage}%`, background: CAT_COLORS[i % 5], borderRadius: '3px', opacity: isSelected ? 1 : 0.7 }} />
                        </div>
                      </div>
                      {/* Valor */}
                      <div style={{ width: '64px', fontSize: '13px', color: 'var(--cosmos-text-3)', textAlign: 'right', flexShrink: 0 }}>{fmt(cat.amount)}</div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── 3. SCORE + INSIGHTS ── */}
            <div style={{ margin: '12px 16px 0', background: 'var(--cosmos-border-subtle)', border: '1px solid var(--cosmos-border-divider)', borderRadius: '16px', padding: '16px' }}>
              {/* Score */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: `conic-gradient(${financialScore.color} 0% ${financialScore.score}%, rgba(255,255,255,0.08) ${financialScore.score}% 100%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <div style={{ width: '35px', height: '35px', borderRadius: '50%', background: 'var(--cosmos-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700, color: financialScore.color }}>{financialScore.score}</div>
                </div>
                <div>
                  <div style={{ fontSize: '10px', color: 'var(--cosmos-text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '3px' }}>Score Financeiro</div>
                  <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--cosmos-text-1)' }}>{financialScore.label}</div>
                </div>
              </div>
              {/* Divisor */}
              {insights.length > 0 && <div style={{ height: '1px', background: 'var(--cosmos-border-subtle)', margin: '12px 0' }} />}
              {/* Insights */}
              {insights.slice(0, 3).map((item, i) => {
                const CONFIG = {
                  risk: { color: 'var(--cosmos-expense)', bg: 'rgba(248,113,113,0.08)', emoji: '⚠️' },
                  warn: { color: 'var(--cosmos-warning)', bg: 'rgba(251,146,60,0.08)',  emoji: '⚡' },
                  good: { color: 'var(--cosmos-income)', bg: 'rgba(34,197,94,0.08)',   emoji: '📈' },
                  info: { color: 'var(--cosmos-text-3)', bg: 'rgba(148,163,184,0.06)', emoji: '💡' },
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
                      <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--cosmos-text-1)', marginBottom: '3px' }}>{item.title}</div>
                      <div style={{ fontSize: '12px', color: 'var(--cosmos-text-3)', lineHeight: 1.5 }}>{item.message}</div>
                      {item.explanation && (
                        <div style={{ fontSize: '11px', color: 'var(--cosmos-text-3)', marginTop: '4px', lineHeight: 1.4 }}>{item.explanation}</div>
                      )}
                    </div>
                    {item.meta && <span style={{ color: 'var(--cosmos-text-3)', fontSize: '16px', alignSelf: 'center' }}>›</span>}
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
            </div>
          )}
        </>
      )}

    </div>
  );
};


export default StatsTab;
