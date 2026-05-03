import React, { useState, useEffect, useRef, useMemo } from 'react';
import { dbService } from '../../lib/supabase';
import Overlay from '../Overlay';
import { useForm } from '../../hooks/useForm';
import { Card, Bubble, ProgressBar, getGradient } from '../ui';
import './BudgetTab.css';

const CATEGORY_ICONS = {
  'Alimentação':'⚑','Habitação':'⌂','Transporte':'⚐','Saúde':'✚','Lazer':'◉',
  'Educação':'⊞','Roupa':'◫','Tecnologia':'◧','Subscrições':'◉','Outros':'◌'
};

const PATRIMONY_TYPES = [
  { key: 'accounts',   label: 'Contas Bancárias', icon: '◈', color: '#D97706' },
  { key: 'stocks',     label: 'Ações',             icon: '◭', color: '#059669' },
  { key: 'bonds',      label: 'Cert. Aforro',      icon: '◆', color: '#7C3AED' },
  { key: 'realestate', label: 'Imóveis',            icon: '⌂', color: '#DC2626' },
  { key: 'vehicles',   label: 'Veículos',           icon: '⚐', color: '#0891B2' },
  { key: 'crypto',     label: 'Crypto',             icon: '◉', color: '#F59E0B' },
];

const EMPTY_PATRIMONY = { accounts: [], stocks: [], bonds: [], realestate: [], vehicles: [], crypto: [] };
const EMPTY_GOAL      = { name: '', amount: '', targetDate: '', currentSavings: '' };

const CAT_COLORS = {
  'Alimentação':'#F59E0B','Habitação':'#3B82F6','Transporte':'#8B5CF6',
  'Saúde':'#10B981','Lazer':'#EC4899','Educação':'#06B6D4',
  'Roupa':'#F97316','Tecnologia':'#6366F1','Subscrições':'#84CC16','Outros':'#6B7280',
};

const getCategoryIcon = (category) => {
  const label = typeof category === 'string' ? category : category?.label;
  return CATEGORY_ICONS[label] || '◌';
};

const MONTH_NAMES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

const shiftMonth = (yyyymm, delta) => {
  const [y, m] = yyyymm.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const formatMonthLabel = (yyyymm) => {
  const [y, m] = yyyymm.split('-').map(Number);
  return `${MONTH_NAMES[m - 1]} ${y}`;
};

const getPrediction = (spent, selectedMonth) => {
  const today = new Date();
  const [y, m] = selectedMonth.split('-').map(Number);
  if (today.getFullYear() !== y || today.getMonth() + 1 !== m) return null;
  const daysPassed = today.getDate();
  if (daysPassed === 0 || spent === 0) return null;
  const daysTotal = new Date(y, m, 0).getDate();
  return Math.round((spent / daysPassed) * daysTotal);
};

const CountUp = ({ value, decimals = 0 }) => {
  const [display, setDisplay] = useState(0);
  const fromRef = useRef(0);
  const rafRef  = useRef(null);
  useEffect(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    const from = fromRef.current;
    const start = Date.now();
    const tick = () => {
      const p = Math.min((Date.now() - start) / 700, 1);
      const eased = 1 - (1 - p) ** 3;
      const curr = from + (value - from) * eased;
      setDisplay(curr);
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
      else fromRef.current = value;
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [value]);
  return <>{display.toFixed(decimals)}</>;
};

const BudgetCategoryCard = ({ cat, limit, spent, percent, delta, predicted, animated, isEditing, onEditToggle, onLimitChange, onSave }) => {
  const color      = CAT_COLORS[cat.label] || '#6B7280';
  const colorClass = percent > 100 ? 'over' : percent >= 70 ? 'warn' : '';
  const willExceed = predicted !== null && limit > 0 && predicted > limit;

  return (
    <div className="m-bcc">
      <div className="m-bcc-row">
        <Bubble color={color} icon={getCategoryIcon(cat.label)} size={40} radius="12px" />
        <div className="m-bcc-info">
          <div className="m-bcc-name-row">
            <span className="m-bcc-name">{cat.label}</span>
            {percent >= 100 && <span className="m-bcc-badge over">Ultrapassado</span>}
            {percent >= 80 && percent < 100 && <span className="m-bcc-badge warn">Atenção</span>}
          </div>
          <div className="m-bcc-meta-row">
            <span className={`m-bcc-spent ${colorClass}`}>
              {spent.toFixed(0)}€{limit > 0 ? ` / ${limit.toFixed(0)}€` : ''}
            </span>
            {delta > 0.5  && <span className="m-bcc-delta up">↑ +{delta.toFixed(0)}€</span>}
            {delta < -0.5 && <span className="m-bcc-delta down">↓ {Math.abs(delta).toFixed(0)}€</span>}
          </div>
        </div>
        <button className="m-bcc-edit" onClick={onEditToggle}>✏</button>
      </div>

      {isEditing && (
        <div className="m-bcc-edit-row">
          <input
            type="number"
            inputMode="decimal"
            className="m-bcc-input"
            value={limit || ''}
            onChange={(e) => onLimitChange(cat.id, e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { onSave(); e.target.blur(); } }}
            placeholder="Limite €/mês"
            autoFocus
          />
          <button className="m-bcc-save" onClick={onSave}>✓</button>
        </div>
      )}

      {limit > 0 && <ProgressBar percent={percent} animated={animated} height={8} />}

      {predicted !== null && limit > 0 && (
        <div className={`m-bcc-prediction${willExceed ? ' exceed' : ''}`}>
          <span>Previsto: {predicted}€</span>
          {willExceed && <span className="m-bcc-prediction-warn">Vai ultrapassar</span>}
        </div>
      )}
    </div>
  );
};

/**
 * Isolated input so the goal-savings field has its own draft.
 * onChange → local draft only.  onBlur → parent save (touches DB).
 */
const GoalSavingsInput = ({ goal, onSave, className }) => {
  const { draft, setField } = useForm({ currentSavings: goal.currentSavings ?? 0 });
  return (
    <input
      type="number"
      className={className}
      value={draft.currentSavings || ''}
      onChange={(e) => setField('currentSavings', e.target.value)}
      onBlur={() => onSave(goal.id, parseFloat(draft.currentSavings) || 0)}
      step="10"
      min="0"
      placeholder="0"
    />
  );
};

const BudgetTab = ({ user, transactions, currentMonth, categories, patrimony: externalPatrimony, onPatrimonyChange, theme = 'default' }) => {
  // ── useForm-backed drafts (onChange → local only; save on blur / button) ──
  const { draft: budgets,      setField: setBudgetField,    reset: resetBudgets,     save: saveBudgetsForm } = useForm({});
  const { draft: newGoal,      setField: setGoalField,      reset: resetGoal                               } = useForm(EMPTY_GOAL);
  const { draft: patrimonyForm, setField: setPatrimonyField, reset: resetPatrimonyForm                     } = useForm({});

  const [activeView,          setActiveView]          = useState('budgets');
  const [goals,               setGoals]               = useState([]);
  const [editingGoalId,       setEditingGoalId]       = useState(null);
  const [showPatrimonyModal,  setShowPatrimonyModal]  = useState(false);
  const [patrimonyFormType,   setPatrimonyFormType]   = useState(null);
  const [editingCategoryId,   setEditingCategoryId]   = useState(null);
  const [animated,            setAnimated]            = useState(false);
  const [selectedMonth,       setSelectedMonth]       = useState(currentMonth);

  useEffect(() => { setSelectedMonth(currentMonth); }, [currentMonth]);

  useEffect(() => {
    if (activeView !== 'budgets') return;
    setAnimated(false);
    const t = setTimeout(() => setAnimated(true), 80);
    return () => clearTimeout(t);
  }, [activeView, transactions, selectedMonth]);

  const patrimony = externalPatrimony || EMPTY_PATRIMONY;

  useEffect(() => { loadData(); }, [user]);

  const loadData = async () => {
    try {
      const settings = await dbService.getUserSettings(user.id);
      if (settings?.category_budgets) resetBudgets(settings.category_budgets);
      if (settings?.goals) setGoals(settings.goals);
    } catch (error) { console.error('Error loading data:', error); }
  };

  const saveBudgetToDb = () => {
    saveBudgetsForm((current) => {
      dbService.updateUserSettings(user.id, { category_budgets: current })
        .catch(err => { console.error('Error saving budgets:', err); alert('Erro ao guardar'); });
    });
  };

  const saveGoals = async (updatedGoals) => {
    try {
      await dbService.updateUserSettings(user.id, { goals: updatedGoals });
      setGoals(updatedGoals);
    } catch (error) { console.error('Error saving goals:', error); alert('Erro ao guardar objetivos'); }
  };

  const handleAddGoal = () => {
    if (!newGoal.name || !newGoal.amount) { alert('Preenche nome e valor'); return; }
    const goal = {
      id: Date.now().toString(),
      ...newGoal,
      amount: parseFloat(newGoal.amount),
      currentSavings: parseFloat(newGoal.currentSavings) || 0,
    };
    saveGoals([...goals, goal]);
    resetGoal(EMPTY_GOAL);
  };

  // Called only from GoalSavingsInput.onBlur — never from onChange.
  const handleUpdateGoalSavings = (goalId, value) => {
    saveGoals(goals.map(g => g.id === goalId ? { ...g, currentSavings: parseFloat(value) || 0 } : g));
  };

  const handleDeleteGoal = async (goalId) => {
    if (!confirm('Apagar este objetivo?')) return;
    saveGoals(goals.filter(g => g.id !== goalId));
  };

  // onChange → local draft only.  DB save happens via saveBudgetToDb button / Enter.
  const handleLimitChange = (categoryId, value) => {
    setBudgetField(categoryId, parseFloat(value) || 0);
  };

  const getSpentForMonth = (categoryId, month) => {
    const categoryName = categories.expense.find(c => c.id === categoryId)?.label;
    return transactions
      .filter(t => t.type === 'expense' && t.category === categoryName && t.date.startsWith(month))
      .reduce((sum, t) => sum + parseFloat(t.amount), 0);
  };

  const getSpentByCategory = (categoryId) => getSpentForMonth(categoryId, selectedMonth);

  const sortedItems = useMemo(() => {
    const prevMonth = shiftMonth(selectedMonth, -1);
    return categories.expense
      .map(cat => {
        const limit     = budgets[cat.id] || 0;
        const spent     = getSpentForMonth(cat.id, selectedMonth);
        const prevSpent = getSpentForMonth(cat.id, prevMonth);
        const percent   = limit > 0 ? (spent / limit) * 100 : 0;
        const delta     = spent - prevSpent;
        const predicted = getPrediction(spent, selectedMonth);
        return { cat, limit, spent, percent, delta, predicted };
      })
      .sort((a, b) => b.percent - a.percent);
  }, [categories.expense, budgets, transactions, selectedMonth]);

  const getPatrimonyTypeValue = (key) => {
    const items = patrimony[key] || [];
    if (key === 'accounts')   return items.reduce((s, x) => s + (parseFloat(x.balance) || 0), 0);
    if (key === 'stocks')     return items.reduce((s, x) => s + (parseFloat(x.qty) || 0) * (parseFloat(x.avgPrice) || 0), 0);
    if (key === 'bonds')      return items.reduce((s, x) => s + (parseFloat(x.value) || 0), 0);
    if (key === 'realestate') return items.reduce((s, x) => s + (parseFloat(x.value) || 0), 0);
    if (key === 'vehicles')   return items.reduce((s, x) => s + (parseFloat(x.value) || 0), 0);
    if (key === 'crypto')     return items.reduce((s, x) => s + (parseFloat(x.qty) || 0) * (parseFloat(x.price) || 0), 0);
    return 0;
  };

  const totalPatrimony = PATRIMONY_TYPES.reduce((s, t) => s + getPatrimonyTypeValue(t.key), 0);

  const handlePatrimonyDelete = (typeKey, id) => {
    if (!confirm('Remover este activo?')) return;
    const updated = { ...patrimony, [typeKey]: (patrimony[typeKey] || []).filter(x => x.id !== id) };
    onPatrimonyChange && onPatrimonyChange(updated);
  };

  const handlePatrimonyAdd = () => {
    if (!patrimonyFormType) return;
    const id = Date.now().toString();
    const item = { id, ...patrimonyForm };
    const updated = { ...patrimony, [patrimonyFormType]: [...(patrimony[patrimonyFormType] || []), item] };
    onPatrimonyChange && onPatrimonyChange(updated);
    resetPatrimonyForm({});
    setPatrimonyFormType(null);
    setShowPatrimonyModal(false);
  };

  const renderPatrimonyItemValue = (typeKey, item) => {
    if (typeKey === 'accounts')   return `${parseFloat(item.balance || 0).toFixed(2)}€`;
    if (typeKey === 'stocks')     return `${item.qty}×${parseFloat(item.avgPrice || 0).toFixed(2)}€ = ${(parseFloat(item.qty || 0) * parseFloat(item.avgPrice || 0)).toFixed(2)}€`;
    if (typeKey === 'bonds')      return `${parseFloat(item.value || 0).toFixed(2)}€`;
    if (typeKey === 'realestate') return `${parseFloat(item.value || 0).toFixed(2)}€`;
    if (typeKey === 'vehicles')   return `${parseFloat(item.value || 0).toFixed(2)}€`;
    if (typeKey === 'crypto')     return `${item.qty}×${parseFloat(item.price || 0).toFixed(2)}€ = ${(parseFloat(item.qty || 0) * parseFloat(item.price || 0)).toFixed(2)}€`;
    return '';
  };

  const renderPatrimonyItemLabel = (typeKey, item) => {
    if (typeKey === 'accounts')   return `${item.name}${item.bank ? ' · ' + item.bank : ''}`;
    if (typeKey === 'stocks')     return item.ticker;
    if (typeKey === 'bonds')      return `${item.series || 'Série'}${item.date ? ' · ' + item.date : ''}`;
    if (typeKey === 'realestate') return item.description;
    if (typeKey === 'vehicles')   return item.description;
    if (typeKey === 'crypto')     return item.coin;
    return '';
  };

  const renderPatrimonyForm = () => {
    const f   = patrimonyForm;                           // draft from useForm
    const set = (k, v) => setPatrimonyField(k, v);      // onChange → local draft only
    const cls = 'patrimony-input';
    switch (patrimonyFormType) {
      case 'accounts':
        return (<>
          <input className={cls} placeholder="Nome da conta"    value={f.name    || ''} onChange={e => set('name',    e.target.value)} />
          <input className={cls} placeholder="Banco (opcional)" value={f.bank    || ''} onChange={e => set('bank',    e.target.value)} />
          <input className={cls} type="number" inputMode="decimal" placeholder="Saldo (€)" value={f.balance || ''} onChange={e => set('balance', e.target.value)} />
        </>);
      case 'stocks':
        return (<>
          <input className={cls} placeholder="Ticker (ex: AAPL)"  value={f.ticker   || ''} onChange={e => set('ticker',   e.target.value)} />
          <input className={cls} type="number" inputMode="decimal" placeholder="Quantidade"     value={f.qty      || ''} onChange={e => set('qty',      e.target.value)} />
          <input className={cls} type="number" inputMode="decimal" placeholder="Preço médio (€)" value={f.avgPrice || ''} onChange={e => set('avgPrice', e.target.value)} />
        </>);
      case 'bonds':
        return (<>
          <input className={cls} placeholder="Série (ex: E)"       value={f.series || ''} onChange={e => set('series', e.target.value)} />
          <input className={cls} type="number" inputMode="decimal" placeholder="Valor actual (€)" value={f.value  || ''} onChange={e => set('value',  e.target.value)} />
          <input className={cls} type="date" value={f.date || ''} onChange={e => set('date', e.target.value)} />
        </>);
      case 'realestate':
        return (<>
          <input className={cls} placeholder="Descrição (ex: Apartamento Lisboa)" value={f.description || ''} onChange={e => set('description', e.target.value)} />
          <input className={cls} type="number" inputMode="decimal" placeholder="Valor estimado (€)" value={f.value || ''} onChange={e => set('value', e.target.value)} />
        </>);
      case 'vehicles':
        return (<>
          <input className={cls} placeholder="Descrição (ex: BMW X3 2020)" value={f.description || ''} onChange={e => set('description', e.target.value)} />
          <input className={cls} type="number" inputMode="decimal" placeholder="Valor estimado (€)" value={f.value || ''} onChange={e => set('value', e.target.value)} />
        </>);
      case 'crypto':
        return (<>
          <input className={cls} placeholder="Moeda (ex: BTC)" value={f.coin  || ''} onChange={e => set('coin',  e.target.value)} />
          <input className={cls} type="number" inputMode="decimal" placeholder="Quantidade"       value={f.qty   || ''} onChange={e => set('qty',   e.target.value)} />
          <input className={cls} type="number" inputMode="decimal" placeholder="Preço unitário (€)" value={f.price || ''} onChange={e => set('price', e.target.value)} />
        </>);
      default: return null;
    }
  };

  /* ── shared modals — called as {renderModals()}, NOT as <Modals />.
     Defining a component inside a component gives it a new type every render
     → React unmounts+remounts the subtree → inputs lose focus.            */
  const renderModals = () => {
    return (
    <>
      {editingGoalId && (
        <Overlay onClose={() => { setEditingGoalId(null); resetGoal(EMPTY_GOAL); }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h4>Novo Objetivo</h4>
              <button className="modal-close" onClick={() => { setEditingGoalId(null); resetGoal(EMPTY_GOAL); }}>×</button>
            </div>
            <div className="goal-form">
              <input type="text"   className="goal-input" placeholder="Nome do objetivo"
                value={newGoal.name}       onChange={(e) => setGoalField('name',       e.target.value)} />
              <input type="number" className="goal-input" placeholder="Valor (€)"
                value={newGoal.amount || ''} onChange={(e) => setGoalField('amount',     e.target.value)} />
              <div className="date-input-wrapper">
                <input type="date" className="goal-input date-input"
                  value={newGoal.targetDate} onChange={(e) => setGoalField('targetDate', e.target.value)} />
                <span className="calendar-icon">◷</span>
              </div>
              <button className="btn-add-goal" onClick={() => { handleAddGoal(); setEditingGoalId(null); }}>Adicionar</button>
            </div>
          </div>
        </Overlay>
      )}

      {showPatrimonyModal && (
        <Overlay onClose={() => { setShowPatrimonyModal(false); setPatrimonyFormType(null); resetPatrimonyForm({}); }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h4>{patrimonyFormType ? PATRIMONY_TYPES.find(t => t.key === patrimonyFormType)?.label : 'Adicionar Activo'}</h4>
              <button className="modal-close" onClick={() => { setShowPatrimonyModal(false); setPatrimonyFormType(null); resetPatrimonyForm({}); }}>×</button>
            </div>
            {!patrimonyFormType ? (
              <div className="patrimony-type-selector">
                {PATRIMONY_TYPES.map(({ key, label, icon, color }) => (
                  <button key={key} className="patrimony-type-btn" onClick={() => { setPatrimonyFormType(key); resetPatrimonyForm({}); }}>
                    <span style={{ color, fontSize: '1.5rem' }}>{icon}</span>
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="patrimony-form">
                {renderPatrimonyForm()}
                <div className="patrimony-form-actions">
                  <button className="btn-patrimony-back" onClick={() => { setPatrimonyFormType(null); resetPatrimonyForm({}); }}>← Voltar</button>
                  <button className="btn-add-patrimony" onClick={handlePatrimonyAdd}>Adicionar</button>
                </div>
              </div>
            )}
          </div>
        </Overlay>
      )}

    </>
    );
  };

  /* ── MODERN / FINTECH BRANCH ──────────────────────────────────────────── */
  if (theme === 'modern' || theme === 'fintech') {
    const totalBudget = Object.values(budgets).reduce((s, v) => s + (v || 0), 0);
    const totalSpent  = categories.expense.reduce((s, cat) => s + getSpentByCategory(cat.id), 0);
    const isTotalOver = totalBudget > 0 && totalSpent > totalBudget;

    return (
      <div className="m-budget-page">
        {/* View toggle */}
        <div className="m-toggle">
          <button className={`m-toggle-btn ${activeView === 'budgets'   ? 'active' : ''}`} onClick={() => setActiveView('budgets')}>Orçamentos</button>
          <button className={`m-toggle-btn ${activeView === 'goals'     ? 'active' : ''}`} onClick={() => setActiveView('goals')}>Objetivos</button>
          <button className={`m-toggle-btn ${activeView === 'patrimony' ? 'active' : ''}`} onClick={() => setActiveView('patrimony')}>Património</button>
        </div>

        {/* ── BUDGETS ── */}
        {activeView === 'budgets' && (
          <>
            {/* Month navigation */}
            <div className="m-month-nav">
              <button className="m-month-nav-btn" onClick={() => setSelectedMonth(shiftMonth(selectedMonth, -1))}>‹</button>
              <div className="m-month-nav-center">
                <span className="m-month-nav-label">{formatMonthLabel(selectedMonth)}</span>
                {selectedMonth !== currentMonth && (
                  <button className="m-month-nav-today" onClick={() => setSelectedMonth(currentMonth)}>Este mês</button>
                )}
              </div>
              <button className="m-month-nav-btn" onClick={() => setSelectedMonth(shiftMonth(selectedMonth, 1))}>›</button>
            </div>

            {/* Main summary card */}
            {(() => {
              const remaining = totalBudget - totalSpent;
              const totalPct  = totalBudget > 0 ? Math.min((totalSpent / totalBudget) * 100, 100) : 0;
              const barColor  = isTotalOver ? '#dc2626' : totalPct >= 70 ? '#F59E0B' : '#10B981';
              return (
                <div className="m-bmc">
                  <span className="m-bmc-label">Orçamento mensal</span>
                  <div className="m-bmc-big">
                    <span className="m-bmc-amount" style={{ color: isTotalOver ? '#dc2626' : undefined }}>
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
                      <span className="m-bmc-col-val" style={{ color: isTotalOver ? '#dc2626' : undefined }}>
                        <CountUp value={totalSpent} />€
                      </span>
                      <span className="m-bmc-col-label">Gasto</span>
                    </div>
                  </div>
                  {totalBudget > 0 && (
                    <div className="m-bmc-bar-bg">
                      <div className="m-bmc-bar-fill" style={{ width: animated ? `${totalPct}%` : '0%', background: barColor }} />
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Category cards */}
            <div className="m-bcc-list">
              {sortedItems.map(({ cat, limit, spent, percent, delta, predicted }) => (
                <BudgetCategoryCard
                  key={`${cat.id}-${Math.round(percent)}`}
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
                />
              ))}
            </div>
          </>
        )}

        {/* ── GOALS ── */}
        {activeView === 'goals' && (
          <div className="m-list">
            {goals.length === 0 ? (
              <div className="m-empty">Sem objetivos criados</div>
            ) : (
              goals.map(goal => {
                const progress  = goal.amount > 0 ? Math.min((goal.currentSavings / goal.amount) * 100, 100) : 0;
                const remaining = goal.amount - (goal.currentSavings || 0);
                return (
                  <div key={goal.id} className="m-goal-row">
                    <div className="m-goal-top">
                      <span className="m-goal-name">{goal.name}</span>
                      <button className="m-goal-del" onClick={() => handleDeleteGoal(goal.id)}>🗑</button>
                    </div>
                    <div className="m-goal-bar-bg">
                      <div className="m-goal-bar-fill" style={{ width: `${progress}%` }} />
                    </div>
                    <div className="m-goal-meta">
                      <span><strong>{(goal.currentSavings || 0).toFixed(0)}€</strong> / {goal.amount.toFixed(0)}€</span>
                      <span>{progress.toFixed(0)}%{remaining > 0 ? ` · faltam ${remaining.toFixed(0)}€` : ' ✓'}</span>
                    </div>
                    <div className="m-goal-input-row">
                      <span className="m-goal-input-label">Poupado</span>
                      <GoalSavingsInput
                        key={goal.id}
                        goal={goal}
                        onSave={handleUpdateGoalSavings}
                        className="m-goal-savings-input"
                      />
                      <span className="m-budget-unit">€</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ── PATRIMONY ── */}
        {activeView === 'patrimony' && (
          <>
            <div className="m-patrimony-total">
              <span className="m-patrimony-total-label">Património Total</span>
              <span className="m-patrimony-total-val">
                {totalPatrimony.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€
              </span>
            </div>
            {PATRIMONY_TYPES.map(({ key, label, icon, color }) => {
              const items     = patrimony[key] || [];
              const typeTotal = getPatrimonyTypeValue(key);
              return (
                <Card key={key} className="m-asset-type">
                  <div className="m-asset-type-header">
                    <Bubble color={color} icon={icon} size={36} />
                    <span className="m-asset-type-name">{label}</span>
                    <span className="m-asset-type-val">{typeTotal.toFixed(0)}€</span>
                  </div>
                  {items.map(item => (
                    <div key={item.id} className="m-asset-item">
                      <span className="m-asset-item-name">{renderPatrimonyItemLabel(key, item)}</span>
                      <span className="m-asset-item-val">{renderPatrimonyItemValue(key, item)}</span>
                      <button className="m-asset-item-del" onClick={() => handlePatrimonyDelete(key, item.id)}>×</button>
                    </div>
                  ))}
                  {items.length === 0 && <div className="m-asset-empty">Sem registos</div>}
                </Card>
              );
            })}
          </>
        )}

        {/* FAB */}
        {(activeView === 'goals' || activeView === 'patrimony') && (
          <button
            className="m-fab"
            onClick={() => { if (activeView === 'goals') setEditingGoalId('new'); else setShowPatrimonyModal(true); }}
          >+</button>
        )}

        {renderModals()}
      </div>
    );
  }

  /* ── DEFAULT BRANCH ──────────────────────────────────────────────────── */
  return (
    <div className="budget-tab">
      <div className="budget-header">
        <h2>Orçamento</h2>
        <p>Gestão financeira</p>
      </div>

      <div className="view-toggle view-toggle-3">
        <button className={`toggle-btn ${activeView === 'budgets' ? 'active' : ''}`} onClick={() => setActiveView('budgets')}>
          <span className="sf-icon">◈</span><span>Orçamentos</span>
        </button>
        <button className={`toggle-btn ${activeView === 'goals' ? 'active' : ''}`} onClick={() => setActiveView('goals')}>
          <span className="sf-icon">◆</span><span>Objetivos</span>
        </button>
        <button className={`toggle-btn ${activeView === 'patrimony' ? 'active' : ''}`} onClick={() => setActiveView('patrimony')}>
          <span className="sf-icon">◭</span><span>Património</span>
        </button>
      </div>

      {activeView === 'budgets' && (
        <div className="budgets-section">
          <h3>Limites Mensais</h3>
          {(() => {
            const totalBudget = Object.values(budgets).reduce((sum, val) => sum + (val || 0), 0);
            const totalSpent = categories.expense.reduce((sum, cat) => sum + getSpentByCategory(cat.id), 0);
            const totalPercentage = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;
            return (
              <div className="budget-total-card">
                <div className="total-row"><span className="total-label">Orçamento Total</span><span className="total-amount">{totalBudget.toFixed(2)}€</span></div>
                <div className="total-row"><span className="total-label">Gasto Total</span><span className={`total-amount ${totalSpent > totalBudget ? 'over' : ''}`}>{totalSpent.toFixed(2)}€</span></div>
                <div className="total-progress-bar"><div className={`total-progress-fill ${totalSpent > totalBudget ? 'over' : ''}`} style={{ width: `${Math.min(totalPercentage, 100)}%` }} /></div>
                <div className="total-percentage">{totalPercentage.toFixed(0)}% utilizado</div>
              </div>
            );
          })()}
          <div className="categories-budgets">
            {categories.expense
              .map(cat => {
                const limit = budgets[cat.id] || 0;
                const spent = getSpentByCategory(cat.id);
                const hasLimit = limit > 0;
                const percent = hasLimit ? (spent / limit) * 100 : 0;
                const barWidth = Math.min(percent, 100);
                const colorClass = percent > 100 ? 'over' : percent >= 70 ? 'warn' : '';
                return { cat, limit, spent, hasLimit, percent, barWidth, colorClass };
              })
              .sort((a, b) => b.percent - a.percent)
              .map(({ cat, limit, spent, hasLimit, percent, barWidth, colorClass }) => (
                <div key={cat.id} className="budget-category">
                  <div className="category-header">
                    <span className="category-icon">{getCategoryIcon(cat.label)}</span>
                    <span className="category-name">{cat.label}</span>
                    {percent >= 100 && <span className="budget-alert over">Excedido</span>}
                    {percent >= 80 && percent < 100 && <span className="budget-alert warn">Atenção</span>}
                  </div>
                  <div className="budget-input-row">
                    <input type="number" inputMode="decimal" className="budget-input" value={limit || ''} onChange={(e) => handleLimitChange(cat.id, e.target.value)} onKeyPress={(e) => { if (e.key === 'Enter') { saveBudgetToDb(); e.target.blur(); } }} placeholder="0" step="10" min="0" />
                    <span className="budget-currency">€/mês</span>
                    <button className="budget-save-btn" onClick={saveBudgetToDb} title="Guardar">✓</button>
                  </div>
                  {hasLimit && (
                    <div className="budget-progress-container">
                      <div className="budget-bar"><div className={`budget-fill ${colorClass}`} style={{ width: `${barWidth}%` }} /></div>
                      <div className="budget-stats">
                        <span className={`spent ${colorClass}`}>{spent.toFixed(2)}€</span>
                        <span className="separator">/</span>
                        <span className="limit">{limit.toFixed(2)}€</span>
                        <span className={`percentage ${colorClass}`}>({percent.toFixed(0)}%)</span>
                      </div>
                    </div>
                  )}
                </div>
              ))
            }
          </div>
        </div>
      )}

      {activeView === 'goals' && (
        <div className="goals-section">
          <h3>Meus Objetivos</h3>
          {goals.length === 0 ? (
            <div className="empty-state"><span className="sf-icon-large">◆</span><p>Sem objetivos criados</p></div>
          ) : (
            <div className="goals-list">
              {goals.map(goal => {
                const progress = goal.amount > 0 ? (goal.currentSavings / goal.amount) * 100 : 0;
                const remaining = goal.amount - goal.currentSavings;
                let daysRemaining = null;
                if (goal.targetDate) {
                  daysRemaining = Math.ceil((new Date(goal.targetDate) - new Date()) / (1000 * 60 * 60 * 24));
                }
                return (
                  <div key={goal.id} className="goal-card">
                    <div className="goal-header-row">
                      <h4>{goal.name}</h4>
                      <button className="btn-delete-goal" onClick={() => handleDeleteGoal(goal.id)} title="Apagar">🗑️</button>
                    </div>
                    <div className="goal-meta">
                      <div className="meta-item"><span className="meta-label">Meta</span><span className="meta-value">{goal.amount.toFixed(0)}€</span></div>
                      {goal.targetDate && (
                        <div className="meta-item"><span className="meta-label">Data</span><span className="meta-value">{new Date(goal.targetDate).toLocaleDateString('pt-PT', { day: 'numeric', month: 'short', year: 'numeric' })}</span></div>
                      )}
                    </div>
                    <div className="goal-progress">
                      <div className="progress-bar-container"><div className="progress-bar-fill" style={{ width: `${Math.min(progress, 100)}%` }} /></div>
                      <div className="progress-text"><span>{goal.currentSavings.toFixed(0)}€</span><span className="progress-percent">{progress.toFixed(0)}%</span></div>
                    </div>
                    {daysRemaining !== null && daysRemaining > 0 && (
                      <div className="goal-days"><span className="sf-icon">☀︎</span><span>{daysRemaining} dias restantes</span></div>
                    )}
                    <div className="savings-input-row">
                      <label>Poupado</label>
                      <div className="input-group">
                        <GoalSavingsInput
                          key={goal.id}
                          goal={goal}
                          onSave={handleUpdateGoalSavings}
                        />
                        <span>€</span>
                      </div>
                    </div>
                    {remaining > 0 && <div className="goal-remaining">Faltam <strong>{remaining.toFixed(0)}€</strong></div>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeView === 'patrimony' && (
        <div className="patrimony-section">
          <div className="patrimony-total-card">
            <div className="patrimony-total-label">Património Total</div>
            <div className="patrimony-total-amount">{totalPatrimony.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€</div>
          </div>
          <div className="patrimony-types-list">
            {PATRIMONY_TYPES.map(({ key, label, icon, color }) => {
              const items = patrimony[key] || [];
              const typeTotal = getPatrimonyTypeValue(key);
              return (
                <div key={key} className="patrimony-type-card">
                  <div className="patrimony-type-header">
                    <div className="patrimony-type-left">
                      <span className="patrimony-type-icon" style={{ color }}>{icon}</span>
                      <span className="patrimony-type-label">{label}</span>
                    </div>
                    <span className="patrimony-type-total">{typeTotal.toFixed(2)}€</span>
                  </div>
                  {items.length > 0 && (
                    <div className="patrimony-items-list">
                      {items.map(item => (
                        <div key={item.id} className="patrimony-item">
                          <div className="patrimony-item-info">
                            <span className="patrimony-item-name">{renderPatrimonyItemLabel(key, item)}</span>
                            <span className="patrimony-item-value">{renderPatrimonyItemValue(key, item)}</span>
                          </div>
                          <button className="patrimony-item-delete" onClick={() => handlePatrimonyDelete(key, item.id)}>×</button>
                        </div>
                      ))}
                    </div>
                  )}
                  {items.length === 0 && <div className="patrimony-empty-type">Sem registos</div>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {(activeView === 'goals' || activeView === 'patrimony') && (
        <button
          className="floating-add-btn"
          onClick={() => { if (activeView === 'goals') setEditingGoalId('new'); else setShowPatrimonyModal(true); }}
          title="Adicionar"
        >
          +
        </button>
      )}

      {renderModals()}
    </div>
  );
};

export default BudgetTab;
