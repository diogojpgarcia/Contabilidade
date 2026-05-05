import React, { useState, useRef, useEffect } from 'react';
import { CATEGORIES_EXPENSE, CATEGORIES_INCOME } from '../utils/categories-professional';
import Overlay from './Overlay';
import './CategoryPicker.css';

/**
 * CategoryPicker — bottom sheet for changing a transaction's category.
 *
 * Props:
 *   transaction  { id, type, category, description }
 *   onSelect(newCategoryLabel)
 *   onClose()
 */
const CategoryPicker = ({ transaction, onSelect, onClose, categories: categoriesProp }) => {
  const [search, setSearch] = useState('');
  const inputRef = useRef(null);

  // Auto-focus search on open
  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 80);
    return () => clearTimeout(t);
  }, []);

  // Use the App-level categories prop when available; fall back to static import.
  // This ensures custom categories added in Profile appear here too.
  const categories = categoriesProp
    ? (transaction.type === 'income' ? categoriesProp.income : categoriesProp.expense)
    : (transaction.type === 'income' ? CATEGORIES_INCOME : CATEGORIES_EXPENSE);

  console.log('[CategoryPicker] source:', categoriesProp ? 'prop' : 'fallback', '| count:', categories.length);

  const filtered = categories.filter(c =>
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
          <span className="cp-title">Alterar Categoria</span>
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
                <span className="cp-item-icon">{cat.icon}</span>
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
