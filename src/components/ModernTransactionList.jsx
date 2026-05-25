import React, { useState } from 'react';
import CategoryPicker from './CategoryPicker';
import AccountPicker from './AccountPicker';
import Overlay from './Overlay';

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

const TRANSFER_ICON = { e: '↔', bg: 'rgba(99,102,241,0.1)', c: '#6366f1' };

/* ── Transfer flow label ────────────────────────────────────────────────────
   Transfer transactions are stored as two paired records:
     out: { category: fromName, description: "Transferência para {toName}" }
     in:  { category: toName,   description: "Transferência de {fromName}" }
   We reconstruct the visual "From → To" string from these two fields.        */
function getTransferFlow(tx) {
  const desc = (tx.description || '').trim();
  const toMatch   = desc.match(/^Transferência para (.+)$/i);
  const fromMatch = desc.match(/^Transferência de (.+)$/i);
  if (toMatch)   return `${tx.category} → ${toMatch[1]}`;
  if (fromMatch) return `${fromMatch[1]} → ${tx.category}`;
  return desc || tx.category || 'Transferência';
}

/* ── Transfer deduplication ──────────────────────────────────────────────────
   Each transfer creates two DB records (out + in) with identical date, amount
   and flow string. Keep only the first occurrence of each pair.               */
function dedupeTransfers(txs) {
  const seen = new Set();
  return txs.filter(tx => {
    if (tx.type !== 'transfer') return true;
    const key = `${tx.date}|${tx.amount}|${getTransferFlow(tx)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

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
const ModernTransactionList = ({ transactions, onCategoryChange, onAccountChange, onTransactionDeleted, categories, patrimony }) => {
  const [confirmDeleteTx, setConfirmDeleteTx] = useState(null);
  const [expandedId,    setExpandedId]    = useState(null);
  const [pickerTx,      setPickerTx]      = useState(null);
  const [acctPickerTx,  setAcctPickerTx]  = useState(null);

  const accounts = patrimony?.accounts || [];

  const handlePickerSelect = (newCategory) => {
    if (pickerTx && onCategoryChange) {
      onCategoryChange(pickerTx.id, newCategory, pickerTx.description);
    }
    setPickerTx(null);
  };

  const handleAccountSelect = (newId, newName) => {
    if (acctPickerTx && onAccountChange) {
      onAccountChange(acctPickerTx.id, newId, newName);
    }
    setAcctPickerTx(null);
  };

  const dedupedTxs = dedupeTransfers(transactions);

  if (!dedupedTxs.length) {
    return (
      <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-tertiary)' }}>
        Sem transações este mês
      </div>
    );
  }

  const groups = groupByDate(dedupedTxs);

  return (
    <>
      {groups.map(({ key, label, items }) => (
        <div key={key} className="ft-group">
          <div className="ft-group-label">{label}</div>

          {items.map((tx) => {
            const isExpanded   = expandedId === tx.id;
            const isTransfer   = tx.type === 'transfer';
            const isIncome     = tx.type === 'income';
            const icon         = isTransfer ? TRANSFER_ICON : getIcon(tx.category, tx.type);
            // For transfers: derive "From → To" from description + category
            const title        = isTransfer
              ? getTransferFlow(tx)
              : (tx.description || tx.category);

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
                    <span className="ft-title">{title}</span>
                    <span className="ft-sub">
                      {isTransfer
                        ? <span style={{ fontSize: '0.7rem', background: 'rgba(99,102,241,0.15)', color: 'var(--accent, #6366f1)', borderRadius: '4px', padding: '1px 6px' }}>↔ Transferência</span>
                        : tx.type === 'adjustment'
                          ? <span style={{ fontSize: '0.7rem', background: '#f97316', color: '#fff', borderRadius: '4px', padding: '1px 6px' }}>⚖ Ajuste</span>
                          : tx.category}
                      {tx.account_name && !isTransfer && tx.type !== 'adjustment' && (
                        <span className="ft-acct-badge">◈ {tx.account_name}</span>
                      )}
                    </span>
                  </div>

                  <span className={`ft-amount ${isTransfer ? 'transfer' : (isIncome ? 'income' : 'expense')}`}
                        style={isTransfer ? { color: 'var(--text-secondary, #888)', fontWeight: 500 } : undefined}>
                    {isTransfer
                      ? `${parseFloat(tx.amount).toFixed(2)}€`
                      : `${isIncome ? '+' : '−'}${parseFloat(tx.amount).toFixed(2)}€`}
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

                  {onAccountChange && !isTransfer && (
                    <button
                      className="ft-detail-btn"
                      onClick={() => { setAcctPickerTx(tx); setExpandedId(null); }}
                    >
                      ◈ {tx.account_name || 'Conta'}
                    </button>
                  )}

                  {onTransactionDeleted && (
                    <button
                      className="ft-detail-del"
                      onClick={() => setConfirmDeleteTx(tx)}
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
          categories={categories}
        />
      )}

      {acctPickerTx && (
        <AccountPicker
          accounts={accounts}
          currentAccountId={acctPickerTx.account_id || null}
          onSelect={handleAccountSelect}
          onClose={() => setAcctPickerTx(null)}
        />
      )}
      {confirmDeleteTx && (
        <Overlay onClose={() => setConfirmDeleteTx(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h4>Apagar transação?</h4>
              <button className="modal-close" onClick={() => setConfirmDeleteTx(null)}>×</button>
            </div>
            <div className="modal-body" style={{ padding: '0 0 8px' }}>
              <p style={{ marginBottom: 16, color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                <strong>{confirmDeleteTx.description}</strong><br />
                {confirmDeleteTx.type === 'expense' ? '-' : '+'}{Number(confirmDeleteTx.amount).toFixed(2)}€
              </p>
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  style={{ flex: 1, padding: '10px', borderRadius: '10px', border: '1px solid var(--separator)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.875rem' }}
                  onClick={() => setConfirmDeleteTx(null)}
                >Cancelar</button>
                <button
                  style={{ flex: 1, padding: '10px', borderRadius: '10px', border: 'none', background: '#ef4444', color: '#fff', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.875rem', fontWeight: 600 }}
                  onClick={async () => { setConfirmDeleteTx(null); await onTransactionDeleted(confirmDeleteTx.id); }}
                >Apagar</button>
              </div>
            </div>
          </div>
        </Overlay>
      )}

    </>
  );
};

export default ModernTransactionList;
