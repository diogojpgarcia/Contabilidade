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

const ModernTransactionList = ({ transactions, onCategoryChange, onTransactionDeleted }) => {
  const [expandedId, setExpandedId] = useState(null);
  const [pickerTx, setPickerTx]     = useState(null);

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

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {transactions.map((tx) => {
          const isExpanded = expandedId === tx.id;
          const isIncome   = tx.type === 'income';

          return (
            <div
              key={tx.id}
              onClick={() => setExpandedId(isExpanded ? null : tx.id)}
              style={{
                background: 'var(--bg-secondary)',
                border: '0.5px solid var(--separator)',
                borderRadius: 16,
                overflow: 'hidden',
                cursor: 'pointer',
                WebkitTapHighlightColor: 'transparent',
                boxShadow: isExpanded ? 'var(--shadow-md)' : 'none',
                transition: 'box-shadow 0.15s ease',
              }}
            >
              {/* ── Collapsed row ── */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px' }}>
                {/* Icon circle */}
                <div style={{
                  width: 40, height: 40, borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '1.125rem', flexShrink: 0,
                  background: isIncome ? 'rgba(52,211,153,0.12)' : 'rgba(239,68,68,0.12)',
                  color: isIncome ? '#34D399' : '#EF4444',
                }}>
                  {icon(tx.category)}
                </div>

                {/* Description + category */}
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{
                    fontSize: '0.9375rem', fontWeight: 600,
                    color: 'var(--text-primary)', letterSpacing: '-0.01em',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    {tx.description || tx.category}
                  </span>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', fontWeight: 500 }}>
                    {tx.category}
                  </span>
                </div>

                {/* Amount */}
                <div style={{
                  fontSize: '0.9375rem', fontWeight: 700,
                  letterSpacing: '-0.02em', flexShrink: 0,
                  color: isIncome ? '#34D399' : '#F87171',
                }}>
                  {isIncome ? '+' : '-'}{parseFloat(tx.amount).toFixed(2)}€
                </div>
              </div>

              {/* ── Expanded row ── */}
              {isExpanded && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '10px 14px 12px',
                    borderTop: '0.5px solid var(--separator)',
                  }}
                >
                  <span style={{ flex: 1, fontSize: '0.8rem', color: 'var(--text-tertiary)', fontWeight: 500 }}>
                    {tx.date}
                  </span>

                  {onCategoryChange && (
                    <button
                      onClick={() => { setPickerTx(tx); setExpandedId(null); }}
                      style={{
                        background: 'var(--bg-tertiary)', border: 'none',
                        borderRadius: 8, padding: '6px 12px',
                        fontSize: '0.8125rem', fontWeight: 600,
                        color: 'var(--primary)', cursor: 'pointer',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      ✎ Categoria
                    </button>
                  )}

                  {onTransactionDeleted && (
                    <button
                      onClick={async () => {
                        if (window.confirm('Apagar esta transação?')) {
                          await onTransactionDeleted(tx.id);
                        }
                      }}
                      style={{
                        background: 'transparent', border: 'none',
                        borderRadius: 8, width: 34, height: 34,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '1rem', cursor: 'pointer', opacity: 0.55,
                      }}
                    >
                      🗑
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
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

export default ModernTransactionList;
