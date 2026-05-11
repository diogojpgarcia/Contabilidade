import React, { useState } from 'react';
import { dbService } from '../../lib/supabase';
import Overlay from '../Overlay';
import SwipeRevealCard from '../SwipeRevealCard';
import RecurringCalendar from './RecurringCalendar';
import {
  safeNum,
  computeNextDueDate,
  getTotalMonthlyCommitted,
  relativeDueDate,
  shortDate,
  FREQ_LABELS,
  FREQ_OPTIONS,
} from '../../utils/recurringPayments';
import './Recurring.css';

const EMPTY_FORM = {
  title:      '',
  amount:     '',
  categoryId: '',
  accountId:  '',
  frequency:  'monthly',
  customDays: '',
  startDate:  new Date().toISOString().split('T')[0],
  notes:      '',
  active:     true,
};

function genId() {
  return `rp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

const RecurringView = ({
  user,
  recurringPayments,
  onRecurringPaymentsChange,
  categories,
  patrimony,
}) => {
  const [showForm,     setShowForm]     = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [editingId,    setEditingId]    = useState(null);
  const [form,         setForm]         = useState(EMPTY_FORM);
  const [saving,       setSaving]       = useState(false);

  const payments = recurringPayments || [];
  const totalMonthly = getTotalMonthlyCommitted(payments);
  const accounts     = patrimony?.accounts || [];
  const expCats      = categories?.expense || [];

  // ── Helpers ────────────────────────────────────────────────────────────────
  const persist = async (updated) => {
    setSaving(true);
    try {
      await dbService.updateUserSettings(user.id, { recurring_payments: updated });
      onRecurringPaymentsChange(updated);
    } catch (err) {
      console.error('[RecurringView] save error:', err);
      alert('Erro ao guardar: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const openAdd = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, startDate: new Date().toISOString().split('T')[0] });
    setShowForm(true);
  };

  const openEdit = (p) => {
    setEditingId(p.id);
    setForm({
      title:      p.title      || '',
      amount:     p.amount     != null ? String(p.amount) : '',
      categoryId: p.categoryId || '',
      accountId:  p.accountId  || '',
      frequency:  p.frequency  || 'monthly',
      customDays: p.customDays != null ? String(p.customDays) : '',
      startDate:  p.startDate  || new Date().toISOString().split('T')[0],
      notes:      p.notes      || '',
      active:     p.active !== false,
    });
    setShowForm(true);
  };

  const handleDelete = (id) => {
    if (!confirm('Apagar este pagamento recorrente?')) return;
    persist(payments.filter(p => p.id !== id));
  };

  const handleSave = () => {
    const title  = form.title.trim();
    const amount = safeNum(form.amount);
    if (!title || amount <= 0) return;

    const entry = {
      id:         editingId || genId(),
      title,
      amount,
      categoryId: form.categoryId || '',
      accountId:  form.accountId  || '',
      frequency:  form.frequency,
      customDays: form.frequency === 'custom' ? safeNum(form.customDays) || 30 : null,
      startDate:  form.startDate,
      notes:      form.notes.trim(),
      active:     true,
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
  const catIcon  = (p) =>
    expCats.find(c => c.id === p.categoryId)?.icon || '↻';

  const dueClass = (due) => {
    const today = new Date().toISOString().split('T')[0];
    if (due === today) return 'today';
    const diff = Math.round((new Date(due + 'T00:00:00') - new Date(today + 'T00:00:00')) / 86400000);
    if (diff <= 3) return 'soon';
    return '';
  };

  const canSave = form.title.trim().length > 0 && safeNum(form.amount) > 0;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Summary card */}
      <div className="rp-summary">
        <span className="rp-summary-icon">↻</span>
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
        <span className="rp-cal-btn-icon">◫</span>
        <span>Ver calendário</span>
        <span className="rp-cal-btn-chev">›</span>
      </button>

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
                onDelete={() => handleDelete(p.id)}
              >
                <div className="rp-row-icon">{catIcon(p)}</div>
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

              {/* Amount */}
              <div className="rp-form-field">
                <label className="rp-form-label">Valor *</label>
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

              {/* Category */}
              {expCats.length > 0 && (
                <div className="rp-form-field">
                  <label className="rp-form-label">Categoria</label>
                  <div className="rp-cat-chips">
                    {expCats.map(cat => (
                      <button
                        key={cat.id}
                        className={`rp-cat-chip${form.categoryId === cat.id ? ' active' : ''}`}
                        onClick={() => setField('categoryId', form.categoryId === cat.id ? '' : cat.id)}
                      >
                        {cat.icon ? `${cat.icon} ` : ''}{cat.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Account */}
              {accounts.length > 0 && (
                <div className="rp-form-field">
                  <label className="rp-form-label">Conta</label>
                  <select
                    className="rp-form-input"
                    value={form.accountId}
                    onChange={e => setField('accountId', e.target.value)}
                  >
                    <option value="">— Nenhuma —</option>
                    {accounts.map(acc => (
                      <option key={acc.id} value={acc.id}>{acc.name}</option>
                    ))}
                  </select>
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
                  disabled={!canSave || saving}
                >
                  {saving ? 'A guardar…' : editingId ? 'Guardar' : 'Adicionar'}
                </button>
              </div>
            </div>
          </div>
        </Overlay>
      )}
    </>
  );
};

export default RecurringView;
