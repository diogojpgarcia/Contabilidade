import React, { useState } from 'react';
import CategoryPicker from './CategoryPicker';

/* Transfer flow: reconstruct "From → To" from paired transfer records */
function getTransferFlow(tx) {
  const desc = (tx.description || '').trim();
  const toMatch   = desc.match(/^Transferência para (.+)$/i);
  const fromMatch = desc.match(/^Transferência de (.+)$/i);
  if (toMatch)   return `${tx.category} → ${toMatch[1]}`;
  if (fromMatch) return `${fromMatch[1]} → ${tx.category}`;
  return desc || tx.category || 'Transferência';
}

/* Keep only the first of each paired transfer (out + in share same key) */
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

const ICON_MAP = {
  'Alimentação': '⚑', 'Habitação': '⌂', 'Transporte': '⚐', 'Saúde': '✚',
  'Lazer': '◉', 'Educação': '⊞', 'Roupa': '◫', 'Tecnologia': '◧',
  'Subscrições': '◉', 'Outros': '◌', 'Salário': '◈', 'Freelance': '◐',
  'Investimentos': '◭', 'Bonus': '◆', 'Outros Rendimentos': '◌',
  'Lazer & Entretenimento': '◐', 'Roupa & Calçado': '◫',
  'Serviços Financeiros': '◈', 'Comunicações': '◎', 'Utilities': '⚡',
  'Salário Principal': '◈', 'Trabalho Extra / Freelance': '◐',
  'Viagens & Férias': '✈', 'Presentes & Doações': '◆',
};
const icon = (cat) => ICON_MAP[cat] || '◌';

const DefaultTransactionList = ({ transactions, onCategoryChange, categories }) => {
  const [pickerTx, setPickerTx] = useState(null);

  const handlePickerSelect = (newCategory) => {
    if (pickerTx && onCategoryChange) {
      onCategoryChange(pickerTx.id, newCategory, pickerTx.description);
    }
    setPickerTx(null);
  };

  const dedupedTxs = dedupeTransfers(transactions);

  if (!dedupedTxs.length) {
    return (
      <div className="empty-state">
        <div className="empty-icon">◌</div>
        <p className="empty-text">Sem transações este mês</p>
      </div>
    );
  }

  return (
    <>
      <div className="transactions-list">
        {dedupedTxs.map((tx, index) => {
          const isTransfer = tx.type === 'transfer';
          return (
          <div key={tx.id || index} className={`transaction-item ${tx.type}`}>
            <div className="transaction-icon">{isTransfer ? '↔' : icon(tx.category)}</div>
            <div className="transaction-details">
              {isTransfer ? (
                /* Transfer: show "From → To" as the primary label */
                <div className="transaction-category" style={{ fontWeight: 600 }}>
                  {getTransferFlow(tx)}
                </div>
              ) : (
                <div
                  className={`transaction-category${onCategoryChange ? ' transaction-category--editable' : ''}`}
                  onClick={() => onCategoryChange && setPickerTx(tx)}
                  title={onCategoryChange ? 'Toca para alterar categoria' : undefined}
                >
                  {tx.category}
                  {onCategoryChange && <span className="category-edit-hint">&#8250;</span>}
                </div>
              )}
              {/* Show description only for non-transfers */}
              {!isTransfer && tx.description && (
                <div className="transaction-description">{tx.description}</div>
              )}
            </div>
            <div
              className={`transaction-amount ${tx.type}`}
              style={isTransfer ? { color: 'var(--text-secondary, #888)', fontWeight: 500 } : undefined}
            >
              {isTransfer
                ? `${parseFloat(tx.amount).toFixed(2)}€`
                : `${tx.type === 'income' ? '+' : '-'}${parseFloat(tx.amount).toFixed(2)}€`}
            </div>
          </div>
          );
        })}
      </div>

      {pickerTx && (
        <CategoryPicker
          transaction={pickerTx}
          onSelect={handlePickerSelect}
          onClose={() => setPickerTx(null)}
          categories={categories}
        />
      )}
    </>
  );
};

export default DefaultTransactionList;
