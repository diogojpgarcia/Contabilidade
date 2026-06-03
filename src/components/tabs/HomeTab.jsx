import React, { useMemo } from 'react';
import { Plus, ArrowLeftRight, RefreshCw, TrendingUp, ChevronRight } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { getUpcomingPayments, relativeDueDate, safeNum, isConfirmedForMonth, getRecurringMonthKey } from '../../utils/recurringPayments';
import { generateInsights } from '../../utils/insights';
import { CategoryIconBubble } from '../../utils/categoryIcons';
import '../home/Home.css';

// ── helpers ──────────────────────────────────────────────────────────────────
const fmt = (v, decimals = 2) =>
  (parseFloat(v) || 0).toLocaleString('pt-PT', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 19) return 'Boa tarde';
  return 'Boa noite';
}

function getCycleDay(useFinancial, startDay) {
  const today = new Date();
  const d = today.getDate();
  const S = (useFinancial && startDay > 1) ? startDay : 1;
  if (S === 1) {
    return { diaAtual: d, totalDias: new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate() };
  }
  let csY = today.getFullYear(), csM = today.getMonth();
  if (d < S) { csM -= 1; if (csM < 0) { csM = 11; csY -= 1; } }
  const ceM = (csM + 1) % 12, ceY = csM === 11 ? csY + 1 : csY;
  const total = Math.round((new Date(ceY, ceM, S) - new Date(csY, csM, S)) / 86400000);
  const current = Math.round((today - new Date(csY, csM, S)) / 86400000) + 1;
  return { diaAtual: Math.max(1, current), totalDias: total };
}

// ── Sub-components ────────────────────────────────────────────────────────────

const Section = ({ children, style }) => (
  <div style={{ padding: '0 16px', marginBottom: 12, ...style }}>{children}</div>
);

const SectionHeader = ({ title, action, onAction }) => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--cosmos-text-2)', letterSpacing: '0.01em' }}>{title}</span>
    {action && (
      <button
        onClick={onAction}
        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                 fontSize: 12, color: 'var(--cosmos-accent)', display: 'flex', alignItems: 'center', gap: 2 }}
      >
        {action} <ChevronRight size={12} />
      </button>
    )}
  </div>
);

const Card = ({ children, onClick, style }) => (
  <div
    onClick={onClick}
    role={onClick ? 'button' : undefined}
    style={{
      background: 'var(--cosmos-surface-1)',
      border: '1px solid var(--cosmos-border-card)',
      borderRadius: 16,
      padding: '14px 16px',
      boxShadow: 'var(--cosmos-shadow-card)',
      cursor: onClick ? 'pointer' : 'default',
      WebkitTapHighlightColor: 'transparent',
      ...style,
    }}
  >
    {children}
  </div>
);

// ── HomeTab ───────────────────────────────────────────────────────────────────
const HomeTab = ({
  balance, transactions, currentMonth,
  patrimony = {},
  budgets = [],
  financialMonthStartDay = 1,
  homeUsesFinancialMonth = true,
  onNavigate,
  recurringPayments,
  confirmedRecurring = {},
  userName = '',
}) => {
  const { categories } = useAppContext();
  const p = patrimony;

  // ── Patrimony total ────────────────────────────────────────────────────────
  const patrimonyTotal = useMemo(() => {
    const sumA = (p.accounts   || []).reduce((s, x) => s + (parseFloat(x.currentBalance ?? x.balance) || 0), 0);
    const sumS = (p.stocks     || []).reduce((s, x) => s + (parseFloat(x.qty) || 0) * (parseFloat(x.lastPrice ?? x.avgPrice) || 0), 0);
    const sumE = (p.etfs       || []).reduce((s, x) => s + (parseFloat(x.qty) || 0) * (parseFloat(x.lastPrice ?? x.avgPrice) || 0), 0);
    const sumB = (p.bonds      || []).reduce((s, x) => s + (parseFloat(x.value) || 0), 0);
    const sumR = (p.realestate || []).reduce((s, x) => s + (parseFloat(x.value) || 0), 0);
    const sumV = (p.vehicles   || []).reduce((s, x) => s + (parseFloat(x.value) || 0), 0);
    const sumC = (p.crypto     || []).reduce((s, x) => s + (parseFloat(x.qty) || 0) * (parseFloat(x.lastPrice ?? x.price) || 0), 0);
    return sumA + sumS + sumE + sumB + sumR + sumV + sumC;
  }, [p]);

  // ── Month cycle ───────────────────────────────────────────────────────────
  const { diaAtual, totalDias } = getCycleDay(homeUsesFinancialMonth, financialMonthStartDay);
  const cyclePct = Math.round((diaAtual / totalDias) * 100);

  // ── Budget status ─────────────────────────────────────────────────────────
  const budgetStatus = useMemo(() => {
    if (!currentMonth) return { totalLimit: 0, totalSpent: 0, over: [], hasData: false };
    const expCats = categories?.expense || [];
    // budgets is stored as an object { id: { category, limit, ... } } — convert to array
    const budgetArr = Array.isArray(budgets) ? budgets : Object.values(budgets || {});
    const rows = budgetArr.map(b => {
      const cat = expCats.find(c => c.id === b.categoryId || c.label === b.category);
      const spent = (transactions || [])
        .filter(t => t.type === 'expense' && (t.date || '').startsWith(currentMonth) &&
          (t.category === b.category || t.category === cat?.label))
        .reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);
      return { label: b.category || cat?.label || b.categoryId, limit: parseFloat(b.limit) || 0, spent };
    }).filter(r => r.limit > 0);
    const totalLimit = rows.reduce((s, r) => s + r.limit, 0);
    const totalSpent = rows.reduce((s, r) => s + r.spent, 0);
    const over = rows.filter(r => r.spent > r.limit);
    return { totalLimit, totalSpent, over, hasData: totalLimit > 0 };
  }, [budgets, transactions, currentMonth, categories]);

  // ── Upcoming payments ─────────────────────────────────────────────────────
  const upcoming = useMemo(() => getUpcomingPayments(recurringPayments, 3), [recurringPayments]);
  const today = new Date().toISOString().split('T')[0];
  const expCats = categories?.expense || [];

  // ── Key insight ───────────────────────────────────────────────────────────
  const keyInsight = useMemo(() => {
    if (!transactions?.length || !currentMonth) return null;
    const { categories: appCats } = { categories: categories || {} };
    const budgetArr = Array.isArray(budgets) ? budgets : Object.values(budgets || {});
    try {
      const insights = generateInsights({
        transactions,
        budgets: budgetArr,
        categories: appCats,
        selectedMonth: currentMonth,
      });
      return insights?.[0] || null;
    } catch { return null; }
  }, [transactions, currentMonth, budgets, categories]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="h-page">

      {/* ── 1. HERO ── */}
      <div style={{ padding: '20px 20px 8px' }}>
        {/* Greeting */}
        <div style={{ fontSize: 13, color: 'var(--cosmos-text-3)', marginBottom: 20, letterSpacing: '0.01em' }}>
          {getGreeting()}, {userName || 'Diogo'}
        </div>

        {/* Patrimony — centrepiece */}
        <div style={{ marginBottom: 6 }}>
          <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--cosmos-text-3)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>
            Património total
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span style={{ fontSize: 42, fontWeight: 700, color: 'var(--cosmos-text-1)', letterSpacing: '-0.04em', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
              {fmt(patrimonyTotal)}
            </span>
            <span style={{ fontSize: 20, fontWeight: 400, color: 'var(--cosmos-text-3)', letterSpacing: '-0.01em' }}>€</span>
          </div>
        </div>

        {/* Monthly balance chip + month progress */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: balance >= 0 ? 'var(--cosmos-income-dim)' : 'var(--cosmos-expense-dim)',
            borderRadius: 999, padding: '5px 12px',
          }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: balance >= 0 ? 'var(--cosmos-income)' : 'var(--cosmos-expense)', fontVariantNumeric: 'tabular-nums' }}>
              {balance >= 0 ? '+' : ''}{fmt(balance)}€
            </span>
            <span style={{ fontSize: 11, color: balance >= 0 ? 'var(--cosmos-income)' : 'var(--cosmos-expense)', opacity: 0.7 }}>
              este mês
            </span>
          </div>
          {/* Month progress */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 72, height: 3, background: 'var(--cosmos-border-divider)', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ width: `${cyclePct}%`, height: '100%', background: 'var(--cosmos-accent)', borderRadius: 2, transition: 'width 0.6s ease' }} />
            </div>
            <span style={{ fontSize: 11, color: 'var(--cosmos-text-3)', whiteSpace: 'nowrap' }}>dia {diaAtual}/{totalDias}</span>
          </div>
        </div>
      </div>

      {/* ── 2. QUICK ACTIONS ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8, padding: '14px 16px' }}>
        {[
          { icon: <Plus size={18} strokeWidth={2} />, label: 'Despesa', color: 'var(--cosmos-expense)', bg: 'var(--cosmos-expense-dim)', action: () => onNavigate?.('add') },
          { icon: <Plus size={18} strokeWidth={2} />, label: 'Receita', color: 'var(--cosmos-income)', bg: 'var(--cosmos-income-dim)', action: () => onNavigate?.('add', { mode: 'income' }) },
          { icon: <ArrowLeftRight size={16} strokeWidth={1.75} />, label: 'Transferir', color: 'var(--cosmos-accent)', bg: 'var(--cosmos-accent-dim)', action: () => onNavigate?.('add', { mode: 'transfer' }) },
          { icon: <TrendingUp size={16} strokeWidth={1.75} />, label: 'Análise', color: 'var(--cosmos-warning, #f59e0b)', bg: 'rgba(245,158,11,0.12)', action: () => onNavigate?.('stats') },
        ].map(({ icon, label, color, bg, action }) => (
          <button
            key={label}
            onClick={action}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
              background: bg, border: 'none', borderRadius: 14, padding: '12px 4px',
              cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
              transition: 'opacity 0.12s, transform 0.1s',
            }}
            onPointerDown={e => e.currentTarget.style.transform = 'scale(0.94)'}
            onPointerUp={e => e.currentTarget.style.transform = ''}
            onPointerLeave={e => e.currentTarget.style.transform = ''}
          >
            <span style={{ color, display: 'flex' }}>{icon}</span>
            <span style={{ fontSize: 10, fontWeight: 600, color, letterSpacing: '0.01em' }}>{label}</span>
          </button>
        ))}
      </div>

      {/* ── 3. BUDGET DO MÊS ── */}
      {budgetStatus.hasData && (
        <Section>
          <SectionHeader title="Orçamento do mês" action="Gerir" onAction={() => onNavigate?.('budget')} />
          <Card onClick={() => onNavigate?.('budget')}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
              <span style={{ fontSize: 22, fontWeight: 700, color: budgetStatus.totalSpent > budgetStatus.totalLimit ? 'var(--cosmos-expense)' : 'var(--cosmos-text-1)', letterSpacing: '-0.02em' }}>
                {fmt(budgetStatus.totalSpent)}€
              </span>
              <span style={{ fontSize: 13, color: 'var(--cosmos-text-3)' }}>
                de {fmt(budgetStatus.totalLimit)}€
              </span>
            </div>
            <div style={{ height: 6, background: 'var(--cosmos-border-divider)', borderRadius: 3, overflow: 'hidden', marginBottom: 8 }}>
              <div style={{
                height: '100%', borderRadius: 3,
                width: `${Math.min(100, (budgetStatus.totalSpent / budgetStatus.totalLimit) * 100)}%`,
                background: budgetStatus.totalSpent > budgetStatus.totalLimit
                  ? 'var(--cosmos-expense)'
                  : budgetStatus.totalSpent / budgetStatus.totalLimit > 0.8
                    ? 'var(--cosmos-warning, #f59e0b)'
                    : 'var(--cosmos-income)',
                transition: 'width 0.4s ease',
              }} />
            </div>
            {budgetStatus.over.length > 0 && (
              <div style={{ fontSize: 11, color: 'var(--cosmos-expense)', fontWeight: 500 }}>
                ⚠ {budgetStatus.over.map(r => r.label).join(', ')} {budgetStatus.over.length === 1 ? 'excedeu' : 'excederam'} o limite
              </div>
            )}
            {budgetStatus.over.length === 0 && (
              <div style={{ fontSize: 11, color: 'var(--cosmos-text-3)' }}>
                Restam {fmt(budgetStatus.totalLimit - budgetStatus.totalSpent)}€ · {cyclePct}% do mês
              </div>
            )}
          </Card>
        </Section>
      )}

      {/* ── 4. PRÓXIMAS CONTAS ── */}
      {upcoming.length > 0 && (
        <Section>
          <SectionHeader title="Próximas contas" action="Ver todas" onAction={() => onNavigate?.('budget', { view: 'recurring' })} />
          <Card style={{ padding: 0 }}>
            {upcoming.map((p, idx) => {
              const due = p.computedNextDue;
              const monthKey = getRecurringMonthKey(due);
              const isConfirmed = isConfirmedForMonth(p.id, monthKey, confirmedRecurring);
              const isPast = due <= today;
              const isPending = isPast && !isConfirmed;
              const catLabel = expCats.find(c => c.id === p.categoryId)?.label || '';
              const diffDays = Math.round((new Date(due + 'T00:00:00') - new Date(today + 'T00:00:00')) / 86400000);
              const urgency = diffDays <= 0 ? 'var(--cosmos-expense)' : diffDays <= 3 ? 'var(--cosmos-warning, #f59e0b)' : 'var(--cosmos-text-3)';

              return (
                <div
                  key={p.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '12px 16px',
                    borderBottom: idx < upcoming.length - 1 ? '1px solid var(--cosmos-border-divider)' : 'none',
                  }}
                >
                  <CategoryIconBubble name={catLabel} type="expense" size={32} radius="10px" />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--cosmos-text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {p.title}
                    </div>
                    <div style={{ fontSize: 11, color: urgency, marginTop: 1 }}>
                      {isConfirmed ? '✓ Pago' : relativeDueDate(due)}
                      {isPending && !isConfirmed && ' · por confirmar'}
                    </div>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: isConfirmed ? 'var(--cosmos-text-3)' : 'var(--cosmos-text-1)', textDecoration: isConfirmed ? 'line-through' : 'none' }}>
                    {p.paymentType === 'variable' && p.estimatedAmount
                      ? `~${safeNum(p.estimatedAmount).toFixed(2)}€`
                      : `${safeNum(p.amount).toFixed(2)}€`}
                  </div>
                </div>
              );
            })}
          </Card>
        </Section>
      )}

      {/* ── 5. KEY INSIGHT ── */}
      {keyInsight && (
        <Section>
          <SectionHeader title="Insight do mês" action="Ver análise" onAction={() => onNavigate?.('stats')} />
          <Card onClick={() => onNavigate?.('stats')} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <span style={{ fontSize: 22, flexShrink: 0, marginTop: 1 }}>{keyInsight.icon || '💡'}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--cosmos-text-1)', marginBottom: 3 }}>{keyInsight.title}</div>
              <div style={{ fontSize: 12, color: 'var(--cosmos-text-2)', lineHeight: 1.45 }}>{keyInsight.description}</div>
            </div>
            <ChevronRight size={16} color="var(--cosmos-text-3)" style={{ flexShrink: 0, marginTop: 3 }} />
          </Card>
        </Section>
      )}


    </div>
  );
};

export default HomeTab;
