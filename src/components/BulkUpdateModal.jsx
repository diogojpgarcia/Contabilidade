import React from 'react';
import './BulkUpdateModal.css';

/**
 * BulkUpdateModal — shown after a category change when similar
 * transactions are found.
 *
 * Props:
 *   bulkPending  { pattern, newCategory, similar: Transaction[] }
 *   onConfirm()  — update all + save rule
 *   onDismiss()  — keep only the single update + save rule
 */
const BulkUpdateModal = ({ bulkPending, onConfirm, onDismiss }) => {
  const { pattern, newCategory, similar } = bulkPending;
  const preview = similar.slice(0, 5);
  const extra   = similar.length - preview.length;

  return (
    <>
      <div className="bum-overlay" onClick={onDismiss} />
      <div className="bum-sheet">
        <div className="bum-handle" />

        <div className="bum-header">
          <p className="bum-title">Atualizar transações similares?</p>
          <p className="bum-subtitle">
            Encontrei <strong>{similar.length}</strong> transação{similar.length !== 1 ? 'ões' : ''} com
            &nbsp;<span className="bum-pattern">"{pattern}"</span>
          </p>
        </div>

        <div className="bum-preview">
          {preview.map(tx => (
            <div key={tx.id} className="bum-row">
              <span className="bum-row-desc">
                {tx.description || tx.clean_description || '—'}
              </span>
              <span className="bum-row-cat">{newCategory}</span>
            </div>
          ))}
          {extra > 0 && (
            <p className="bum-more">+{extra} mais</p>
          )}
        </div>

        <div className="bum-actions">
          <button className="bum-btn bum-btn-dismiss" onClick={onDismiss}>
            Só esta
          </button>
          <button className="bum-btn bum-btn-confirm" onClick={onConfirm}>
            Atualizar {similar.length + 1}
          </button>
        </div>
      </div>
    </>
  );
};

export default BulkUpdateModal;
