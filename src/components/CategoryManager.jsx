import React, { useState } from 'react';
import { dbService } from '../lib/supabase';

const DEFAULT_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1'
];

const DEFAULT_ICONS = [
  '🏠', '🍔', '🚗', '💊', '🎮', '👕', '✈️', '📚', '🎬', '💰',
  '🏋️', '🎵', '🐕', '💻', '☕', '🍕', '🚌', '📱', '🎨', '⚡'
];

/**
 * CategoryManager
 *
 * Stateless with respect to the category list — it reads `categories` from the
 * prop (App global state) and writes back via `onUpdate`.  This guarantees
 * Profile and Budget always show the same list with zero duplication.
 *
 * Props:
 *   userId     — Supabase user id (for DB persistence)
 *   categories — { expense: [...], income: [...] }  ← single source of truth
 *   onClose    — close the modal
 *   onUpdate   — (updated) => void  — called after every successful save
 */
const CategoryManager = ({ userId, categories, onClose, onUpdate }) => {
  // UI-only state — never duplicates category data
  const [saving,          setSaving]          = useState(false);
  const [editMode,        setEditMode]        = useState(null); // `${type}-${index}` or null
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showIconPicker,  setShowIconPicker]  = useState(false);
  const [newCategory, setNewCategory] = useState({
    type:  'expense',
    label: '',
    color: DEFAULT_COLORS[0],
    icon:  DEFAULT_ICONS[0],
  });

  // Guard: if categories prop not yet loaded, show spinner
  if (!categories?.expense || !categories?.income) {
    return (
      <div className="category-manager-overlay">
        <div className="category-manager">
          <p>A carregar categorias...</p>
        </div>
      </div>
    );
  }

  // ── Persistence ────────────────────────────────────────────────────────────
  // Save to Supabase then call onUpdate so App propagates to all tabs.
  const persist = async (updated) => {
    setSaving(true);
    try {
      await dbService.updateUserSettings(userId, { custom_categories: updated });
      onUpdate?.(updated);
    } catch (error) {
      console.error('Error saving categories:', error);
      alert('Erro ao guardar categorias: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  // ── CRUD ───────────────────────────────────────────────────────────────────
  const handleAddCategory = async () => {
    const label = newCategory.label.trim();
    if (!label) { alert('Nome da categoria é obrigatório!'); return; }

    const id = label.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    const entry = { id, label, color: newCategory.color, icon: newCategory.icon };

    await persist({
      ...categories,
      [newCategory.type]: [...categories[newCategory.type], entry],
    });

    setNewCategory({ type: 'expense', label: '', color: DEFAULT_COLORS[0], icon: DEFAULT_ICONS[0] });
    setShowColorPicker(false);
    setShowIconPicker(false);
  };

  const handleEditCategory = async (type, index, updates) => {
    const updated = {
      ...categories,
      // immutable update — never mutate the prop array
      [type]: categories[type].map((cat, i) => i === index ? { ...cat, ...updates } : cat),
    };
    await persist(updated);
    setEditMode(null);
  };

  const handleDeleteCategory = async (type, index) => {
    if (!confirm('Tens a certeza que queres apagar esta categoria?')) return;
    const updated = {
      ...categories,
      [type]: categories[type].filter((_, i) => i !== index),
    };
    await persist(updated);
  };

  // ── Category row ───────────────────────────────────────────────────────────
  // Inner component keeps its own draft for the label input so we don't
  // call persist on every keypress.
  const CategoryItem = ({ category, type, index }) => {
    const isEditing = editMode === `${type}-${index}`;
    const [draft, setDraft] = useState(category.label);

    if (isEditing) {
      return (
        <div className="category-edit-row">
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="category-edit-input"
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleEditCategory(type, index, { label: draft });
              if (e.key === 'Escape') setEditMode(null);
            }}
            autoFocus
          />
          <div className="category-edit-controls">
            <button
              className="btn-color-pick"
              style={{ background: category.color }}
              title="Mudar cor"
              onClick={() => {
                const c = prompt('Escolhe uma cor (#hex):', category.color);
                if (c) handleEditCategory(type, index, { label: draft, color: c });
              }}
            />
            <button
              className="btn-icon-pick"
              title="Mudar ícone"
              onClick={() => {
                const ic = prompt('Escolhe um emoji:', category.icon);
                if (ic) handleEditCategory(type, index, { label: draft, icon: ic });
              }}
            >
              {category.icon}
            </button>
            <button
              className="btn-save-edit"
              onClick={() => handleEditCategory(type, index, { label: draft })}
              disabled={saving}
            >
              ✓
            </button>
            <button className="btn-cancel-edit" onClick={() => setEditMode(null)}>
              ✕
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="category-item">
        <div className="category-display">
          <span className="category-icon">{category.icon}</span>
          <span className="category-label">{category.label}</span>
          <div className="category-color-dot" style={{ background: category.color }} />
        </div>
        <div className="category-actions">
          <button
            className="btn-edit-category"
            onClick={() => setEditMode(`${type}-${index}`)}
          >
            ✏️
          </button>
          <button
            className="btn-delete-category"
            onClick={() => handleDeleteCategory(type, index)}
          >
            🗑️
          </button>
        </div>
      </div>
    );
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="category-manager-overlay">
      <div className="category-manager">
        <div className="category-manager-header">
          <h2>🏷️ Gerir Categorias</h2>
          <button className="btn-close" onClick={onClose}>✕</button>
        </div>

        <div className="category-manager-content">

          {/* ── Add New Category ─────────────────────────────────────────── */}
          <div className="add-category-section">
            <h3>➕ Adicionar Categoria</h3>
            <div className="add-category-form">
              <select
                value={newCategory.type}
                onChange={(e) => setNewCategory({ ...newCategory, type: e.target.value })}
              >
                <option value="expense">Despesa</option>
                <option value="income">Receita</option>
              </select>

              <input
                type="text"
                placeholder="Nome da categoria"
                value={newCategory.label}
                onChange={(e) => setNewCategory({ ...newCategory, label: e.target.value })}
                onKeyDown={(e) => { if (e.key === 'Enter') handleAddCategory(); }}
              />

              <button
                className="btn-color-selector"
                style={{ background: newCategory.color }}
                onClick={() => { setShowColorPicker(!showColorPicker); setShowIconPicker(false); }}
                title="Escolher cor"
              >
                Cor
              </button>

              <button
                className="btn-icon-selector"
                onClick={() => { setShowIconPicker(!showIconPicker); setShowColorPicker(false); }}
                title="Escolher ícone"
              >
                {newCategory.icon}
              </button>

              <button
                className="btn-add-category"
                onClick={handleAddCategory}
                disabled={saving}
              >
                {saving ? '...' : '✓ Adicionar'}
              </button>
            </div>

            {showColorPicker && (
              <div className="color-picker">
                {DEFAULT_COLORS.map(color => (
                  <button
                    key={color}
                    className="color-option"
                    style={{ background: color }}
                    onClick={() => { setNewCategory({ ...newCategory, color }); setShowColorPicker(false); }}
                  />
                ))}
              </div>
            )}

            {showIconPicker && (
              <div className="icon-picker">
                {DEFAULT_ICONS.map(icon => (
                  <button
                    key={icon}
                    className="icon-option"
                    onClick={() => { setNewCategory({ ...newCategory, icon }); setShowIconPicker(false); }}
                  >
                    {icon}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ── Expense Categories ────────────────────────────────────────── */}
          <div className="categories-section">
            <h3>💳 Categorias de Despesas ({categories.expense.length})</h3>
            <div className="categories-list">
              {categories.expense.map((cat, index) => (
                <CategoryItem
                  key={cat.id || index}
                  category={cat}
                  type="expense"
                  index={index}
                />
              ))}
            </div>
          </div>

          {/* ── Income Categories ─────────────────────────────────────────── */}
          <div className="categories-section">
            <h3>💰 Categorias de Receitas ({categories.income.length})</h3>
            <div className="categories-list">
              {categories.income.map((cat, index) => (
                <CategoryItem
                  key={cat.id || index}
                  category={cat}
                  type="income"
                  index={index}
                />
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default CategoryManager;
