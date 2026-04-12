import React, { useState, useEffect } from 'react';
import { dbService } from '../lib/supabase';

const DEFAULT_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1'
];

const DEFAULT_ICONS = [
  '🏠', '🍔', '🚗', '💊', '🎮', '👕', '✈️', '📚', '🎬', '💰',
  '🏋️', '🎵', '🐕', '💻', '☕', '🍕', '🚌', '📱', '🎨', '⚡'
];

const CategoryManager = ({ userId, onClose, onUpdate }) => {
  const [categories, setCategories] = useState({ expense: [], income: [] });
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(null);
  const [newCategory, setNewCategory] = useState({
    type: 'expense',
    label: '',
    id: '',
    color: DEFAULT_COLORS[0],
    icon: DEFAULT_ICONS[0]
  });
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showIconPicker, setShowIconPicker] = useState(false);

  useEffect(() => {
    loadCategories();
  }, [userId]);

  const loadCategories = async () => {
    try {
      setLoading(true);
      const settings = await dbService.getUserSettings(userId);
      
      if (settings?.custom_categories) {
        setCategories(settings.custom_categories);
      } else {
        // Load default categories
        const { CATEGORIES_EXPENSE, CATEGORIES_INCOME } = await import('../utils/categories-professional');
        setCategories({
          expense: CATEGORIES_EXPENSE,
          income: CATEGORIES_INCOME
        });
      }
    } catch (error) {
      console.error('Error loading categories:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveCategories = async (newCategories) => {
    try {
      await dbService.updateUserSettings(userId, {
        custom_categories: newCategories
      });
      setCategories(newCategories);
      onUpdate?.(newCategories);
      return true;
    } catch (error) {
      console.error('Error saving categories:', error);
      alert('Erro ao guardar categorias: ' + error.message);
      return false;
    }
  };

  const handleAddCategory = async () => {
    if (!newCategory.label.trim()) {
      alert('Nome da categoria é obrigatório!');
      return;
    }

    const id = newCategory.label.toLowerCase().replace(/\s+/g, '_');
    const categoryObj = {
      id,
      label: newCategory.label,
      color: newCategory.color,
      icon: newCategory.icon
    };

    const updated = {
      ...categories,
      [newCategory.type]: [...categories[newCategory.type], categoryObj]
    };

    const success = await saveCategories(updated);
    if (success) {
      setNewCategory({
        type: 'expense',
        label: '',
        id: '',
        color: DEFAULT_COLORS[0],
        icon: DEFAULT_ICONS[0]
      });
    }
  };

  const handleEditCategory = async (type, index, updates) => {
    const updated = { ...categories };
    updated[type][index] = { ...updated[type][index], ...updates };
    await saveCategories(updated);
    setEditMode(null);
  };

  const handleDeleteCategory = async (type, index) => {
    if (!confirm('Tens a certeza que queres apagar esta categoria?')) return;

    const updated = { ...categories };
    updated[type].splice(index, 1);
    await saveCategories(updated);
  };

  const CategoryItem = ({ category, type, index }) => {
    const isEditing = editMode === `${type}-${index}`;

    if (isEditing) {
      return (
        <div className="category-edit-row">
          <input
            type="text"
            value={category.label}
            onChange={(e) => handleEditCategory(type, index, { label: e.target.value })}
            className="category-edit-input"
          />
          <div className="category-edit-controls">
            <button
              className="btn-color-pick"
              style={{ background: category.color }}
              onClick={() => {
                const newColor = prompt('Escolhe uma cor (#hex):', category.color);
                if (newColor) handleEditCategory(type, index, { color: newColor });
              }}
            />
            <button
              className="btn-icon-pick"
              onClick={() => {
                const newIcon = prompt('Escolhe um emoji:', category.icon);
                if (newIcon) handleEditCategory(type, index, { icon: newIcon });
              }}
            >
              {category.icon}
            </button>
            <button
              className="btn-save-edit"
              onClick={() => setEditMode(null)}
            >
              ✓
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
          <div
            className="category-color-dot"
            style={{ background: category.color }}
          />
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

  if (loading) {
    return (
      <div className="category-manager-overlay">
        <div className="category-manager">
          <p>A carregar categorias...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="category-manager-overlay">
      <div className="category-manager">
        <div className="category-manager-header">
          <h2>🏷️ Gerir Categorias</h2>
          <button className="btn-close" onClick={onClose}>✕</button>
        </div>

        <div className="category-manager-content">
          {/* Add New Category */}
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
              />

              <button
                className="btn-color-selector"
                style={{ background: newCategory.color }}
                onClick={() => setShowColorPicker(!showColorPicker)}
              >
                Cor
              </button>

              <button
                className="btn-icon-selector"
                onClick={() => setShowIconPicker(!showIconPicker)}
              >
                {newCategory.icon}
              </button>

              <button
                className="btn-add-category"
                onClick={handleAddCategory}
              >
                ✓ Adicionar
              </button>
            </div>

            {/* Color Picker */}
            {showColorPicker && (
              <div className="color-picker">
                {DEFAULT_COLORS.map(color => (
                  <button
                    key={color}
                    className="color-option"
                    style={{ background: color }}
                    onClick={() => {
                      setNewCategory({ ...newCategory, color });
                      setShowColorPicker(false);
                    }}
                  />
                ))}
              </div>
            )}

            {/* Icon Picker */}
            {showIconPicker && (
              <div className="icon-picker">
                {DEFAULT_ICONS.map(icon => (
                  <button
                    key={icon}
                    className="icon-option"
                    onClick={() => {
                      setNewCategory({ ...newCategory, icon });
                      setShowIconPicker(false);
                    }}
                  >
                    {icon}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Expense Categories */}
          <div className="categories-section">
            <h3>💳 Categorias de Despesas</h3>
            <div className="categories-list">
              {categories.expense.map((cat, index) => (
                <CategoryItem
                  key={cat.id}
                  category={cat}
                  type="expense"
                  index={index}
                />
              ))}
            </div>
          </div>

          {/* Income Categories */}
          <div className="categories-section">
            <h3>💰 Categorias de Receitas</h3>
            <div className="categories-list">
              {categories.income.map((cat, index) => (
                <CategoryItem
                  key={cat.id}
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
