import React, { useState } from 'react';
import CategoryPicker from './CategoryPicker';

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

const DefaultTransactionList = ({ transactions, onCategoryChange }) => {
  const [pickerTx, setPickerTx] = useState(null);

  const handlePickerSelect = (newCategory) => {
    if (pickerTx && onCategoryChange) {
      onCategoryChange(pickerTx.id, newCategory, pickerTx.description);
    }
    setPickerTx(null);
  };

  if (!transactions.length) {
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
        {transactions.map((tx, index) => (
          <div key={tx.id || index} className="transaction-item">
            <div className="transaction-icon">{icon(tx.category)}</div>
            <div className="transaction-details">
              <div
                className={`transaction-category${onCategoryChange ? ' transaction-category--editable' : ''}`}
                onClick={() => onCategoryChange && setPickerTx(tx)}
                title={onCategoryChange ? 'Toca para alterar categoria' : undefined}
              >
                {tx.category}
                {onCategoryChange && <span className="category-edit-hint">&#8250;</span>}
              </div>
              {tx.description && (
                <div className="transaction-description">{tx.description}</div>
              )}
            </div>
            <div className={`transaction-amount ${tx.type}`}>
              {tx.type === 'income' ? '+' : '-'}{parseFloat(tx.amount).toFixed(2)}€
            </div>
          </div>
        ))}
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

export default DefaultTransactionList;
