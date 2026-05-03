import React, { useState } from 'react';
import CategoryPicker from './CategoryPicker';
import './FintechTransactionCard.css';

/* ── Icon map ─────────────────────────────────────────────────────────────── */
const CAT_ICON = {
  'Alimentação':              { e: '🛒', bg: 'rgba(249,115,22,0.12)', c: '#ea580c' },
  'Habitação':                { e: '🏠', bg: 'rgba(59,130,246,0.12)',  c: '#2563eb' },
  'Transporte':               { e: '🚗', bg: 'rgba(234,179,8,0.12)',   c: '#ca8a04' },
  'Saúde':                    { e: '❤️', bg: 'rgba(239,68,68,0.12)',   c: '#dc2626' },
  'Lazer':                    { e: '🎉', bg: 'rgba(168,85,247,0.12)',  c: '#9333ea' },
  'Lazer & Entretenimento':   { e: '🎬', bg: 'rgba(168,85,247,0.12)',  c: '#9333ea' },
  'Educação':                 { e: '📚', bg: 'rgba(99,102,241,0.12)',  c: '#6366f1' },
  'Roupa':                    { e: '👕', bg: 'rgba(236,72,153,0.12)',  c: '#db2777' },
  'Roupa & Calçado':          { e: '👟', bg: 'rgba(236,72,153,0.12)',  c: '#db2777' },
  'Tecnologia':               { e: '💻', bg: 'rgba(99,102,241,0.12)',  c: '#6366f1' },
  'Subscrições':              { e: '📱', bg: 'rgba(99,102,241,0.12)',  c: '#6366f1' },
  'Comunicações':             { e: '📡', bg: 'rgba(14,165,233,0.12)',  c: '#0284c7' },
  'Utilities':                { e: '⚡', bg: 'rgba(234,179,8,0.12)',   c: '#ca8a04' },
  'Serviços Financeiros':     { e: '🏦', bg: 'rgba(99,102,241,0.12)',  c: '#6366f1' },
  'Viagens & Férias':         { e: '✈️', bg: 'rgba(14,165,233,0.12)',  c: '#0284c7' },
  'Presentes & Doações':      { e: '🎁', bg: 'rgba(236,72,153,0.12)',  c: '#db2777' },
  'Animais de Estimação':     { e: '🐾', bg: 'rgba(234,179,8,0.12)',   c: '#ca8a04' },
  'Crianças & Família':       { e: '👶', bg: 'rgba(236,72,153,0.12)',  c: '#db2777' },
  'Cuidados Pessoais':        { e: '💆', bg: 'rgba(168,85,247,0.12)',  c: '#9333ea' },
  'Casa & Jardim':            { e: '🌿', bg: 'rgba(34,197,94,0.12)',   c: '#16a34a' },
  'Impostos & Taxas':         { e: '📋', bg: 'rgba(239,68,68,0.12)',   c: '#dc2626' },
  'Emergências':              { e: '🚨', bg: 'rgba(239,68,68,0.12)',   c: '#dc2626' },
  'Outros':                   { e: '💳', bg: 'rgba(156,163,175,0.12)', c: '#6b7280' },
  'Salário':                  { e: '💰', bg: 'rgba(34,197,94,0.12)',   c: '#16a34a' },
  'Salário Principal':        { e: '💰', bg: 'rgba(34,197,94,0.12)',   c: '#16a34a' },
  'Subsídios':                { e: '📩', bg: 'rgba(34,197,94,0.12)',   c: '#16a34a' },
  'Freelance':                { e: '💼', bg: 'rgba(34,197,94,0.12)',   c: '#16a34a' },
  'Trabalho Extra / Freelance':{ e: '💼', bg: 'rgba(34,197,94,0.12)', c: '#16a34a' },
  'Investimentos':            { e: '📈', bg: 'rgba(34,197,94,0.12)',   c: '#16a34a' },
  'Rendas Recebidas':         { e: '🏘️', bg: 'rgba(34,197,94,0.12)',  c: '#16a34a' },
  'Reembolsos':               { e: '↩️', bg: 'rgba(34,197,94,0.12)',  c: '#16a34a' },
  'Vendas':                   { e: '🏷️', bg: 'rgba(34,197,94,0.12)', c: '#16a34a' },
  'Prémios & Sorteios':       { e: '🏆', bg: 'rgba(34,197,94,0.12)',  c: '#16a34a' },
  'Prendas & Doações Recebidas':{ e: '🎁', bg: 'rgba(34,197,94,0.12)',c: '#16a34a' },
  'Bonus':                    { e: '🎯', bg: 'rgba(34,197,94,0.12)',   c: '#16a34a' },
  'Outros Rendimentos':       { e: '💵', bg: 'rgba(34,197,94,0.12)',   c: '#16a34a' },
};

const TRANSFER_ICON = { e: '↔', bg: 'rgba(99,102,241,0.1)', c: '#6366f1' };
const ADJUST_ICON   = { e: '⚖', bg: 'rgba(249,115,22,0.1)', c: '#ea580c' };

function getIcon(cat, type) {
  return CAT_ICON[cat] ||
    (type === 'income'
      ? { e: '💰', bg: 'rgba(34,197,94,0.12)',   c: '#16a34a' }
      : { e: '💳', bg: 'rgba(156,163,175,0.12)', c: '#6b7280' });
}

/* ── Transfer flow helper ─────────────────────────────────────────────────── */
function getTransferFlow(tx) {
  const desc = (tx.description || '').trim();
  const toMatch   = desc.match(/^Transferência para (.+)$/i);
  const fromMatch = desc.match(/^Transferência de (.+)$/i);
  if (toMatch)   return `${tx.category} → ${toMatch[1]}`;
  if (fromMatch) return `${fromMatch[1]} → ${tx.category}`;
  return desc || tx.category || 'Transferência';
}

/* ── Date formatting ─────────────────────────────────────────────────────── */
function formatShort(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr.length === 10 ? dateStr + 'T00:00:00' : dateStr);
  return d.toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' });
}

function formatLong(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr.length === 10 ? dateStr + 'T00:00:00' : dateStr);
  return d.toLocaleDateString('pt-PT', { day: 'numeric', month: 'long', year: 'numeric' });
}

/* ── Component ────────────────────────────────────────────────────────────── */
const FintechTransactionCard = ({ tx, onCategoryChange, onDelete }) => {
  const [open,     setOpen]    = useState(false);
  const [pickerTx, setPickerTx] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const isTransfer   = tx.type === 'transfer';
  const isAdjustment = tx.type === 'adjustment';
  const isIncome     = tx.type === 'income';

  const icon   = isTransfer   ? TRANSFER_ICON
               : isAdjustment ? ADJUST_ICON
               : getIcon(tx.category, tx.type);

  const title = isTransfer
    ? getTransferFlow(tx)
    : (tx.description || tx.category || '—');

  // Secondary label — for transfers use the full description as subtext
  const subtitle = isTransfer ? `De ${tx.category}` : tx.category;

  const amount    = parseFloat(tx.amount || 0);
  const amountStr = isTransfer
    ? `${amount.toFixed(2)}€`
    : `${isIncome ? '+' : '−'}${amount.toFixed(2)}€`;

  const handlePickerSelect = (newCategory) => {
    if (pickerTx && onCategoryChange) {
      onCategoryChange(pickerTx.id, newCategory, pickerTx.description);
    }
    setPickerTx(null);
    setOpen(false);
  };

  const handleDelete = async (e) => {
    e.stopPropagation();
    if (!window.confirm('Apagar esta transação?')) return;
    setDeleting(true);
    try {
      if (onDelete) await onDelete(tx.id);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <div className="ftc-card" onClick={() => setOpen(o => !o)}>
        {/* ── Main row ── */}
        <div className="ftc-row">
          {/* Icon bubble */}
          <div className="ftc-icon-wrap" style={{ background: icon.bg }}>
            <span className="ftc-icon" style={{ color: icon.c }}>{icon.e}</span>
          </div>

          {/* Body */}
          <div className="ftc-body">
            <span className="ftc-title">{title}</span>
            <span className="ftc-sub">
              {isTransfer ? (
                <span className="ftc-badge ftc-badge--transfer">↔ Transferência</span>
              ) : isAdjustment ? (
                <span className="ftc-badge ftc-badge--adjust">⚖ Ajuste</span>
              ) : (
                <span className="ftc-cat">{tx.category}</span>
              )}
            </span>
          </div>

          {/* Right: amount + date */}
          <div className="ftc-right">
            <span className={`ftc-amt ${isTransfer ? 'ftc-amt--neutral' : isIncome ? 'ftc-amt--income' : 'ftc-amt--expense'}`}>
              {amountStr}
            </span>
            <span className="ftc-date">{formatShort(tx.date)}</span>
          </div>
        </div>

        {/* ── Expanded actions ── */}
        {open && (
          <div className="ftc-actions" onClick={e => e.stopPropagation()}>
            <span className="ftc-action-date">{formatLong(tx.date)}</span>
            <div className="ftc-action-btns">
              {onCategoryChange && !isTransfer && !isAdjustment && (
                <button
                  className="ftc-action-btn"
                  onClick={() => setPickerTx(tx)}
                >
                  ✎ Categoria
                </button>
              )}
              {onDelete && (
                <button
                  className="ftc-action-btn ftc-action-btn--danger"
                  onClick={handleDelete}
                  disabled={deleting}
                >
                  {deleting ? '⏳' : '🗑 Apagar'}
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {pickerTx && (
        <CategoryPicker
          transaction={pickerTx}
          onSelect={handlePickerSelect}
          onClose={() => setPickerTx(null)}
        />
      )}
    </>
  );
};

export default FintechTransactionCard;
