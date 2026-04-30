import React, { useState, useRef, useEffect } from 'react';
import { CATEGORIES_EXPENSE, CATEGORIES_INCOME } from '../utils/categories-professional';
import './CategoryPicker.css';

/**
 * CategoryPicker — bottom sheet for changing a transaction's category.
 *
 * Props:
 *   transaction  { id, type, category, description }
 *   onSelect(newCategoryLabel)
 *   onClose()
 */
const CategoryPicker = ({ transaction, onSelect, onClose }) => {
  const [search, setSearch] = useState('');
  const inputRef = useRef(null);

  // Auto-focus search on open
  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 80);
    return () => clearTimeout(t);
  }, []);

  const categories = transaction.type === 'income' ? CATEGORIES_INCOME : CATEGORIES_EXPENSE;

  const filtered = categories.filter(c =>
    c.label.toLowerCase().includes(search.toLowerCase())
  );

  const handleSelect = (label) => {
    onSelect(label);
    onClose();
  };

  return (
    <>
      {/* Backdrop */}
      <div className="cp-overlay" onClick={onClose} />

      {/* Sheet */}
      <div className="cp-sheet">
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
    </>
  );
};

export default CategoryPicker;
