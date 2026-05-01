import React, { useState } from 'react';
import CategoryPicker from './CategoryPicker';

/* ── Category icon + colour map ── */
const CAT_ICON = {
  'Alimentação':              { e: '🛒', bg: 'rgba(249,115,22,0.13)', c: '#ea580c' },
  'Habitação':                { e: '🏠', bg: 'rgba(59,130,246,0.13)',  c: '#2563eb' },
  'Transporte':               { e: '🚗', bg: 'rgba(234,179,8,0.13)',   c: '#ca8a04' },
  'Saúde':                    { e: '❤️', bg: 'rgba(239,68,68,0.13)',   c: '#dc2626' },
  'Lazer':                    { e: '🎉', bg: 'rgba(168,85,247,0.13)',  c: '#9333ea' },
  'Lazer & Entretenimento':   { e: '🎬', bg: 'rgba(168,85,247,0.13)',  c: '#9333ea' },
  'Educação':                 { e: '📚', bg: 'rgba(99,102,241,0.13)',  c: '#6366f1' },
  'Roupa':                    { e: '👕', bg: 'rgba(236,72,153,0.13)',  c: '#db2777' },
  'Roupa & Calçado':          { e: '👟', bg: 'rgba(236,72,153,0.13)',  c: '#db2777' },
  'Tecnologia':               { e: '💻', bg: 'rgba(99,102,241,0.13)',  c: '#6366f1' },
  'Subscrições':              { e: '📱', bg: 'rgba(99,102,241,0.13)',  c: '#6366f1' },
  'Comunicações':             { e: '📡', bg: 'rgba(14,165,233,0.13)',  c: '#0284c7' },
  'Utilities':                { e: '⚡', bg: 'rgba(234,179,8,0.13)',   c: '#ca8a04' },
  'Serviços Financeiros':     { e: '🏦', bg: 'rgba(99,102,241,0.13)',  c: '#6366f1' },
  'Viagens & Férias':         { e: '✈️', bg: 'rgba(14,165,233,0.13)',  c: '#0284c7' },
  'Presentes & Doações':      { e: '🎁', bg: 'rgba(236,72,153,0.13)',  c: '#db2777' },
  'Salário':                  { e: '💰', bg: 'rgba(34,197,94,0.13)',   c: '#16a34a' },
  'Salário Principal':        { e: '💰', bg: 'rgba(34,197,94,0.13)',   c: '#16a34a' },
  'Freelance':                { e: '💼', bg: 'rgba(34,197,94,0.13)',   c: '#16a34a' },
  'Trabalho Extra / Freelance':{ e: '💼', bg: 'rgba(34,197,94,0.13)', c: '#16a34a' },
  'Investimentos':            { e: '📈', bg: 'rgba(34,197,94,0.13)',   c: '#16a34a' },
  'Bonus':                    { e: '🎁', bg: 'rgba(34,197,94,0.13)',   c: '#16a34a' },
  'Outros Rendimentos':       { e: '💵', bg: 'rgba(34,197,94,0.13)',   c: '#16a34a' },
  'Outros':                   { e: '💳', bg: 'rgba(156,163,175,0.13)', c: '#6b7280' },
};

const getIcon = (cat, type) =>
  CAT_ICON[cat] ||
  (type === 'income'
    ? { e: '💰', bg: 'rgba(34,197,94,0.13)',   c: '#16a34a' }
    : { e: '💳', bg: 'rgba(156,163,175,0.13)', c: '#6b7280' });

/* ── Date grouping helpers ── */
const today     = () => { const d = new Date(); d.setHours(0,0,0,0); return d; };
const yesterday = () => { const d = today(); d.setDate(d.getDate()-1); return d; };

const dateLabel = (dateStr) => {
  // support both YYYY-MM-DD and ISO strings
  const d = new Date(dateStr.length === 10 ? dateStr + 'T00:00:00' : dateStr);
  d.setHours(0,0,0,0);
  const t = today().getTime();
  const y = yesterday().getTime();
  if (d.getTime() === t) return 'Hoje';
  if (d.getTime() === y) return 'Ontem';
  const day   = d.getDate();
  const month = d.toLocaleDateString('pt-PT', { month: 'long' });
  const year  = d.getFullYear();
  return year === new Date().getFullYear()
    ? `${day} de ${month}`
    : `${day} de ${month} de ${year}`;
};

const groupByDate = (txs) => {
  const groups = [];
  const idx    = new Map();
  for (const tx of txs) {
    const key   = (tx.date || '').slice(0, 10);
    const label = dateLabel(tx.date || new Date().toISOString());
    if (!idx.has(key)) {
      idx.set(key, groups.length);
      groups.push({ key, label, items: [tx] });
    } else {
      groups[idx.get(key)].items.push(tx);
    }
  }
  return groups;
};

/* ── Component ── */
const ModernTransactionList = ({ transactions, onCategoryChange, onTransactionDeleted }) => {
  const [expandedId, setExpandedId] = useState(null);
  const [pickerTx,   setPickerTx]   = useState(null);

  const handlePickerSelect = (newCategory) => {
    if (pickerTx && onCategoryChange) {
      onCategoryChange(pickerTx.id, newCategory, pickerTx.description);
    }
    setPickerTx(null);
  };

  if (!transactions.length) {
    return (
      <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-tertiary)' }}>
        Sem transações este mês
      </div>
    );
  }

  const groups = groupByDate(transactions);

  return (
    <>
      {groups.map(({ key, label, items }) => (
        <div key={key} className="ft-group">
          <div className="ft-group-label">{label}</div>

          {items.map((tx) => {
            const isExpanded   = expandedId === tx.id;
            const isTransfer   = tx.type === 'transfer';
            const isIncome     = tx.type === 'income';
            const icon         = getIcon(tx.category, tx.type);

            return (
              <div key={tx.id}>
                {/* ── Main row ── */}
                <div
                  className="ft-row"
                  onClick={() => setExpandedId(isExpanded ? null : tx.id)}
                >
                  <div className="ft-icon" style={{ background: icon.bg, color: icon.c }}>
                    {icon.e}
                  </div>

                  <div className="ft-center">
                    <span className="ft-title">{tx.description || tx.category}</span>
                    <span className="ft-sub">
                      {isTransfer
                        ? <span style={{ fontSize: '0.7rem', background: 'var(--accent, #6366f1)', color: '#fff', borderRadius: '4px', padding: '1px 6px' }}>↕ Transferência</span>
                        : tx.type === 'adjustment'
                          ? <span style={{ fontSize: '0.7rem', background: '#f97316', color: '#fff', borderRadius: '4px', padding: '1px 6px' }}>⚖ Ajuste</span>
                          : tx.category}
                    </span>
                  </div>

                  <span className={`ft-amount ${isTransfer ? 'transfer' : (isIncome ? 'income' : 'expense')}`}
                        style={isTransfer ? { color: 'var(--accent, #6366f1)' } : undefined}>
                    {isTransfer ? '↕ ' : (isIncome ? '+' : '−')}{parseFloat(tx.amount).toFixed(2)}€
                  </span>
                </div>

                {/* ── Expandable detail (always in DOM, toggled via CSS) ── */}
                <div
                  className={`ft-detail${isExpanded ? ' open' : ''}`}
                  onClick={(e) => e.stopPropagation()}
                >
                  <span className="ft-detail-date">
                    {new Date(
                      tx.date.length === 10 ? tx.date + 'T00:00:00' : tx.date
                    ).toLocaleDateString('pt-PT', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </span>

                  {onCategoryChange && (
                    <button
                      className="ft-detail-btn"
                      onClick={() => { setPickerTx(tx); setExpandedId(null); }}
                    >
                      ✎ Categoria
                    </button>
                  )}

                  {onTransactionDeleted && (
                    <button
                      className="ft-detail-del"
                      onClick={async () => {
                        if (window.confirm('Apagar esta transação?')) {
                          await onTransactionDeleted(tx.id);
                        }
                      }}
                    >
                      🗑
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ))}

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

export default ModernTransactionList;
