import React, { useState } from 'react';
import Overlay from './Overlay';
import { dbService } from '../lib/supabase';
import { useToast } from '../context/ToastContext';
import { CategoryIconBubble } from '../utils/categoryIcons';
import './CategoryManager.css';

const COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1',
  '#14b8a6', '#f43f5e', '#a855f7', '#22c55e', '#0ea5e9',
];

/**
 * CategoryManager
 *
 * Renders inside ProfileTab's <Overlay> bottom sheet — no extra wrapper needed.
 * Reads categories exclusively from the `categories` prop (App global state).
 * All mutations go through persist() → onUpdate() → App.setCategories.
 *
 * Icons are derived from the unified icon registry (getCategoryMeta) via
 * CategoryIconBubble — same icon family as Budget, Stats, History, Home.
 *
 * Props:
 *   userId     — Supabase user id
 *   categories — { expense: [...], income: [...] }  (App global state, REQUIRED)
 *   onClose    — close handler
 *   onUpdate   — (updated) => void  — propagates changes to App state
 */
const CategoryManager = ({ userId, categories, onClose, onUpdate }) => {
  const { showError } = useToast();
  // ── Tab ────────────────────────────────────────────────────────────────────
  const [confirmDeleteIdx, setConfirmDeleteIdx] = useState(null); // { index } or null
  const [activeTab, setActiveTab] = useState('expense');

  // ── Saving indicator ───────────────────────────────────────────────────────
  const [saving, setSaving] = useState(false);

  // ── Edit state — all parent-owned, no inner components with hooks ──────────
  const [editKey,        setEditKey]        = useState(null);
  const [editDraft,      setEditDraft]      = useState({ label: '', color: '' });
  const [showEditColors, setShowEditColors] = useState(false);

  // ── New-category form ──────────────────────────────────────────────────────
  const [newLabel,      setNewLabel]      = useState('');
  const [newColor,      setNewColor]      = useState(COLORS[0]);
  const [showNewColors, setShowNewColors] = useState(false);

  // ── Guard ─────────────────────────────────────────────────────────────────
  if (!categories?.expense || !categories?.income) return null;

  const list = categories[activeTab];

  // ── Persistence ────────────────────────────────────────────────────────────
  const persist = async (updated) => {
    setSaving(true);
    try {
      await dbService.updateUserSettings(userId, { custom_categories: updated });
      onUpdate?.(updated);
    } catch (err) {
      console.error('[CategoryManager] save error:', err);
      showError('Erro ao guardar: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  // ── Tab switch ─────────────────────────────────────────────────────────────
  const switchTab = (tab) => {
    setActiveTab(tab);
    setEditKey(null);
    setShowEditColors(false);
  };

  // ── Edit ───────────────────────────────────────────────────────────────────
  const startEdit = (index) => {
    const cat = categories[activeTab][index];
    setEditKey(`${activeTab}-${index}`);
    setEditDraft({ label: cat.label, color: cat.color || COLORS[0] });
    setShowEditColors(false);
  };

  const cancelEdit = () => {
    setEditKey(null);
    setShowEditColors(false);
  };

  const saveEdit = async (index) => {
    const label = editDraft.label.trim();
    if (!label) return;
    const updated = {
      ...categories,
      [activeTab]: categories[activeTab].map((cat, i) =>
        i === index
          ? { ...cat, label, color: editDraft.color }
          : cat
      ),
    };
    await persist(updated);
    setEditKey(null);
  };

  // ── Delete ─────────────────────────────────────────────────────────────────
  const handleDelete = (index) => {
    setConfirmDeleteIdx(index);
  };

  const handleDeleteConfirmed = async () => {
    if (confirmDeleteIdx === null) return;
    await persist({
      ...categories,
      [activeTab]: categories[activeTab].filter((_, i) => i !== confirmDeleteIdx),
    });
    setConfirmDeleteIdx(null);
  };

  // ── Add ────────────────────────────────────────────────────────────────────
  const handleAdd = async () => {
    const label = newLabel.trim();
    if (!label) return;
    const id = label.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    const entry = { id, label, color: newColor };
    await persist({
      ...categories,
      [activeTab]: [...categories[activeTab], entry],
    });
    setNewLabel('');
    setNewColor(COLORS[0]);
    setShowNewColors(false);
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
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
                  {/* Unified icon preview — auto-derived from the draft label */}
                  <CategoryIconBubble
                    name={editDraft.label || cat.label}
                    type={activeTab}
                    size={28}
                    radius="8px"
                  />
                  <button
                    className="cm-swatch-btn"
                    style={{ background: editDraft.color }}
                    onClick={() => setShowEditColors(!showEditColors)}
                    title="Mudar cor"
                  />
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
              </div>
            );
          }

          return (
            <div key={key} className="cm-row">
              {/* Unified icon bubble — same registry as Budget, Stats, History */}
              <CategoryIconBubble
                name={cat.label}
                type={activeTab}
                size={32}
                radius="9px"
              />
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
          {/* Unified icon preview — updates live as the user types the label */}
          <CategoryIconBubble
            name={newLabel || 'Outros'}
            type={activeTab}
            size={32}
            radius="9px"
          />
          <button
            className="cm-swatch-btn"
            style={{ background: newColor }}
            onClick={() => setShowNewColors(!showNewColors)}
            title="Cor"
          />
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
      </div>

    </div>
      {confirmDeleteIdx !== null && (
        <Overlay onClose={() => setConfirmDeleteIdx(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h4>Apagar categoria?</h4>
              <button className="modal-close" onClick={() => setConfirmDeleteIdx(null)}>×</button>
            </div>
            <div className="modal-body" style={{ padding: '0 0 8px' }}>
              <p style={{ marginBottom: 16, color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                {confirmDeleteIdx !== null && categories[activeTab]?.[confirmDeleteIdx] && (
                  <><strong>{categories[activeTab][confirmDeleteIdx].label}</strong> será apagada.</>
                )}
              </p>
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  style={{ flex: 1, padding: '10px', borderRadius: '10px', border: '1px solid var(--separator)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.875rem' }}
                  onClick={() => setConfirmDeleteIdx(null)}
                >Cancelar</button>
                <button
                  style={{ flex: 1, padding: '10px', borderRadius: '10px', border: 'none', background: 'var(--cosmos-expense)', color: '#fff', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.875rem', fontWeight: 600 }}
                  onClick={handleDeleteConfirmed}
                >Apagar</button>
              </div>
            </div>
          </div>
        </Overlay>
      )}
    </>
  );
};

export default CategoryManager;

