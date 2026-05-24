import React, { useState, useRef, useEffect } from 'react';
import Overlay from './Overlay';
import { CategoryIconBubble } from '../utils/categoryIcons';
import './CategoryPicker.css';

/**
 * CategoryPicker — bottom sheet for changing a transaction's category.
 *
 * Props:
 *   transaction  { id, type, category, description }
 *   categories   { expense: [...], income: [...] }  ← REQUIRED (App global state)
 *   onSelect(newCategoryLabel)
 *   onClose()
 */
const CategoryPicker = ({ transaction, onSelect, onClose, categories, title = 'Alterar Categoria' }) => {
  const [search, setSearch] = useState('');
  const inputRef = useRef(null);

  // Auto-focus search only on pointer devices — on touch (Android/iOS) the
  // keyboard popup immediately shifts the sheet and items move under the finger.
  useEffect(() => {
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    const t = setTimeout(() => inputRef.current?.focus(), 80);
    return () => clearTimeout(t);
  }, []);

  // Enforce single source of truth — no fallback allowed.
  if (!categories) {
    console.error('[CategoryPicker] categories prop is required but was not passed. Check the caller.');
    return null;
  }

  const list = transaction.type === 'income' ? categories.income : categories.expense;

  console.log('[CategoryPicker] source: prop | count:', list.length);

  const filtered = list.filter(c =>
    c.label.toLowerCase().includes(search.toLowerCase())
  );

  const handleSelect = (label) => {
    onSelect(label);
    onClose();
  };

  return (
    <Overlay onClose={onClose}>
      <div className="cp-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="cp-handle" />

        <div className="cp-header">
          <span className="cp-title">{title}</span>
          <button className="cp-close" onClick={onClose}>&#215;</button>
        </div>

        <input
          ref={inputRef}
          className="cp-search"
          type="text"
          placeholder="Pesquisar..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />

        <div className="cp-list">
          {filtered.map(cat => {
            const isActive = transaction.category === cat.label;
            return (
              <button
                key={cat.id}
                className={`cp-item${isActive ? ' cp-item--active' : ''}`}
                onClick={() => handleSelect(cat.label)}
              >
                <span className="cp-item-icon">
                  <CategoryIconBubble name={cat.label} type={transaction.type === 'income' ? 'income' : 'expense'} size={30} radius="8px" />
                </span>
                <span className="cp-item-label">{cat.label}</span>
                {isActive && <span className="cp-item-check">&#10003;</span>}
              </button>
            );
          })}
          {filtered.length === 0 && (
            <p className="cp-empty">Sem resultados</p>
          )}
        </div>
      </div>
    </Overlay>
  );
};

export default CategoryPicker;
