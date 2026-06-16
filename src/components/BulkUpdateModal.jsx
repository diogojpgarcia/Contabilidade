import React, { useState } from 'react';
import Overlay from './Overlay';
import { toBudgetLabel } from '../utils/categories-professional';
import './BulkUpdateModal.css';

/**
 * BulkUpdateModal — mostrado após mudar a categoria de uma transação quando
 * existem outras com descrição parecida.
 *
 * O utilizador escolhe individualmente (checkboxes) a quais aplicar — pode,
 * por exemplo, mudar só "Uber Eats" e deixar "Uber Rides" de fora.
 *
 * Props:
 *   bulkPending  { pattern, newCategory, similar: Transaction[] }
 *   onConfirm(selectedIds: string[])  — aplica aos selecionados + aprende regra
 *   onDismiss()                       — mantém só a alteração original
 */
const BulkUpdateModal = ({ bulkPending, onConfirm, onDismiss }) => {
  const { pattern, newCategory, similar } = bulkPending;
  const catLabel = toBudgetLabel(newCategory);

  // Por defeito todas selecionadas (comportamento "aplicar a todas").
  const [selected, setSelected] = useState(() => new Set(similar.map(s => s.id)));

  const toggle = (id) => setSelected(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });

  const allOn = selected.size === similar.length;
  const toggleAll = () =>
    setSelected(allOn ? new Set() : new Set(similar.map(s => s.id)));

  const handleConfirm = () => onConfirm(Array.from(selected));

  return (
    <Overlay onClose={onDismiss}>
      <div className="bum-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="bum-handle" />

        <div className="bum-header">
          <p className="bum-title">Aplicar a transações similares?</p>
          <p className="bum-subtitle">
            Encontrei <strong>{similar.length}</strong> transação{similar.length !== 1 ? 'ões' : ''} com
            &nbsp;<span className="bum-pattern">"{pattern}"</span>. Escolhe a quais aplicar
            &nbsp;<span className="bum-pattern">{catLabel}</span>.
          </p>
        </div>

        <button className="bum-selectall" onClick={toggleAll}>
          <span className={`bum-box ${allOn ? 'bum-box--on' : ''}`}>{allOn ? '✓' : ''}</span>
          {allOn ? 'Desmarcar todas' : 'Selecionar todas'}
        </button>

        <div className="bum-preview">
          {similar.map(tx => {
            const on = selected.has(tx.id);
            return (
              <button
                key={tx.id}
                type="button"
                className={`bum-row ${on ? 'bum-row--on' : ''}`}
                onClick={() => toggle(tx.id)}
              >
                <span className={`bum-box ${on ? 'bum-box--on' : ''}`}>{on ? '✓' : ''}</span>
                <span className="bum-row-desc">
                  {tx.description || tx.clean_description || '—'}
                </span>
              </button>
            );
          })}
        </div>

        <div className="bum-actions">
          <button className="bum-btn bum-btn-dismiss" onClick={onDismiss}>
            Só esta
          </button>
          <button className="bum-btn bum-btn-confirm" onClick={handleConfirm}>
            {selected.size > 0 ? `Aplicar a ${selected.size + 1}` : 'Concluir'}
          </button>
        </div>
      </div>
    </Overlay>
  );
};

export default BulkUpdateModal;
