import React, { useState } from 'react';
import {
  Utensils, Car, ShoppingBag, Receipt, Wallet,
  ArrowRightLeft, Home, Zap, Smartphone, Plane,
  Heart, BookOpen, Shirt, Dumbbell, Gift, Baby,
  PiggyBank, TrendingUp, Briefcase, RefreshCw,
  Tag, Trophy, CreditCard, Scale, Circle,
} from 'lucide-react';
import CategoryPicker from './CategoryPicker';
import './FintechTransactionCard.css';

/* ── Category → icon + color ─────────────────────────────────────────────── */
const CAT_META = {
  /* Expenses */
  'Alimentação':                { Icon: Utensils,      color: '#3B82F6' },
  'Habitação':                  { Icon: Home,          color: '#6366F1' },
  'Transporte':                 { Icon: Car,           color: '#8B5CF6' },
  'Saúde':                      { Icon: Heart,         color: '#EF4444' },
  'Lazer':                      { Icon: Dumbbell,      color: '#A855F7' },
  'Lazer & Entretenimento':     { Icon: Dumbbell,      color: '#A855F7' },
  'Educação':                   { Icon: BookOpen,      color: '#6366F1' },
  'Roupa':                      { Icon: Shirt,         color: '#EC4899' },
  'Roupa & Calçado':            { Icon: Shirt,         color: '#EC4899' },
  'Tecnologia':                 { Icon: Smartphone,    color: '#6366F1' },
  'Subscrições':                { Icon: Smartphone,    color: '#6366F1' },
  'Comunicações':               { Icon: Smartphone,    color: '#0EA5E9' },
  'Utilities':                  { Icon: Zap,           color: '#F59E0B' },
  'Serviços Financeiros':       { Icon: CreditCard,    color: '#6366F1' },
  'Viagens & Férias':           { Icon: Plane,         color: '#0EA5E9' },
  'Presentes & Doações':        { Icon: Gift,          color: '#EC4899' },
  'Animais de Estimação':       { Icon: Heart,         color: '#F59E0B' },
  'Crianças & Família':         { Icon: Baby,          color: '#EC4899' },
  'Cuidados Pessoais':          { Icon: Dumbbell,      color: '#A855F7' },
  'Casa & Jardim':              { Icon: Home,          color: '#10B981' },
  'Impostos & Taxas':           { Icon: Receipt,       color: '#EF4444' },
  'Emergências':                { Icon: Receipt,       color: '#EF4444' },
  'Outros':                     { Icon: ShoppingBag,   color: '#6B7280' },
  /* Income */
  'Salário':                    { Icon: Wallet,        color: '#10B981' },
  'Salário Principal':          { Icon: Wallet,        color: '#10B981' },
  'Subsídios':                  { Icon: Wallet,        color: '#10B981' },
  'Freelance':                  { Icon: Briefcase,     color: '#10B981' },
  'Trabalho Extra / Freelance': { Icon: Briefcase,     color: '#10B981' },
  'Investimentos':              { Icon: TrendingUp,    color: '#10B981' },
  'Rendas Recebidas':           { Icon: Home,          color: '#10B981' },
  'Reembolsos':                 { Icon: RefreshCw,     color: '#10B981' },
  'Vendas':                     { Icon: Tag,           color: '#10B981' },
  'Prémios & Sorteios':         { Icon: Trophy,        color: '#10B981' },
  'Prendas & Doações Recebidas':{ Icon: Gift,          color: '#10B981' },
  'Bonus':                      { Icon: PiggyBank,     color: '#10B981' },
  'Outros Rendimentos':         { Icon: Wallet,        color: '#10B981' },
};

const TRANSFER_META  = { Icon: ArrowRightLeft, color: '#9CA3AF' };
const ADJUST_META    = { Icon: Scale,          color: '#F97316' };
const DEFAULT_INCOME = { Icon: Wallet,         color: '#10B981' };
const DEFAULT_EXPENSE= { Icon: CreditCard,     color: '#6B7280' };

function getMeta(cat, type) {
  if (type === 'transfer')   return TRANSFER_META;
  if (type === 'adjustment') return ADJUST_META;
  return CAT_META[cat] || (type === 'income' ? DEFAULT_INCOME : DEFAULT_EXPENSE);
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
  const [open,      setOpen]     = useState(false);
  const [pickerTx,  setPickerTx] = useState(null);
  const [deleting,  setDeleting] = useState(false);

  const isTransfer   = tx.type === 'transfer';
  const isAdjustment = tx.type === 'adjustment';
  const isIncome     = tx.type === 'income';

  const { Icon, color } = getMeta(tx.category, tx.type);

  const title = isTransfer
    ? getTransferFlow(tx)
    : (tx.description || tx.category || '—');

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
          <div
            className="ftc-icon-wrap"
            style={{ background: `${color}26` /* ~15% opacity */ }}
          >
            <Icon size={18} color={color} strokeWidth={2} />
          </div>

          {/* Body */}
          <div className="ftc-body">
            <span className="ftc-title">{title}</span>
            <span className="ftc-sub">
              {isTransfer ? (
                <span className="ftc-badge ftc-badge--transfer">Transferência</span>
              ) : isAdjustment ? (
                <span className="ftc-badge ftc-badge--adjust">Ajuste</span>
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
