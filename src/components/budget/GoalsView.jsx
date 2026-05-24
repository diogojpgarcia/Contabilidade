import React, { useState, useEffect } from 'react';
import { useForm } from '../../hooks/useForm';
import { dbService } from '../../lib/supabase';
import Overlay from '../Overlay';
import GoalSavingsInput from './GoalSavingsInput';
import { useAppContext } from '../../context/AppContext';

const EMPTY_GOAL = { name: '', amount: '', targetDate: '', currentSavings: '' };

const GoalsView = () => {
  const { currentUser: user } = useAppContext();
  const [goals,         setGoals]         = useState([]);
  const [editingGoalId, setEditingGoalId] = useState(null);
  const { draft: newGoal, setField: setGoalField, reset: resetGoal } = useForm(EMPTY_GOAL);

  useEffect(() => { loadData(); }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadData = async () => {
    try {
      const settings = await dbService.getUserSettings(user.id);
      if (settings?.goals) setGoals(settings.goals);
    } catch (error) { console.error('Error loading data:', error); }
  };

  const saveGoals = async (updatedGoals) => {
    try {
      await dbService.updateUserSettings(user.id, { goals: updatedGoals });
      setGoals(updatedGoals);
    } catch (error) { console.error('Error saving goals:', error); alert('Erro ao guardar objetivos'); }
  };

  const handleAddGoal = () => {
    if (!newGoal.name || !newGoal.amount) { alert('Preenche nome e valor'); return; }
    const goal = {
      id: Date.now().toString(),
      ...newGoal,
      amount: parseFloat(newGoal.amount),
      currentSavings: parseFloat(newGoal.currentSavings) || 0,
    };
    saveGoals([...goals, goal]);
    resetGoal(EMPTY_GOAL);
  };

  // Called only from GoalSavingsInput.onBlur — never from onChange.
  const handleUpdateGoalSavings = (goalId, value) => {
    saveGoals(goals.map(g => g.id === goalId ? { ...g, currentSavings: parseFloat(value) || 0 } : g));
  };

  const handleDeleteGoal = async (goalId) => {
    if (!confirm('Apagar este objetivo?')) return;
    saveGoals(goals.filter(g => g.id !== goalId));
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
            return (
              <div key={goal.id} className="m-goal-row">
                <div className="m-goal-top">
                  <span className="m-goal-name">{goal.name}</span>
                  <button className="m-goal-del" onClick={() => handleDeleteGoal(goal.id)}>🗑</button>
                </div>
                <div className="m-goal-bar-bg">
                  <div className="m-goal-bar-fill" style={{ width: `${progress}%` }} />
                </div>
                <div className="m-goal-meta">
                  <span><strong>{(goal.currentSavings || 0).toFixed(0)}€</strong> / {goal.amount.toFixed(0)}€</span>
                  <span>{progress.toFixed(0)}%{remaining > 0 ? ` · faltam ${remaining.toFixed(0)}€` : ' ✓'}</span>
                </div>
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
