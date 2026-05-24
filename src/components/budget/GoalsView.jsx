import React, { useState } from 'react';
import { useForm } from '../../hooks/useForm';
import Overlay from '../Overlay';
import GoalSavingsInput from './GoalSavingsInput';
import { useToast } from '../../context/ToastContext';

const EMPTY_GOAL = { name: '', amount: '', targetDate: '', currentSavings: '' };

/** Formata "2026-06-15" → "15 Jun 2026" e calcula dias restantes. */
const formatTargetDate = (dateStr) => {
  if (!dateStr) return null;
  const target = new Date(dateStr + 'T00:00:00');
  if (isNaN(target.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.round((target - today) / 86400000);
  const label = target.toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' });
  if (diffDays < 0)  return { label, badge: `${Math.abs(diffDays)}d em atraso`, past: true };
  if (diffDays === 0) return { label, badge: 'hoje', past: false };
  return { label, badge: `${diffDays}d restantes`, past: false };
};

/**
 * GoalsView — componente puro: recebe goals + onGoalsChange, sem fetch próprio.
 * A persistência é gerida pelo useSettings (boot atómico, fonte única de verdade).
 *
 * Props:
 *   goals          — array de objetivos (vem do useSettings via BudgetTab)
 *   onGoalsChange  — (updatedGoals) => void  (persiste e atualiza estado global)
 */
const GoalsView = ({ goals = [], onGoalsChange }) => {
  const { showWarning } = useToast();
  const [editingGoalId, setEditingGoalId] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const { draft: newGoal, setField: setGoalField, reset: resetGoal } = useForm(EMPTY_GOAL);

  const handleAddGoal = () => {
    if (!newGoal.name || !newGoal.amount) { showWarning('Preenche nome e valor.'); return; }
    const goal = {
      id: Date.now().toString(),
      ...newGoal,
      amount: parseFloat(newGoal.amount),
      currentSavings: parseFloat(newGoal.currentSavings) || 0,
    };
    onGoalsChange?.([...goals, goal]);
    resetGoal(EMPTY_GOAL);
  };

  // Called only from GoalSavingsInput.onBlur — never from onChange.
  const handleUpdateGoalSavings = (goalId, value) => {
    onGoalsChange?.(goals.map(g => g.id === goalId ? { ...g, currentSavings: parseFloat(value) || 0 } : g));
  };

  const handleDeleteGoal = (goalId) => {
    onGoalsChange?.(goals.filter(g => g.id !== goalId));
    setConfirmDeleteId(null);
  };

  return (
    <>
      <div className="m-list">
        {goals.length === 0 ? (
          <div className="m-empty">Sem objetivos criados</div>
        ) : (
          goals.map(goal => {
            const progress  = goal.amount > 0 ? Math.min((goal.currentSavings / goal.amount) * 100, 100) : 0;
            const remaining = goal.amount - (goal.currentSavings || 0);
            const dateInfo = formatTargetDate(goal.targetDate);
            return (
              <div key={goal.id} className="m-goal-row">
                <div className="m-goal-top">
                  <span className="m-goal-name">{goal.name}</span>
                  <button className="m-goal-del" onClick={() => setConfirmDeleteId(goal.id)}>🗑</button>
                </div>
                <div className="m-goal-bar-bg">
                  <div className="m-goal-bar-fill" style={{ width: `${progress}%` }} />
                </div>
                <div className="m-goal-meta">
                  <span><strong>{(goal.currentSavings || 0).toFixed(0)}€</strong> / {goal.amount.toFixed(0)}€</span>
                  <span>{progress.toFixed(0)}%{remaining > 0 ? ` · faltam ${remaining.toFixed(0)}€` : ' ✓'}</span>
                </div>
                {dateInfo && (
                  <div className="m-goal-date">
                    <span className="m-goal-date-label">📅 {dateInfo.label}</span>
                    <span className={`m-goal-date-badge${dateInfo.past ? ' past' : ''}`}>{dateInfo.badge}</span>
                  </div>
                )}
                <div className="m-goal-input-row">
                  <span className="m-goal-input-label">Poupado</span>
                  <GoalSavingsInput
                    key={goal.id}
                    goal={goal}
                    onSave={handleUpdateGoalSavings}
                    className="m-goal-savings-input"
                  />
                  <span className="m-budget-unit">€</span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* FAB */}
      <button className="m-fab" onClick={() => setEditingGoalId('new')}>+</button>

      {/* Delete confirmation modal */}
      {confirmDeleteId && (
        <Overlay onClose={() => setConfirmDeleteId(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h4>Apagar objetivo?</h4>
              <button className="modal-close" onClick={() => setConfirmDeleteId(null)}>×</button>
            </div>
            <div className="modal-body" style={{ padding: '0 0 8px' }}>
              <p style={{ marginBottom: 16, color: 'var(--text-secondary)' }}>
                Esta ação não pode ser revertida.
              </p>
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  style={{ flex: 1, padding: '10px', borderRadius: '10px', border: '1px solid var(--separator)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.875rem' }}
                  onClick={() => setConfirmDeleteId(null)}
                >Cancelar</button>
                <button
                  style={{ flex: 1, padding: '10px', borderRadius: '10px', border: 'none', background: '#ef4444', color: '#fff', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.875rem', fontWeight: 600 }}
                  onClick={() => handleDeleteGoal(confirmDeleteId)}
                >Apagar</button>
              </div>
            </div>
          </div>
        </Overlay>
      )}

      {/* Add goal modal */}
      {editingGoalId && (
        <Overlay onClose={() => { setEditingGoalId(null); resetGoal(EMPTY_GOAL); }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h4>Novo Objetivo</h4>
              <button className="modal-close" onClick={() => { setEditingGoalId(null); resetGoal(EMPTY_GOAL); }}>×</button>
            </div>
            <div className="goal-form">
              <input type="text"   className="goal-input" placeholder="Nome do objetivo"
                value={newGoal.name}       onChange={(e) => setGoalField('name',       e.target.value)} />
              <input type="number" className="goal-input" placeholder="Valor (€)"
                value={newGoal.amount || ''} onChange={(e) => setGoalField('amount',     e.target.value)} />
              <div className="date-input-wrapper">
                <input type="date" className="goal-input date-input"
                  value={newGoal.targetDate} onChange={(e) => setGoalField('targetDate', e.target.value)} />
                <span className="calendar-icon">◷</span>
              </div>
              <button className="btn-add-goal" onClick={() => { handleAddGoal(); setEditingGoalId(null); }}>Adicionar</button>
            </div>
          </div>
        </Overlay>
      )}
    </>
  );
};

export default GoalsView;
