import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useForm } from '../../hooks/useForm';
import { shiftFinancialMonth, isInFinancialMonth, getFinancialMonthRange } from '../../utils/financialMonth';
import { formatMonthLabel, getPrediction } from '../../utils/insights';
import { getTotalMonthlyCommitted } from '../../utils/recurringPayments';
import { STATUS } from '../../utils/budgetUtils';
import BudgetCategoryCard from './BudgetCategoryCard';
import CategoryHistorySheet from './CategoryHistorySheet';
import CountUp from './CountUp';
import { useAppContext } from '../../context/AppContext';

const BudgetsView = ({
  transactions,
  budgets: externalBudgets,
  onBudgetsChange,
  currentMonth,
  financialMonthStartDay,
  recurringPayments = [],
  onNavigateToRecurring,
  pendingCategoryLabel,
  onPendingCategoryConsumed,
}) => {
  const { categories } = useAppContext();
  const { draft: budgets, setField: setBudgetField, reset: resetBudgets, save: saveBudgetsForm } = useForm(externalBudgets);

  const [editingCategoryId,  setEditingCategoryId]  = useState(null);
  const [showInactive,       setShowInactive]       = useState(false);
  const [expandedCategoryId, setExpandedCategoryId] = useState(null);
  const [navExpandedId,      setNavExpandedId]      = useState(null);
  const [sheetCategoryId,    setSheetCategoryId]    = useState(null);
  const [sheetVisible,       setSheetVisible]       = useState(false);
  const [animated,           setAnimated]           = useState(false);
  const [selectedMonth,      setSelectedMonth]      = useState(currentMonth);

  // Sync external budgets into local draft
  useEffect(() => { resetBudgets(externalBudgets); }, [externalBudgets]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep selectedMonth in sync with currentMonth prop
  useEffect(() => { setSelectedMonth(currentMonth); }, [currentMonth]);

  // Animate bars when view mounts or data changes
  useEffect(() => {
    setAnimated(false);
    const t = setTimeout(() => setAnimated(true), 80);
    return () => clearTimeout(t);
  }, [transactions, selectedMonth]);

  // Open category sheet when parent sends a pendingCategoryLabel (from pendingNav)
  useEffect(() => {
    if (!pendingCategoryLabel) return;
    const cat = (categories.expense || []).find(c => c.label === pendingCategoryLabel);
    if (cat) openCategorySheet(cat.id);
    onPendingCategoryConsumed?.();
  }, [pendingCategoryLabel]); // eslint-disable-line react-hooks/exhaustive-deps

  const openCategorySheet = useCallback((catId) => {
    setSheetCategoryId(catId);
    setTimeout(() => setSheetVisible(true), 10);
  }, []);

  const closeCategorySheet = useCallback(() => {
    setSheetVisible(false);
    setTimeout(() => setSheetCategoryId(null), 350);
  }, []);

  const saveBudgetToDb = useCallback(() => {
    saveBudgetsForm((current) => {
      onBudgetsChange && onBudgetsChange(current);
    });
  }, [saveBudgetsForm, onBudgetsChange]);

  const handleLimitChange = useCallback((categoryId, value) => {
    setBudgetField(categoryId, parseFloat(value) || 0);
  }, [setBudgetField]);

  const getSpentForMonth = (categoryId, month) => {
    const categoryName = categories.expense.find(c => c.id === categoryId)?.label;
    return transactions
      .filter(t => t.type === 'expense' && t.category === categoryName && t.date && isInFinancialMonth(t.date, month, financialMonthStartDay))
      .reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);
  };

  const getSpentByCategory = (categoryId) => getSpentForMonth(categoryId, selectedMonth);

  const sortedItems = useMemo(() => {
    const prevMonth = shiftFinancialMonth(selectedMonth, -1);
    return categories.expense
      .map(cat => {
        const limit     = budgets[cat.id] || 0;
        const spent     = getSpentForMonth(cat.id, selectedMonth);
        const prevSpent = getSpentForMonth(cat.id, prevMonth);
        const percent   = limit > 0 ? (spent / limit) * 100 : 0;
        const delta     = spent - prevSpent;
        const predicted = getPrediction(spent, selectedMonth, financialMonthStartDay);
        return { cat, limit, spent, percent, delta, predicted };
      })
      .sort((a, b) => b.percent - a.percent);
  }, [categories.expense, budgets, transactions, selectedMonth]); // eslint-disable-line react-hooks/exhaustive-deps

  const txByCategory = useMemo(() => {
    const map = {};
    for (const cat of categories.expense) {
      const categoryName = cat.label;
      map[cat.id] = transactions
        .filter(t => t.type === 'expense' && t.category === categoryName && t.date && isInFinancialMonth(t.date, selectedMonth, financialMonthStartDay))
        .sort((a, b) => new Date(b.date) - new Date(a.date));
    }
    return map;
  }, [transactions, categories.expense, selectedMonth, financialMonthStartDay]);

  const activeItems   = sortedItems.filter(i => i.limit > 0 || i.spent > 0);
  const inactiveItems = sortedItems.filter(i => i.limit === 0 && i.spent === 0);

  const totalBudget = Object.values(budgets).reduce((s, v) => s + (v || 0), 0);
  const totalSpent  = (categories.expense || []).reduce((s, cat) => s + getSpentByCategory(cat.id), 0);
  const isTotalOver = totalBudget > 0 && totalSpent > totalBudget;

  return (
    <>
      {/* Month navigation */}
      <div className="m-month-nav">
        <button className="m-month-nav-btn" onClick={() => setSelectedMonth(shiftFinancialMonth(selectedMonth, -1))}>‹</button>
        <div className="m-month-nav-center">
          <span className="m-month-nav-label">{formatMonthLabel(selectedMonth, financialMonthStartDay)}</span>
          {selectedMonth !== currentMonth && (
            <button className="m-month-nav-today" onClick={() => setSelectedMonth(currentMonth)}>Este mês</button>
          )}
        </div>
        <button className="m-month-nav-btn" onClick={() => setSelectedMonth(shiftFinancialMonth(selectedMonth, 1))}>›</button>
      </div>

      {/* Main summary card */}
      {(() => {
        const remaining = totalBudget - totalSpent;
        const totalPct  = totalBudget > 0 ? Math.min((totalSpent / totalBudget) * 100, 100) : 0;
        const barColor  = STATUS(totalPct).grad;
        return (
          <div className="m-bmc">
            <span className="m-bmc-label">
              {(() => {
                if (financialMonthStartDay === 1) return 'Orçamento mensal';
                const { start, end } = getFinancialMonthRange(selectedMonth, financialMonthStartDay);
                const fmt = (s) => new Date(s + 'T00:00:00').toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' });
                return `${fmt(start)} → ${fmt(end)}`;
              })()}
            </span>
            <div className="m-bmc-big">
              <span className="m-bmc-amount" style={{ color: isTotalOver ? 'var(--cosmos-expense)' : undefined }}>
                <CountUp value={totalBudget > 0 ? Math.abs(remaining) : totalSpent} />€
              </span>
              <span className="m-bmc-sub">{isTotalOver ? 'excedido' : totalBudget > 0 ? 'disponível' : 'gasto'}</span>
            </div>
            <div className="m-bmc-row">
              <div className="m-bmc-col">
                <span className="m-bmc-col-val"><CountUp value={totalBudget} />€</span>
                <span className="m-bmc-col-label">Orçamento</span>
              </div>
              <div className="m-bmc-sep" />
              <div className="m-bmc-col">
                <span className="m-bmc-col-val" style={{ color: isTotalOver ? 'var(--cosmos-expense)' : undefined }}>
                  <CountUp value={totalSpent} />€
                </span>
                <span className="m-bmc-col-label">Gasto</span>
              </div>
            </div>
            {totalBudget > 0 && (
              <div className="m-bmc-bar-bg">
                <div className="m-bmc-bar-fill" style={{ width: animated ? `${totalPct}%` : '0%', background: barColor, boxShadow: animated ? `0 0 12px ${STATUS(totalPct).glow}` : 'none' }} />
              </div>
            )}
          </div>
        );
      })()}

      {/* Recurring committed strip */}
      {recurringPayments.length > 0 && (() => {
        const committed = getTotalMonthlyCommitted(recurringPayments);
        const activeCount = recurringPayments.filter(r => r.active !== false).length;
        return (
          <div className="rp-committed-strip" onClick={onNavigateToRecurring}>
            <span className="rp-committed-ico">↻</span>
            <div className="rp-committed-body">
              <div className="rp-committed-label">Comprometido (recorrentes)</div>
              <div className="rp-committed-val">{committed.toFixed(2)}€ / mês</div>
            </div>
            <div className="rp-committed-count">{activeCount} ativos</div>
          </div>
        );
      })()}

      {/* Category grid */}
      <div className="m-gcc-grid">

        {/* Active categories — always visible */}
        {activeItems.map(({ cat, limit, spent, percent, delta, predicted }) => (
          <BudgetCategoryCard
            key={cat.id}
            cat={cat}
            limit={limit}
            spent={spent}
            percent={percent}
            delta={delta}
            predicted={predicted}
            animated={animated}
            isEditing={editingCategoryId === cat.id}
            onEditToggle={() => setEditingCategoryId(editingCategoryId === cat.id ? null : cat.id)}
            onLimitChange={handleLimitChange}
            onSave={() => { saveBudgetToDb(); setEditingCategoryId(null); }}
            onOpenHistory={() => openCategorySheet(cat.id)}
          />
        ))}

        {/* Inactive categories — collapsed by default */}
        {inactiveItems.length > 0 && (
          <>
            <div
              className="m-gcc-inactive-toggle"
              onClick={() => setShowInactive(v => !v)}
            >
              <span className="m-gcc-inactive-label">
                {showInactive ? '−' : '＋'} {inactiveItems.length} categorias sem atividade
              </span>
              <span className={`m-gcc-inactive-chev${showInactive ? ' open' : ''}`}>›</span>
            </div>

            {showInactive && inactiveItems.map(({ cat, limit, spent, percent, delta, predicted }) => (
              <BudgetCategoryCard
                key={cat.id}
                cat={cat}
                limit={limit}
                spent={spent}
                percent={percent}
                delta={delta}
                predicted={predicted}
                animated={animated}
                isEditing={editingCategoryId === cat.id}
                onEditToggle={() => setEditingCategoryId(editingCategoryId === cat.id ? null : cat.id)}
                onLimitChange={handleLimitChange}
                onSave={() => { saveBudgetToDb(); setEditingCategoryId(null); }}
                onOpenHistory={() => openCategorySheet(cat.id)}
              />
            ))}
          </>
        )}

      </div>

      <CategoryHistorySheet
        catId={sheetCategoryId}
        categories={categories}
        txByCategory={txByCategory}
        budgets={budgets}
        sortedItems={sortedItems}
        animated={animated}
        isVisible={sheetVisible}
        onClose={closeCategorySheet}
      />
    </>
  );
};

export default BudgetsView;
