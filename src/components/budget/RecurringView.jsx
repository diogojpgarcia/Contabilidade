import React, { useState } from 'react';
import Overlay from '../Overlay';
import SwipeRevealCard from '../SwipeRevealCard';
import RecurringCalendar from './RecurringCalendar';
import { useAppContext } from '../../context/AppContext';
import { Repeat, Calendar } from '../icons';
import { CategoryIconBubble } from '../../utils/categoryIcons';
import {
  safeNum,
  computeNextDueDate,
  getTotalMonthlyCommitted,
  relativeDueDate,
  shortDate,
  FREQ_LABELS,
  FREQ_OPTIONS,
  PAYMENT_TYPE_LABELS,
  getPendingConfirmations,
} from '../../utils/recurringPayments';
import './Recurring.css';

const EMPTY_FORM = {
  title:           '',
  amount:          '',
  estimatedAmount: '',
  paymentType:     'fixed',
  categoryId:      '',
  accountId:       '',
  frequency:       'monthly',
  customDays:      '',
  startDate:       new Date().toISOString().split('T')[0],
  notes:           '',
  active:          true,
};

function genId() {
  return `rp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

const RecurringView = ({
  recurringPayments,
  onRecurringPaymentsChange,
  confirmedRecurring = {},
  onConfirmRecurring,
  patrimony,
}) => {
  const { categories } = useAppContext();
  const [showForm,          setShowForm]          = useState(false);
  const [showCalendar,      setShowCalendar]      = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showAccountModal,  setShowAccountModal]  = useState(false);
  const [editingId,         setEditingId]         = useState(null);
  const [form,              setForm]              = useState(EMPTY_FORM);
  const [confirmDeleteId,   setConfirmDeleteId]   = useState(null);

  // Confirm payment modal
  const [confirmTarget,    setConfirmTarget]    = useState(null); // { payment, dueDate, monthKey }
  const [confirmAmount,    setConfirmAmount]    = useState('');
  const [confirmAccountId, setConfirmAccountId] = useState('');
  const [confirming,       setConfirming]       = useState(false);

  const payments = recurringPayments || [];
  const totalMonthly = getTotalMonthlyCommitted(payments);
  const accounts     = patrimony?.accounts || [];
  const expCats      = categories?.expense || [];

  // ── Helpers ────────────────────────────────────────────────────────────────
  // A persistência no Supabase é feita em useSettings.handleRecurringPaymentsChange.
  const persist = (updated) => onRecurringPaymentsChange(updated);

  const openAdd = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, startDate: new Date().toISOString().split('T')[0] });
    setShowForm(true);
  };

  const openEdit = (p) => {
    setEditingId(p.id);
    setForm({
      title:           p.title           || '',
      amount:          p.amount          != null ? String(p.amount) : '',
      estimatedAmount: p.estimatedAmount != null ? String(p.estimatedAmount) : '',
      paymentType:     p.paymentType     || 'fixed',
      categoryId:      p.categoryId      || '',
      accountId:       p.accountId       || '',
      frequency:       p.frequency       || 'monthly',
      customDays:      p.customDays      != null ? String(p.customDays) : '',
      startDate:       p.startDate       || new Date().toISOString().split('T')[0],
      notes:           p.notes           || '',
      active:          p.active !== false,
    });
    setShowForm(true);
  };

  const handleDelete = (id) => {
    persist(payments.filter(p => p.id !== id));
    setConfirmDeleteId(null);
  };

  const handleSave = () => {
    const title  = form.title.trim();
    const amount = safeNum(form.amount);
    if (!title || amount <= 0) return;

    const entry = {
      id:              editingId || genId(),
      title,
      amount,
      paymentType:     form.paymentType || 'fixed',
      estimatedAmount: form.paymentType === 'variable' ? safeNum(form.estimatedAmount) || amount : null,
      categoryId:      form.categoryId || '',
      accountId:       form.accountId  || '',
      frequency:       form.frequency,
      customDays:      form.frequency === 'custom' ? safeNum(form.customDays) || 30 : null,
      startDate:       form.startDate,
      notes:           form.notes.trim(),
      active:          true,
    };

    const updated = editingId
      ? payments.map(p => p.id === editingId ? entry : p)
      : [...payments, entry];

    persist(updated);
    setShowForm(false);
  };

  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // ── Category + account label helpers ──────────────────────────────────────
  const catLabel = (p) =>
    expCats.find(c => c.id === p.categoryId)?.label || p.categoryId || '';

  const dueClass = (due) => {
    const today = new Date().toISOString().split('T')[0];
    if (due === today) return 'today';
    const diff = Math.round((new Date(due + 'T00:00:00') - new Date(today + 'T00:00:00')) / 86400000);
    if (diff <= 3) return 'soon';
    return '';
  };

  const canSave = form.title.trim().length > 0 && safeNum(form.amount) > 0;

  // ── Confirm payment handlers ───────────────────────────────────────────────
  const openConfirm = (payment, dueDate, monthKey) => {
    const prefill = payment.paymentType === 'fixed'
      ? String(payment.amount)
      : (payment.estimatedAmount ? String(payment.estimatedAmount) : '');
    setConfirmTarget({ payment, dueDate, monthKey });
    setConfirmAmount(prefill);
    setConfirmAccountId(payment.accountId || '');
  };

  const handleConfirmSave = async () => {
    if (!confirmTarget || !onConfirmRecurring) return;
    const amount = safeNum(confirmAmount);
    if (amount <= 0) return;
    setConfirming(true);
    try {
      await onConfirmRecurring({
        recurringPayment: confirmTarget.payment,
        dueDate:          confirmTarget.dueDate,
        monthKey:         confirmTarget.monthKey,
        amount,
        accountId:        confirmAccountId || confirmTarget.payment.accountId || null,
      });
      setConfirmTarget(null);
    } finally {
      setConfirming(false);
    }
  };

  const pendingConfirmations = getPendingConfirmations(payments, confirmedRecurring);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Summary card */}
      <div className="rp-summary">
        <span className="rp-summary-icon"><Repeat size={20} strokeWidth={1.75} /></span>
        <div className="rp-summary-body">
          <div className="rp-summary-amount">{totalMonthly.toFixed(2)}€</div>
          <div className="rp-summary-label">comprometido / mês</div>
        </div>
        {payments.length > 0 && (
          <span className="rp-summary-count">{payments.length} pagamento{payments.length !== 1 ? 's' : ''}</span>
        )}
      </div>

      {/* Calendar button */}
      <button className="rp-cal-btn" onClick={() => setShowCalendar(true)}>
        <span className="rp-cal-btn-icon"><Calendar size={17} strokeWidth={1.75} /></span>
        <span>Ver calendário</span>
        <span className="rp-cal-btn-chev">›</span>
      </button>

      {/* Pending confirmations */}
      {pendingConfirmations.length > 0 && (
        <div className="rp-pending-section">
          <div className="rp-pending-header">
            <span className="rp-pending-dot" />
            Aguardam confirmação
          </div>
          {pendingConfirmations.map(p => (
            <div key={`${p.id}_${p.monthKey}`} className="rp-pending-row">
              <CategoryIconBubble name={catLabel(p)} type="expense" size={30} radius="8px" />
              <div className="rp-pending-body">
                <div className="rp-pending-title">{p.title}</div>
                <div className="rp-pending-meta">
                  {p.paymentType === 'variable' ? 'Variável' : 'Fixo'}
                  {' · '}
                  <span className="rp-pending-due">{shortDate(p.dueDate)}</span>
                </div>
              </div>
              <div className="rp-pending-right">
                <div className="rp-pending-amount">
                  {p.paymentType === 'variable' && p.estimatedAmount
                    ? `~${safeNum(p.estimatedAmount).toFixed(2)}€`
                    : `${safeNum(p.amount).toFixed(2)}€`}
                </div>
                <button
                  className="rp-confirm-btn"
                  onClick={() => openConfirm(p, p.dueDate, p.monthKey)}
                >
                  Confirmar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Payment list */}
      <div className="rp-list">
        {payments.length === 0 ? (
          <div className="rp-empty">
            Sem pagamentos recorrentes.<br />Toca + para adicionar.
          </div>
        ) : (
          payments.map(p => {
            const nextDue = computeNextDueDate(p);
            const dc      = dueClass(nextDue);
            return (
              <SwipeRevealCard
                key={p.id}
                className="rp-row"
                onEdit={() => openEdit(p)}
                onDelete={() => setConfirmDeleteId(p.id)}
              >
                <CategoryIconBubble name={catLabel(p)} type="expense" size={32} radius="9px" />
                <div className="rp-row-body">
                  <div className="rp-row-title">{p.title}</div>
                  <div className="rp-row-meta">
                    <span className="rp-row-freq">{FREQ_LABELS[p.frequency] || p.frequency}</span>
                    <span className={`rp-row-due${dc ? ` ${dc}` : ''}`}>
                      {shortDate(nextDue)} · {relativeDueDate(nextDue)}
                    </span>
                  </div>
                </div>
                <div className="rp-row-right">
                  <div className="rp-row-amount">{safeNum(p.amount).toFixed(2)}€</div>
                  {catLabel(p) && <div className="rp-row-cat">{catLabel(p)}</div>}
                </div>
              </SwipeRevealCard>
            );
          })
        )}
      </div>

      {/* FAB */}
      <button className="m-fab" onClick={openAdd}>+</button>

      {/* Confirm payment modal */}
      {confirmTarget && (
        <Overlay onClose={() => setConfirmTarget(null)}>
          <div className="rp-form-sheet" onClick={e => e.stopPropagation()}>
            <div className="rp-form-handle" />
            <div className="rp-form-header">
              <span className="rp-form-title">Confirmar Pagamento</span>
              <button className="rp-form-close" onClick={() => setConfirmTarget(null)}>✕</button>
            </div>
            <div className="rp-form-body">
              <div className="rp-confirm-info">
                <strong>{confirmTarget.payment.title}</strong>
                <span>{shortDate(confirmTarget.dueDate)}</span>
              </div>

              <div className="rp-form-field">
                <label className="rp-form-label">
                  {confirmTarget.payment.paymentType === 'variable'
                    ? 'Valor real *'
                    : 'Valor *'}
                </label>
                <input
                  className="rp-form-input"
                  type="number"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={confirmAmount}
                  onChange={e => setConfirmAmount(e.target.value)}
                  step="0.01"
                  min="0.01"
                  autoFocus
                />
              </div>

              {accounts.length > 0 && (
                <div className="rp-form-field">
                  <label className="rp-form-label">Conta</label>
                  <select
                    className="rp-form-input"
                    value={confirmAccountId}
                    onChange={e => setConfirmAccountId(e.target.value)}
                  >
                    <option value="">— Nenhuma —</option>
                    {accounts.map(a => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="rp-form-actions">
                <button className="rp-form-cancel" onClick={() => setConfirmTarget(null)}>
                  Cancelar
                </button>
                <button
                  className="rp-form-save"
                  onClick={handleConfirmSave}
                  disabled={confirming || safeNum(confirmAmount) <= 0}
                >
                  {confirming ? 'A confirmar…' : 'Confirmar pagamento'}
                </button>
              </div>
            </div>
          </div>
        </Overlay>
      )}

      {/* Delete confirmation modal */}
      {confirmDeleteId && (
        <Overlay onClose={() => setConfirmDeleteId(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h4>Apagar pagamento?</h4>
              <button className="modal-close" onClick={() => setConfirmDeleteId(null)}>×</button>
            </div>
            <div className="modal-body" style={{ padding: '0 0 8px' }}>
              <p style={{ marginBottom: 16, color: 'var(--text-secondary)' }}>
                <strong>{payments.find(p => p.id === confirmDeleteId)?.title}</strong> será removido.
              </p>
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  style={{ flex: 1, padding: '10px', borderRadius: '10px', border: '1px solid var(--separator)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.875rem' }}
                  onClick={() => setConfirmDeleteId(null)}
                >Cancelar</button>
                <button
                  style={{ flex: 1, padding: '10px', borderRadius: '10px', border: 'none', background: '#ef4444', color: '#fff', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.875rem', fontWeight: 600 }}
                  onClick={() => handleDelete(confirmDeleteId)}
                >Apagar</button>
              </div>
            </div>
          </div>
        </Overlay>
      )}

      {/* Calendar overlay */}
      {showCalendar && (
        <RecurringCalendar
          recurringPayments={payments}
          onClose={() => setShowCalendar(false)}
        />
      )}

      {/* Add / Edit form */}
      {showForm && (
        <Overlay onClose={() => setShowForm(false)}>
          <div className="rp-form-sheet" onClick={e => e.stopPropagation()}>
            <div className="rp-form-handle" />
            <div className="rp-form-header">
              <span className="rp-form-title">
                {editingId ? 'Editar Pagamento' : 'Novo Pagamento Recorrente'}
              </span>
              <button className="rp-form-close" onClick={() => setShowForm(false)}>✕</button>
            </div>

            <div className="rp-form-body">
              {/* Title */}
              <div className="rp-form-field">
                <label className="rp-form-label">Descrição *</label>
                <input
                  className="rp-form-input"
                  placeholder="Ex: Netflix, Renda, Ginásio…"
                  value={form.title}
                  onChange={e => setField('title', e.target.value)}
                  autoFocus
                />
              </div>

              {/* Payment type */}
              <div className="rp-form-field">
                <label className="rp-form-label">Tipo</label>
                <div className="rp-freq-row">
                  {['fixed', 'variable'].map(t => (
                    <button
                      key={t}
                      className={`rp-freq-btn${form.paymentType === t ? ' active' : ''}`}
                      onClick={() => setField('paymentType', t)}
                    >{PAYMENT_TYPE_LABELS[t]}</button>
                  ))}
                </div>
                {form.paymentType === 'variable' && (
                  <div className="rp-form-hint">
                    O valor varia cada mês — serás pedido para confirmar o valor real quando for devido.
                  </div>
                )}
              </div>

              {/* Amount */}
              <div className="rp-form-field">
                <label className="rp-form-label">
                  {form.paymentType === 'variable' ? 'Valor estimado *' : 'Valor *'}
                </label>
                <input
                  className="rp-form-input"
                  type="number"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={form.amount}
                  onChange={e => setField('amount', e.target.value)}
                  step="0.01"
                  min="0"
                />
              </div>

              {/* Frequency */}
              <div className="rp-form-field">
                <label className="rp-form-label">Frequência</label>
                <div className="rp-freq-row">
                  {FREQ_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      className={`rp-freq-btn${form.frequency === opt.value ? ' active' : ''}`}
                      onClick={() => setField('frequency', opt.value)}
                    >{opt.label}</button>
                  ))}
                </div>
              </div>

              {/* Custom days */}
              {form.frequency === 'custom' && (
                <div className="rp-form-field">
                  <label className="rp-form-label">A cada N dias *</label>
                  <input
                    className="rp-form-input"
                    type="number"
                    inputMode="numeric"
                    placeholder="30"
                    value={form.customDays}
                    onChange={e => setField('customDays', e.target.value)}
                    min="1"
                  />
                </div>
              )}

              {/* Start date */}
              <div className="rp-form-field">
                <label className="rp-form-label">Data de início</label>
                <input
                  className="rp-form-input"
                  type="date"
                  value={form.startDate}
                  onChange={e => setField('startDate', e.target.value)}
                />
              </div>

              {/* Category selector button */}
              {expCats.length > 0 && (
                <div className="rp-form-field">
                  <button
                    className="rp-selector-btn"
                    onClick={() => setShowCategoryModal(true)}
                  >
                    <span className="rp-selector-label">Categoria</span>
                    <span className="rp-selector-value">
                      {form.categoryId && (() => {
                        const cat = expCats.find(c => c.id === form.categoryId);
                        return cat ? (
                          <>
                            <CategoryIconBubble name={cat.label} type="expense" size={22} radius="6px" />
                            {' '}{cat.label}
                          </>
                        ) : '— Nenhuma —';
                      })()}
                      {!form.categoryId && '— Nenhuma —'}
                    </span>
                    <span className="rp-selector-icon">›</span>
                  </button>
                </div>
              )}

              {/* Account selector button */}
              {accounts.length > 0 && (
                <div className="rp-form-field">
                  <button
                    className="rp-selector-btn"
                    onClick={() => setShowAccountModal(true)}
                  >
                    <span className="rp-selector-label">Conta</span>
                    <span className="rp-selector-value">
                      {form.accountId
                        ? accounts.find(a => a.id === form.accountId)?.name
                        : '— Nenhuma —'}
                    </span>
                    <span className="rp-selector-icon">›</span>
                  </button>
                </div>
              )}

              {/* Notes */}
              <div className="rp-form-field">
                <label className="rp-form-label">Notas (opcional)</label>
                <input
                  className="rp-form-input"
                  placeholder="Ex: plano familiar, contrato anual…"
                  value={form.notes}
                  onChange={e => setField('notes', e.target.value)}
                />
              </div>

              {/* Actions */}
              <div className="rp-form-actions">
                <button className="rp-form-cancel" onClick={() => setShowForm(false)}>
                  Cancelar
                </button>
                <button
                  className="rp-form-save"
                  onClick={handleSave}
                  disabled={!canSave}
                >
                  {editingId ? 'Guardar' : 'Adicionar'}
                </button>
              </div>
            </div>

            {/* Category modal */}
            {showCategoryModal && (
              <div className="rp-modal-overlay" onClick={() => setShowCategoryModal(false)}>
                <div className="rp-modal-panel" onClick={e => e.stopPropagation()}>
                  <div className="rp-modal-header">
                    <span>Selecionar Categoria</span>
                    <button className="rp-modal-close" onClick={() => setShowCategoryModal(false)}>✕</button>
                  </div>
                  <div className="rp-modal-list">
                    <button
                      className={`rp-modal-item${!form.categoryId ? ' active' : ''}`}
                      onClick={() => {
                        setField('categoryId', '');
                        setShowCategoryModal(false);
                      }}
                    >
                      — Nenhuma —
                    </button>
                    {expCats.map(cat => (
                      <button
                        key={cat.id}
                        className={`rp-modal-item${form.categoryId === cat.id ? ' active' : ''}`}
                        onClick={() => {
                          setField('categoryId', cat.id);
                          setShowCategoryModal(false);
                        }}
                      >
                        <CategoryIconBubble name={cat.label} type="expense" size={24} radius="6px" />
                        {' '}{cat.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Account modal */}
            {showAccountModal && (
              <div className="rp-modal-overlay" onClick={() => setShowAccountModal(false)}>
                <div className="rp-modal-panel" onClick={e => e.stopPropagation()}>
                  <div className="rp-modal-header">
                    <span>Selecionar Conta</span>
                    <button className="rp-modal-close" onClick={() => setShowAccountModal(false)}>✕</button>
                  </div>
                  <div className="rp-modal-list">
                    <button
                      className={`rp-modal-item${!form.accountId ? ' active' : ''}`}
                      onClick={() => {
                        setField('accountId', '');
                        setShowAccountModal(false);
                      }}
                    >
                      — Nenhuma —
                    </button>
                    {accounts.map(acc => (
                      <button
                        key={acc.id}
                        className={`rp-modal-item${form.accountId === acc.id ? ' active' : ''}`}
                        onClick={() => {
                          setField('accountId', acc.id);
                          setShowAccountModal(false);
                        }}
                      >
                        {acc.name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </Overlay>
      )}
    </>
  );
};

export default RecurringView;
