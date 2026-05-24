import React, { useRef, useEffect } from 'react';
import { getCategoryMeta } from '../../utils/categoryIcons';
import { STATUS } from '../../utils/budgetUtils';

const BudgetCategoryCard = ({ cat, limit, spent, percent, delta, animated, isEditing, onEditToggle, onLimitChange, onSave, onOpenHistory }) => {
  const { Icon: CatIcon, color: catColor } = getCategoryMeta(cat.label);
  const st = STATUS(percent);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!isEditing) return;
    const t = setTimeout(() => inputRef.current?.focus(), 200);
    return () => clearTimeout(t);
  }, [isEditing]);

  return (
    <div
      className="m-gcc"
      style={{ borderTopColor: limit > 0 ? st.color : 'rgba(255,255,255,0.08)' }}
      onClick={onOpenHistory}
    >
      <div className="m-gcc-top">
        <div className="m-gcc-ico" style={{ background: catColor + '1A' }}>
          <CatIcon size={16} color={catColor} strokeWidth={1.75} />
        </div>
        <div className="m-gcc-right">
          {limit > 0 && <div className="m-gcc-pct" style={{ color: st.color }}>{percent.toFixed(0)}%</div>}
          {delta > 0.5  && <div className="m-gcc-delta up">+{delta.toFixed(2)}€ ↑</div>}
          {delta < -0.5 && <div className="m-gcc-delta down">−{Math.abs(delta).toFixed(2)}€ ↓</div>}
        </div>
      </div>
      <div className="m-gcc-name">{cat.label}</div>
      <div className="m-gcc-amounts">
        {spent.toFixed(2)}€{limit > 0 ? <span> /{limit.toFixed(2)}€</span> : null}
      </div>
      {limit > 0 && (
        <div className="m-gcc-bar-bg">
          <div
            className="m-gcc-bar-fill"
            style={{
              width: animated ? `${Math.min(percent, 100)}%` : '0%',
              background: st.grad,
              boxShadow: animated ? `0 0 8px ${st.glow}` : 'none',
            }}
          />
        </div>
      )}
      {isEditing && (
        <div className="m-gcc-edit-row" onClick={e => e.stopPropagation()}>
          <input
            ref={inputRef}
            type="number"
            inputMode="decimal"
            className="m-gcc-input"
            value={limit || ''}
            onChange={e => onLimitChange(cat.id, e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { onSave(); e.target.blur(); } }}
            onBlur={onSave}
            placeholder="Limite €/mês"
          />
          <button className="m-gcc-save-btn" onClick={e => { e.stopPropagation(); onSave(); }}>✓</button>
        </div>
      )}
      <button
        className="m-gcc-edit-btn"
        onClick={e => { e.stopPropagation(); onEditToggle(); }}
        aria-label="Editar limite"
      >✎</button>
    </div>
  );
};

export default React.memo(BudgetCategoryCard);
