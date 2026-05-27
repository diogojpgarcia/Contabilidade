import React, { useState, useEffect } from 'react';
import { getCategoryMeta } from '../../utils/categoryIcons';
import { STATUS } from '../../utils/budgetUtils';

const CategoryHistorySheet = ({ catId, categories, txByCategory, budgets, sortedItems, animated: budgetAnimated, isVisible, onClose }) => {
  const [txVisible, setTxVisible] = useState([]);

  const catData = catId ? sortedItems.find(i => i.cat.id === catId) : null;
  const txs = catId ? (txByCategory[catId] || []) : [];
  const { Icon: CatIcon, color: catColor } = catData ? getCategoryMeta(catData.cat.label) : { Icon: () => null, color: '#475569' };
  const st = catData ? STATUS(catData.percent) : STATUS(0);

  useEffect(() => {
    if (!isVisible) { setTxVisible([]); return; }
    setTxVisible([]);
    txs.forEach((_, i) => {
      setTimeout(() => setTxVisible(prev => [...prev, i]), 180 + i * 55);
    });
  }, [isVisible, catId]);

  if (!catId) return null;

  const remaining = catData ? catData.limit - catData.spent : 0;
  const isOver = catData && catData.percent >= 100;

  return (
    <>
      <div
        className={`m-sheet-backdrop${isVisible ? ' open' : ''}`}
        onClick={onClose}
      />
      <div className={`m-sheet${isVisible ? ' open' : ''}`}>
        <div className="m-sheet-handle" />
        <div className="m-sheet-header">
          <div className="m-sheet-ico" style={{ background: catColor + '1A' }}>
            <CatIcon size={18} color={catColor} strokeWidth={1.75} />
          </div>
          <div className="m-sheet-hdr-info">
            <div className="m-sheet-title">{catData?.cat.label || ''}</div>
            <div className="m-sheet-subtitle">{txs.length} transações este mês</div>
          </div>
          <button className="m-sheet-close" onClick={onClose}>✕</button>
        </div>

        <div className="m-sheet-stats">
          <div className="m-sheet-stat">
            <div className="m-sheet-stat-lbl">Gasto</div>
            <div className="m-sheet-stat-val" style={{ color: isOver ? '#F87171' : '#E2E8F0' }}>
              {catData ? catData.spent.toFixed(2) : 0}€
            </div>
          </div>
          <div className="m-sheet-stat">
            <div className="m-sheet-stat-lbl">Orçamento</div>
            <div className="m-sheet-stat-val" style={{ color: 'var(--cosmos-accent)' }}>
              {catData && catData.limit > 0 ? catData.limit.toFixed(2) : '—'}€
            </div>
          </div>
          <div className="m-sheet-stat">
            <div className="m-sheet-stat-lbl">Restante</div>
            <div className="m-sheet-stat-val" style={{ color: remaining >= 0 ? '#4ADE80' : '#F87171' }}>
              {catData && catData.limit > 0 ? `${remaining >= 0 ? '' : '−'}${Math.abs(remaining).toFixed(2)}€` : '—'}
            </div>
          </div>
        </div>

        {catData && catData.limit > 0 && (
          <div className="m-sheet-prog-wrap">
            <div className="m-sheet-prog-row">
              <span className="m-sheet-prog-lbl">{catData.percent.toFixed(0)}% do orçamento</span>
              {catData.delta > 0.5  && <span className="m-sheet-delta up">+{catData.delta.toFixed(2)}€ ↑</span>}
              {catData.delta < -0.5 && <span className="m-sheet-delta down">−{Math.abs(catData.delta).toFixed(2)}€ ↓</span>}
            </div>
            <div className="m-sheet-prog-track">
              <div
                className="m-sheet-prog-fill"
                style={{
                  width: isVisible ? `${Math.min(catData.percent, 100)}%` : '0%',
                  background: st.grad,
                  boxShadow: isVisible ? `0 0 8px ${st.glow}` : 'none',
                  transition: 'width 0.8s cubic-bezier(0.4,0,0.2,1) 0.1s',
                }}
              />
            </div>
          </div>
        )}

        <div className="m-sheet-txs-label">Histórico do mês</div>
        <div className="m-sheet-txs-list">
          {txs.length === 0 ? (
            <div className="m-sheet-txs-empty">Sem transações neste mês</div>
          ) : (
            txs.map((tx, i) => (
              <div
                key={tx.id || i}
                className="m-sheet-tx-row"
                style={{
                  opacity: txVisible.includes(i) ? 1 : 0,
                  transform: txVisible.includes(i) ? 'translateY(0)' : 'translateY(10px)',
                  transition: 'opacity 0.25s ease, transform 0.25s ease',
                }}
              >
                <div className="m-sheet-tx-dot" style={{ background: catColor }} />
                <div className="m-sheet-tx-info">
                  <div className="m-sheet-tx-name">{tx.description || tx.title || tx.category}</div>
                  {tx.account_name && <div className="m-sheet-tx-acc">{tx.account_name}</div>}
                </div>
                <div className="m-sheet-tx-right">
                  <div className="m-sheet-tx-amount">−{parseFloat(tx.amount || 0).toFixed(2)}€</div>
                  <div className="m-sheet-tx-date">
                    {tx.date ? new Date(tx.date + 'T00:00:00').toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' }) : ''}
                  </div>
                </div>
              </div>
            ))
          )}
          <div style={{ height: 'calc(24px + max(0px, env(safe-area-inset-bottom)))' }} />
        </div>
      </div>
    </>
  );
};

export default CategoryHistorySheet;
