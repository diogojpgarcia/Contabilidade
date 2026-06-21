import React, { useState, useEffect, useRef } from 'react';
import { LayoutGrid, RefreshCw, Target, Briefcase } from 'lucide-react';
import PageHeader from '../PageHeader';
import RecurringView from '../budget/RecurringView';
import BudgetsView from '../budget/BudgetsView';
import GoalsView from '../budget/GoalsView';
import PatrimonyView from '../budget/PatrimonyView';
import './BudgetTab.css';

const NAV = [
  { key: 'budgets',   Icon: LayoutGrid, label: 'Orçamento'   },
  { key: 'recurring', Icon: RefreshCw,  label: 'Recorrentes' },
  { key: 'goals',     Icon: Target,     label: 'Objetivos'   },
  { key: 'patrimony', Icon: Briefcase,  label: 'Património'  },
];

const BudgetTab = ({
  transactions,
  currentMonth,
  budgets: externalBudgets = {},
  onBudgetsChange,
  patrimony: externalPatrimony,
  onPatrimonyChange,
  onAccountRename,
  mainAccountId,
  onMainAccountChange,
  financialMonthStartDay = 1,
  pendingNav,
  onNavConsumed,
  recurringPayments = [],
  onRecurringPaymentsChange,
  confirmedRecurring = {},
  onConfirmRecurring,
  onLinkRecurring,
  onDeleteRecurring,
  onSkipRecurring,
  usageMode = 'manual',
  goals = [],
  onGoalsChange,
}) => {
  const [activeView, setActiveView] = useState('budgets');
  // pendingCategoryLabel: forwarded to BudgetsView so it can open the sheet
  const [pendingCategoryLabel, setPendingCategoryLabel] = useState(null);

  const budgetTabRef = useRef(null);

  // Scroll to top whenever the active view changes
  useEffect(() => {
    const outer = budgetTabRef.current?.closest('.main-content-new');
    if (outer) outer.scrollTop = 0;
  }, [activeView]);

  // Handle external navigation requests (pendingNav from parent)
  useEffect(() => {
    if (!pendingNav) return;
    if (pendingNav.view) {
      setActiveView(pendingNav.view);
    } else if (pendingNav.categoryLabel) {
      setActiveView('budgets');
      setPendingCategoryLabel(pendingNav.categoryLabel);
    }
    onNavConsumed?.();
  }, [pendingNav]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="m-budget-page" ref={budgetTabRef}>
      <PageHeader title="Orçamento" />

      {/* View toggle */}
      <div className="b-nav-grid">
        {NAV.map(({ key, Icon, label }) => (
          <button
            key={key}
            className={`b-nav-btn${activeView === key ? ' active' : ''}`}
            onClick={() => setActiveView(key)}
          >
            <Icon size={18} strokeWidth={1.75} />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {/* ── BUDGETS ── */}
      {activeView === 'budgets' && (
        <BudgetsView
          transactions={transactions}
          budgets={externalBudgets}
          onBudgetsChange={onBudgetsChange}
          currentMonth={currentMonth}
          financialMonthStartDay={financialMonthStartDay}
          recurringPayments={recurringPayments}
          onNavigateToRecurring={() => setActiveView('recurring')}
          pendingCategoryLabel={pendingCategoryLabel}
          onPendingCategoryConsumed={() => setPendingCategoryLabel(null)}
        />
      )}

      {/* ── RECURRING PAYMENTS ── */}
      {activeView === 'recurring' && (
        <RecurringView
          recurringPayments={recurringPayments}
          onRecurringPaymentsChange={onRecurringPaymentsChange}
          confirmedRecurring={confirmedRecurring}
          onConfirmRecurring={onConfirmRecurring}
          onLinkRecurring={onLinkRecurring}
          onDeleteRecurring={onDeleteRecurring}
          onSkipRecurring={onSkipRecurring}
          patrimony={externalPatrimony}
          transactions={transactions}
          usageMode={usageMode}
        />
      )}

      {/* ── GOALS ── */}
      {activeView === 'goals' && (
        <GoalsView
          goals={goals}
          onGoalsChange={onGoalsChange}
        />
      )}

      {/* ── PATRIMONY ── */}
      {activeView === 'patrimony' && (
        <PatrimonyView
          transactions={transactions}
          patrimony={externalPatrimony}
          onPatrimonyChange={onPatrimonyChange}
          onAccountRename={onAccountRename}
          mainAccountId={mainAccountId}
          onMainAccountChange={onMainAccountChange}
          currentMonth={currentMonth}
          financialMonthStartDay={financialMonthStartDay}
          recurringPayments={recurringPayments}
          confirmedRecurring={confirmedRecurring}
          onConfirmRecurring={onConfirmRecurring}
          usageMode={usageMode}
        />
      )}
    </div>
  );
};

export default BudgetTab;
