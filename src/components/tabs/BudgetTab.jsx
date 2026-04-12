import React, { useState, useEffect } from 'react';
import { dbService } from '../../lib/supabase';
import './BudgetTab.css';

const BudgetTab = ({ user, transactions, currentMonth, categories }) => {
  const [budgets, setBudgets] = useState({});
  const [showTravelGoal, setShowTravelGoal] = useState(false);
  const [travelGoal, setTravelGoal] = useState({
    name: '',
    amount: 0,
    targetDate: '',
    currentSavings: 0
  });
  const [editingGoal, setEditingGoal] = useState(false);

  useEffect(() => {
    loadData();
  }, [user]);

  const loadData = async () => {
    try {
      const settings = await dbService.getUserSettings(user.id);
      if (settings?.category_budgets) {
        setBudgets(settings.category_budgets);
      }
      if (settings?.travel_goal) {
        setTravelGoal(settings.travel_goal);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  const saveBudget = async (categoryId, limit) => {
    try {
      const newBudgets = { ...budgets, [categoryId]: parseFloat(limit) };
      await dbService.updateUserSettings(user.id, {
        category_budgets: newBudgets
      });
      setBudgets(newBudgets);
    } catch (error) {
      console.error('Error saving budget:', error);
      alert('Erro ao guardar orçamento');
    }
  };

  const saveTravelGoal = async (goal) => {
    try {
      await dbService.updateUserSettings(user.id, {
        travel_goal: goal
      });
      setTravelGoal(goal);
      setEditingGoal(false);
    } catch (error) {
      console.error('Error saving travel goal:', error);
      alert('Erro ao guardar objetivo');
    }
  };

  const getCategorySpending = (categoryName) => {
    return transactions
      .filter(t => t.date.startsWith(currentMonth) && t.type === 'expense' && t.category === categoryName)
      .reduce((sum, t) => sum + parseFloat(t.amount), 0);
  };

  const handleLimitChange = (categoryId, value) => {
    if (value === '' || value === '0') {
      const newBudgets = { ...budgets };
      delete newBudgets[categoryId];
      dbService.updateUserSettings(user.id, { category_budgets: newBudgets });
      setBudgets(newBudgets);
    } else {
      saveBudget(categoryId, value);
    }
  };

  const calculateProgress = () => {
    if (travelGoal.amount <= 0) return 0;
    return Math.min((travelGoal.currentSavings / travelGoal.amount) * 100, 100);
  };

  const calculateDaysRemaining = () => {
    if (!travelGoal.targetDate) return null;
    const target = new Date(travelGoal.targetDate);
    const today = new Date();
    const diff = target - today;
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    return days > 0 ? days : 0;
  };

  const progress = calculateProgress();
  const daysRemaining = calculateDaysRemaining();
  const hasGoal = travelGoal.name && travelGoal.amount > 0;

  return (
    <div className="budget-tab">
      {/* Header with Travel Goal button */}
      <div className="budget-header">
        <div>
          <h2>Orçamentos</h2>
          <p>Limites mensais por categoria</p>
        </div>
        <button 
          className="travel-goal-btn"
          onClick={() => setShowTravelGoal(!showTravelGoal)}
        >
          <span className="sf-icon">✈︎</span>
          <span>Objetivo</span>
        </button>
      </div>

      {/* Travel Goal Section (collapsible) */}
      {showTravelGoal && (
        <div className="travel-goal-section">
          {!editingGoal && !hasGoal && (
            <div className="goal-empty">
              <span className="sf-icon-large">✈︎</span>
              <p>Cria um objetivo de viagem</p>
              <button className="btn-create-goal" onClick={() => setEditingGoal(true)}>
                Criar Objetivo
              </button>
            </div>
          )}

          {!editingGoal && hasGoal && (
            <div className="goal-display">
              <div className="goal-header-row">
                <h3>{travelGoal.name}</h3>
                <button className="btn-icon" onClick={() => setEditingGoal(true)}>
                  <span className="sf-icon">✏︎</span>
                </button>
              </div>

              <div className="goal-meta-row">
                <div className="meta-item">
                  <span className="meta-label">Meta</span>
                  <span className="meta-val">{travelGoal.amount.toFixed(0)}€</span>
                </div>
                {travelGoal.targetDate && (
                  <div className="meta-item">
                    <span className="meta-label">Data</span>
                    <span className="meta-val">
                      {new Date(travelGoal.targetDate).toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' })}
                    </span>
                  </div>
                )}
              </div>

              <div className="goal-progress-section">
                <div className="progress-bar-container">
                  <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
                </div>
                <div className="progress-text">
                  <span>{travelGoal.currentSavings.toFixed(0)}€</span>
                  <span className="progress-percent">{progress.toFixed(0)}%</span>
                </div>
              </div>

              {daysRemaining !== null && daysRemaining > 0 && (
                <div className="goal-days">
                  <span className="sf-icon">☀︎</span>
                  <span>{daysRemaining} dias restantes</span>
                </div>
              )}

              <div className="savings-input-row">
                <label>Poupado</label>
                <div className="input-group">
                  <input
                    type="number"
                    value={travelGoal.currentSavings}
                    onChange={(e) => {
                      const updated = { ...travelGoal, currentSavings: parseFloat(e.target.value) || 0 };
                      saveTravelGoal(updated);
                    }}
                    step="10"
                  />
                  <span>€</span>
                </div>
              </div>
            </div>
          )}

          {editingGoal && (
            <div className="goal-form">
              <input
                type="text"
                placeholder="Nome do objetivo"
                value={travelGoal.name}
                onChange={(e) => setTravelGoal({ ...travelGoal, name: e.target.value })}
                className="input-field"
              />
              <div className="form-row">
                <div className="input-group">
                  <input
                    type="number"
                    placeholder="Meta"
                    value={travelGoal.amount || ''}
                    onChange={(e) => setTravelGoal({ ...travelGoal, amount: parseFloat(e.target.value) || 0 })}
                    step="100"
                  />
                  <span>€</span>
                </div>
                <input
                  type="date"
                  value={travelGoal.targetDate}
                  onChange={(e) => setTravelGoal({ ...travelGoal, targetDate: e.target.value })}
                  className="input-field"
                />
              </div>
              <div className="form-actions">
                <button className="btn-secondary" onClick={() => setEditingGoal(false)}>
                  Cancelar
                </button>
                <button className="btn-primary" onClick={() => saveTravelGoal(travelGoal)}>
                  Guardar
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Category Budgets List */}
      <div className="budget-list">
        {categories.expense.map(cat => {
          const limit = budgets[cat.id] || 0;
          const spent = getCategorySpending(cat.name);
          const percentage = limit > 0 ? Math.min((spent / limit) * 100, 100) : 0;
          const isOver = spent > limit && limit > 0;
          const hasLimit = limit > 0;

          return (
            <div key={cat.id} className="budget-row">
              <div className="budget-category">
                <span className="cat-icon-sf">{cat.icon}</span>
                <span className="cat-name">{cat.name}</span>
              </div>

              <div className="budget-input-container">
                <input
                  type="number"
                  className="budget-input"
                  value={limit || ''}
                  onChange={(e) => handleLimitChange(cat.id, e.target.value)}
                  placeholder="0"
                  step="10"
                  min="0"
                />
                <span className="budget-currency">€/mês</span>
              </div>

              {hasLimit && (
                <div className="budget-progress-container">
                  <div className="budget-bar">
                    <div 
                      className={`budget-fill ${isOver ? 'over' : ''}`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  <div className="budget-stats">
                    <span className={`spent ${isOver ? 'over' : ''}`}>
                      {spent.toFixed(2)}€
                    </span>
                    <span className="separator">/</span>
                    <span className="limit">{limit.toFixed(2)}€</span>
                    <span className={`percentage ${isOver ? 'over' : ''}`}>
                      ({percentage.toFixed(0)}%)
                    </span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default BudgetTab;
