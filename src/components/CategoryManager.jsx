import React, { useState } from 'react';
import { dbService } from '../lib/supabase';
import './CategoryManager.css';

const COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1',
  '#14b8a6', '#f43f5e', '#a855f7', '#22c55e', '#0ea5e9',
];

/* Icon palette is derived at runtime from the live categories prop so it
   always matches the icons used everywhere else in the app.             */
const EXTRA_ICONS = [
  '⚡','🎯','🎁','🌱','✈️','🏋️','🎵','📱','💻','🎨',
  '🛍️','☕','🐕','🎬','🏦','⚽','💅','🎮','📚','🚌',
];

/**
 * CategoryManager
 *
 * Renders inside ProfileTab's <Overlay> bottom sheet — no extra wrapper needed.
 * Reads categories exclusively from the `categories` prop (App global state).
 * All mutations go through persist() → onUpdate() → App.setCategories.
 *
 * Props:
 *   userId     — Supabase user id
 *   categories — { expense: [...], income: [...] }  (App global state, REQUIRED)
 *   onClose    — close handler
 *   onUpdate   — (updated) => void  — propagates changes to App state
 */
const CategoryManager = ({ userId, categories, onClose, onUpdate }) => {
  // ── Tab ────────────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState('expense');

  // ── Saving indicator ───────────────────────────────────────────────────────
  const [saving, setSaving] = useState(false);

  // ── Edit state — all parent-owned, no inner components with hooks ──────────
  const [editKey,          setEditKey]          = useState(null);
  const [editDraft,        setEditDraft]        = useState({ label: '', color: '', icon: '' });
  const [showEditColors,   setShowEditColors]   = useState(false);
  const [showEditIcons,    setShowEditIcons]    = useState(false);

  // ── New-category form ──────────────────────────────────────────────────────
  const [newLabel,         setNewLabel]         = useState('');
  const [newColor,         setNewColor]         = useState(COLORS[0]);
  const [newIcon,          setNewIcon]          = useState('🏠');
  const [showNewColors,    setShowNewColors]    = useState(false);
  const [showNewIcons,     setShowNewIcons]     = useState(false);

  // ── Guard ─────────────────────────────────────────────────────────────────
  if (!categories?.expense || !categories?.income) return null;

  const list = categories[activeTab];

  // ── Icon palette — real icons from global state first, then extras ─────────
  const iconPalette = [
    ...new Set([
      ...categories.expense.map(c => c.icon),
      ...categories.income.map(c => c.icon),
      ...EXTRA_ICONS,
    ].filter(Boolean)),
  ];

  // ── Persistence ────────────────────────────────────────────────────────────
  const persist = async (updated) => {
    setSaving(true);
    try {
      await dbService.updateUserSettings(userId, { custom_categories: updated });
      onUpdate?.(updated);
    } catch (err) {
      console.error('[CategoryManager] save error:', err);
      alert('Erro ao guardar: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  // ── Tab switch ─────────────────────────────────────────────────────────────
  const switchTab = (tab) => {
    setActiveTab(tab);
    setEditKey(null);
    setShowEditColors(false);
    setShowEditIcons(false);
  };

  // ── Edit ───────────────────────────────────────────────────────────────────
  const startEdit = (index) => {
    const cat = categories[activeTab][index];
    setEditKey(`${activeTab}-${index}`);
    setEditDraft({ label: cat.label, color: cat.color || COLORS[0], icon: cat.icon || '📦' });
    setShowEditColors(false);
    setShowEditIcons(false);
  };

  const cancelEdit = () => {
    setEditKey(null);
    setShowEditColors(false);
    setShowEditIcons(false);
  };

  const saveEdit = async (index) => {
    const label = editDraft.label.trim();
    if (!label) return;
    const updated = {
      ...categories,
      [activeTab]: categories[activeTab].map((cat, i) =>
        i === index
          ? { ...cat, label, color: editDraft.color, icon: editDraft.icon }
          : cat
      ),
    };
    await persist(updated);
    setEditKey(null);
  };

  // ── Delete ─────────────────────────────────────────────────────────────────
  const handleDelete = async (index) => {
    if (!confirm('Apagar esta categoria?')) return;
    await persist({
      ...categories,
      [activeTab]: categories[activeTab].filter((_, i) => i !== index),
    });
  };

  // ── Add ────────────────────────────────────────────────────────────────────
  const handleAdd = async () => {
    const label = newLabel.trim();
    if (!label) return;
    const id = label.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    const entry = { id, label, color: newColor, icon: newIcon };
    await persist({
      ...categories,
      [activeTab]: [...categories[activeTab], entry],
    });
    setNewLabel('');
    setNewColor(COLORS[0]);
    setNewIcon(iconPalette[0] ?? '🏠');
    setShowNewColors(false);
    setShowNewIcons(false);
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="cm-sheet">

      {/* ── Header ── */}
      <div className="cm-handle-bar" />
      <div className="cm-header">
        <span className="cm-title">Gerir Categorias</span>
        <button className="cm-close" onClick={onClose} aria-label="Fechar">✕</button>
      </div>

      {/* ── Tabs ── */}
      <div className="cm-tabs">
        <button
          className={`cm-tab${activeTab === 'expense' ? ' cm-tab--on' : ''}`}
          onClick={() => switchTab('expense')}
        >
          💳 Despesas <span className="cm-tab-count">{categories.expense.length}</span>
        </button>
        <button
          className={`cm-tab${activeTab === 'income' ? ' cm-tab--on' : ''}`}
          onClick={() => switchTab('income')}
        >
          💰 Receitas <span className="cm-tab-count">{categories.income.length}</span>
        </button>
      </div>

      {/* ── Category list ── */}
      <div className="cm-list">
        {list.length === 0 && (
          <p className="cm-empty">Sem categorias. Adiciona uma abaixo.</p>
        )}

        {list.map((cat, index) => {
          const key = `${activeTab}-${index}`;
          const isEditing = editKey === key;

          if (isEditing) {
            return (
              <div key={key} className="cm-row cm-row--edit">
                {/* Edit controls */}
                <div className="cm-edit-line">
                  <button
                    className="cm-swatch-btn"
                    style={{ background: editDraft.color }}
                    onClick={() => { setShowEditColors(!showEditColors); setShowEditIcons(false); }}
                    title="Mudar cor"
                  />
                  <button
                    className="cm-icon-btn"
                    onClick={() => { setShowEditIcons(!showEditIcons); setShowEditColors(false); }}
                    title="Mudar ícone"
                  >
                    {editDraft.icon}
                  </button>
                  <input
                    className="cm-edit-input"
                    value={editDraft.label}
                    onChange={e => setEditDraft({ ...editDraft, label: e.target.value })}
                    onKeyDown={e => {
                      if (e.key === 'Enter')  saveEdit(index);
                      if (e.key === 'Escape') cancelEdit();
                    }}
                    autoFocus
                  />
                  <button className="cm-save-btn" onClick={() => saveEdit(index)} disabled={saving}>✓</button>
                  <button className="cm-cancel-btn" onClick={cancelEdit}>✕</button>
                </div>

                {/* Inline colour picker */}
                {showEditColors && (
                  <div className="cm-picker-row">
                    {COLORS.map(c => (
                      <button
                        key={c}
                        className={`cm-dot${editDraft.color === c ? ' cm-dot--on' : ''}`}
                        style={{ background: c }}
                        onClick={() => { setEditDraft({ ...editDraft, color: c }); setShowEditColors(false); }}
                      />
                    ))}
                  </div>
                )}

                {/* Inline icon picker */}
                {showEditIcons && (
                  <div className="cm-picker-row cm-picker-row--icons">
                    {iconPalette.map(ic => (
                      <button
                        key={ic}
                        className={`cm-emoji-btn${editDraft.icon === ic ? ' cm-emoji-btn--on' : ''}`}
                        onClick={() => { setEditDraft({ ...editDraft, icon: ic }); setShowEditIcons(false); }}
                      >
                        {ic}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          }

          return (
            <div key={key} className="cm-row">
              <div className="cm-row-swatch" style={{ background: cat.color || '#9ca3af' }} />
              <span className="cm-row-icon">{cat.icon || '📦'}</span>
              <span className="cm-row-label">{cat.label}</span>
              <div className="cm-row-actions">
                <button
                  className="cm-edit-btn"
                  onClick={() => startEdit(index)}
                  aria-label="Editar"
                >✏️</button>
                <button
                  className="cm-del-btn"
                  onClick={() => handleDelete(index)}
                  aria-label="Apagar"
                >🗑️</button>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Add new category ── */}
      <div className="cm-add">
        <p className="cm-add-label">
          Nova categoria de {activeTab === 'expense' ? 'despesa' : 'receita'}
        </p>
        <div className="cm-add-line">
          <button
            className="cm-swatch-btn"
            style={{ background: newColor }}
            onClick={() => { setShowNewColors(!showNewColors); setShowNewIcons(false); }}
            title="Cor"
          />
          <button
            className="cm-icon-btn"
            onClick={() => { setShowNewIcons(!showNewIcons); setShowNewColors(false); }}
            title="Ícone"
          >
            {newIcon}
          </button>
          <input
            className="cm-add-input"
            placeholder="Nome da categoria…"
            value={newLabel}
            onChange={e => setNewLabel(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
          />
          <button
            className="cm-add-btn"
            onClick={handleAdd}
            disabled={saving || !newLabel.trim()}
          >
            {saving ? '…' : '＋'}
          </button>
        </div>

        {showNewColors && (
          <div className="cm-picker-row">
            {COLORS.map(c => (
              <button
                key={c}
                className={`cm-dot${newColor === c ? ' cm-dot--on' : ''}`}
                style={{ background: c }}
                onClick={() => { setNewColor(c); setShowNewColors(false); }}
              />
            ))}
          </div>
        )}

        {showNewIcons && (
          <div className="cm-picker-row cm-picker-row--icons">
            {iconPalette.map(ic => (
              <button
                key={ic}
                className={`cm-emoji-btn${newIcon === ic ? ' cm-emoji-btn--on' : ''}`}
                onClick={() => { setNewIcon(ic); setShowNewIcons(false); }}
              >
                {ic}
              </button>
            ))}
          </div>
        )}
      </div>

    </div>
  );
};

export default CategoryManager;
