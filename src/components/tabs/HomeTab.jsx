import React, { useMemo } from 'react';
import { useAppContext } from '../../context/AppContext';
import { buildHeroModel } from '../../utils/homeHero';
import { buildInbox } from '../../utils/homeInbox';
import { spendingByCategory } from '../../utils/homeStats';
import { buildHomeInsights } from '../../utils/homeInsights';
import HomeHero from '../home/HomeHero';
import HomeInbox from '../home/HomeInbox';
import SpendingDonut from '../home/SpendingDonut';
import HomeInsights from '../home/HomeInsights';
import EmptyState from '../EmptyState';
import '../home/Home.css';

// ── helpers ──────────────────────────────────────────────────────────────────
const Card = ({ children, style }) => (
  <div style={{
    background: 'var(--cosmos-surface-1)',
    border: '1px solid var(--cosmos-border-card)',
    borderRadius: 16,
    boxShadow: 'var(--cosmos-shadow-card)',
    overflow: 'hidden',
    ...style,
  }}>
    {children}
  </div>
);

const Skeleton = ({ w = '100%', h = 16, radius = 8, style }) => (
  <div style={{
    width: w, height: h, borderRadius: radius,
    background: 'var(--cosmos-border-divider)',
    animation: 'ht-shimmer 1.4s ease-in-out infinite',
    ...style,
  }} />
);

// ── HomeTab ───────────────────────────────────────────────────────────────────
const HomeTab = ({
  transactions,
  currentMonth,
  patrimony = {},
  budgets = {},
  financialMonthStartDay = 1,
  onNavigate,
  recurringPayments = [],
  confirmedRecurring = {},
  mainAccountId = null,
  onConfirmRecurring,
  onSkipRecurring,
  userName = '',
  isLoading = false,
}) => {
  const { categories } = useAppContext();
  const accounts = useMemo(() => patrimony.accounts || [], [patrimony.accounts]);
  const startDay = financialMonthStartDay;

  // ── Modelos (puros, memoizados) ────────────────────────────────────────────
  const heroModel = useMemo(
    () => buildHeroModel({ transactions, currentMonth, startDay }),
    [transactions, currentMonth, startDay]
  );

  const inbox = useMemo(
    () => buildInbox({ recurringPayments, confirmedRecurring, transactions, accounts }),
    [recurringPayments, confirmedRecurring, transactions, accounts]
  );

  const spending = useMemo(
    () => spendingByCategory({ transactions, currentMonth, categories, startDay }),
    [transactions, currentMonth, categories, startDay]
  );

  const insights = useMemo(
    () => buildHomeInsights({ transactions, budgets, categories, currentMonth, startDay }),
    [transactions, budgets, categories, currentMonth, startDay]
  );

  // ── Handlers da inbox (reusam a lógica existente, não a alteram) ───────────
  const findPayment = (id) => recurringPayments.find(p => p.id === id);

  const handleInboxConfirm = (action) => {
    const p = findPayment(action.paymentId);
    if (!p) return;
    onConfirmRecurring?.({
      recurringPayment: p,
      dueDate:  action.dueDate,
      monthKey: action.monthKey,
      amount:   action.amount,
      accountId: p.accountId || mainAccountId || null,
    });
  };

  const handleInboxSkip = (action) => {
    const p = findPayment(action.paymentId);
    if (!p) return;
    onSkipRecurring?.({ recurringPayment: p, monthKey: action.monthKey });
  };

  const handleReviewUncategorized = () => onNavigate?.('stats');
  const handleReconcileAccount   = () => onNavigate?.('budget');

  const handleInsightAction = (action) => {
    if (action?.action === 'openBudget') onNavigate?.('budget', { categoryLabel: action.categoryLabel });
    else onNavigate?.('stats');
  };

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="h-page">
        <div style={{ padding: '20px 18px' }}>
          <Skeleton w={120} h={11} style={{ marginBottom: 16 }} />
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <Skeleton w={86} h={86} radius={999} />
            <div style={{ flex: 1 }}>
              <Skeleton w={180} h={16} style={{ marginBottom: 8 }} />
              <Skeleton w={140} h={12} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 16 }}>
            <Skeleton h={48} radius={10} /><Skeleton h={48} radius={10} /><Skeleton h={48} radius={10} />
          </div>
        </div>
      </div>
    );
  }

  // ── Utilizador sem dados: boas-vindas em vez de painéis vazios ─────────────
  const isFresh = !transactions?.length && inbox.length === 0 && spending.slices.length === 0;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="h-page">
      <HomeHero model={heroModel} userName={userName} />

      {isFresh ? (
        <EmptyState
          icon="✨"
          title="Bem-vindo!"
          description="Adiciona ou importa as tuas transações para a tua home ganhar vida."
          action="Adicionar transação"
          onAction={() => onNavigate?.('add')}
          style={{ paddingTop: 16 }}
        />
      ) : (
        <>
          <HomeInbox
            items={inbox}
            onConfirmRecurring={handleInboxConfirm}
            onSkipRecurring={handleInboxSkip}
            onReviewUncategorized={handleReviewUncategorized}
            onReconcileAccount={handleReconcileAccount}
          />

          {spending.slices.length > 0 && (
            <div className="card-anim" style={{ '--delay': '120ms', padding: '0 16px', marginBottom: 12 }}>
              <Card>
                <SpendingDonut slices={spending.slices} total={spending.total} onClick={() => onNavigate?.('stats')} />
              </Card>
            </div>
          )}

          {insights.length > 0 && (
            <div className="card-anim" style={{ '--delay': '180ms', padding: '0 16px', marginBottom: 12 }}>
              <Card style={{ padding: '4px 0' }}>
                <HomeInsights insights={insights} onAction={handleInsightAction} />
              </Card>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default HomeTab;
