import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { getCategoryMeta } from '../../utils/categoryIcons';
import { STATUS } from '../../utils/budgetUtils';

const CategoryHistorySheet = ({
  catId, txByCategory, sortedItems,
  isVisible, onClose,
  onLimitChange, onSave,
}) => {
  const [txVisible,    setTxVisible]    = useState([]);
  const [editingLimit, setEditingLimit] = useState(false);
  const [limitDraft,   setLimitDraft]   = useState('');
  const inputRef = useRef(null);

  const catData = catId ? sortedItems.find(i => i.cat.id === catId) : null;
  const txs     = catId ? (txByCategory[catId] || []) : [];
  const { Icon: CatIcon, color: catColor } = catData
    ? getCategoryMeta(catData.cat.label)
    : { Icon: () => null, color: '#475569' };
  const st        = catData ? STATUS(catData.percent) : STATUS(0);
  const remaining = catData ? catData.limit - catData.spent : 0;
  const isOver    = catData && catData.percent >= 100;

  // Lock body scroll while open
  useEffect(() => {
    document.body.style.overflow   = isVisible ? 'hidden' : '';
    document.body.style.touchAction = isVisible ? 'none'   : '';
    return () => { document.body.style.overflow = ''; document.body.style.touchAction = ''; };
  }, [isVisible]);

  // Stagger transactions on open
  useEffect(() => {
    if (!isVisible) { setTxVisible([]); setEditingLimit(false); return; }
    setTxVisible([]);
    const timers = txs.map((_, i) => setTimeout(() => setTxVisible(p => [...p, i]), 180 + i * 55));
    return () => timers.forEach(clearTimeout);
  }, [isVisible, catId]);

  // Focus input when editing
  useEffect(() => {
    if (!editingLimit) return;
    const t = setTimeout(() => inputRef.current?.focus(), 80);
    return () => clearTimeout(t);
  }, [editingLimit]);

  const handleStartEdit = () => {
    setLimitDraft(catData?.limit > 0 ? catData.limit.toFixed(2) : '');
    setEditingLimit(true);
  };

  const handleSave = () => {
    if (!catData) return;
    const val = parseFloat(limitDraft) || 0;
    onLimitChange?.(catData.cat.id, val);
    setTimeout(() => { onSave?.(); }, 30);
    setEditingLimit(false);
  };

  if (!catId) return null;

  // Portal para #overlay-root (fora de .main-content-new > div, que tem
  // transform/contain). Sem isto o position:fixed do sheet ancorava ao wrapper
  // do tab em vez do ecrã → sheet descentrado e backdrop a não cobrir tudo.
  const overlayRoot = document.getElementById('overlay-root') || document.body;

  return createPortal(
    <>
      <div className={`m-sheet-backdrop${isVisible ? ' open' : ''}`} onClick={onClose} />
      <div className={`m-sheet${isVisible ? ' open' : ''}`}>
        <div className="m-sheet-handle" />

        {/* Header */}
        <div className="m-sheet-header">
          <div className="m-sheet-ico" style={{ background: catColor + '22' }}>
            <CatIcon size={18} color={catColor} strokeWidth={1.75} />
          </div>
          <div className="m-sheet-hdr-info">
            <div className="m-sheet-title">{catData?.cat.label || ''}</div>
            <div className="m-sheet-subtitle">{txs.length} transações este mês</div>
          </div>
          <button className="m-sheet-close" onClick={onClose} aria-label="Fechar">✕</button>
        </div>

        {/* Stats row */}
        <div className="m-sheet-stats">
          {/* Gasto */}
          <div className="m-sheet-stat">
            <div className="m-sheet-stat-lbl">Gasto</div>
            <div className="m-sheet-stat-val" style={{ color: isOver ? 'var(--cosmos-expense)' : 'var(--cosmos-text-1)' }}>
              {catData ? catData.spent.toFixed(2) : 0}€
            </div>
          </div>

          {/* Orçamento — tappable to edit */}
          <div className="m-sheet-stat" style={{ cursor: 'pointer' }} onClick={handleStartEdit}>
            {editingLimit ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <input
                  ref={inputRef}
                  type="number"
                  inputMode="decimal"
                  value={limitDraft}
                  onChange={e => setLimitDraft(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { handleSave(); e.target.blur(); } if (e.key === 'Escape') setEditingLimit(false); }}
                  onBlur={handleSave}
                  style={{
                    width: 80, fontSize: 17, fontWeight: 700,
                    background: 'var(--cosmos-surface-2)',
                    border: '1.5px solid var(--cosmos-accent)',
                    borderRadius: 8, color: 'var(--cosmos-accent)',
                    padding: '3px 6px', outline: 'none',
                    textAlign: 'center',
                  }}
                />
                <span style={{ fontSize: 13, color: 'var(--cosmos-text-3)' }}>€</span>
              </div>
            ) : (
              <>
                <div className="m-sheet-stat-lbl">
                  Orçamento
                  <span style={{ fontSize: 9, color: 'var(--cosmos-accent)', marginLeft: 4, verticalAlign: 'middle' }}>✎</span>
                </div>
                <div className="m-sheet-stat-val" style={{ color: 'var(--cosmos-accent)' }}>
                  {catData && catData.limit > 0 ? catData.limit.toFixed(2) : '—'}€
                </div>
              </>
            )}
          </div>

          {/* Restante */}
          <div className="m-sheet-stat">
            <div className="m-sheet-stat-lbl">Restante</div>
            <div className="m-sheet-stat-val" style={{ color: remaining >= 0 ? 'var(--cosmos-income)' : 'var(--cosmos-expense)' }}>
              {catData && catData.limit > 0
                ? `${remaining >= 0 ? '' : '−'}${Math.abs(remaining).toFixed(2)}€`
                : '—'}
            </div>
          </div>
        </div>

        {/* Progress bar */}
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

        {/* No limit set — prompt to define */}
        {catData && catData.limit === 0 && !editingLimit && (
          <button
            onClick={handleStartEdit}
            style={{
              margin: '0 16px 12px', padding: '10px 16px',
              background: 'var(--cosmos-accent-dim)',
              border: '1px solid var(--cosmos-accent-border)',
              borderRadius: 12, cursor: 'pointer', width: 'calc(100% - 32px)',
              fontSize: 13, fontWeight: 600, color: 'var(--cosmos-accent)',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            + Definir limite de orçamento
          </button>
        )}

        {/* Transaction list */}
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
                  opacity:   txVisible.includes(i) ? 1 : 0,
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
    </>,
    overlayRoot,
  );
};

export default CategoryHistorySheet;
