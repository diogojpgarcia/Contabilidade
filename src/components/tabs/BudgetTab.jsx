import React, { useState, useEffect } from 'react';
import { dbService } from '../../lib/supabase';
import './BudgetTab.css';

const BudgetTab = ({ user, transactions, currentMonth, categories }) => {
  const [budgets, setBudgets] = useState({});
  const [activeView, setActiveView] = useState('budgets'); // 'budgets' or 'goals'
  const [goals, setGoals] = useState([]);
  const [editingGoalId, setEditingGoalId] = useState(null);
  const [newGoal, setNewGoal] = useState({
    name: '',
    amount: 0,
    targetDate: '',
    currentSavings: 0
  });

  // Icon mapping
  const getCategoryIcon = (category) => {
    const iconMap = {
      'Alimentação': '⚑',
      'Habitação': '⌂',
      'Transporte': '⚐',
      'Saúde': '✚',
      'Lazer': '◉',
      'Educação': '⊞',
      'Roupa': '◫',
      'Tecnologia': '◧',
      'Subscrições': '◉',
      'Outros': '◌'
    };
    
    const categoryLabel = typeof category === 'string' ? category : category?.label;
    return iconMap[categoryLabel] || '◌';
  };

  useEffect(() => {
    loadData();
  }, [user]);

  const loadData = async () => {
    try {
      const settings = await dbService.getUserSettings(user.id);
      console.log('[BudgetTab] Settings loaded:', settings);
      
      if (settings?.category_budgets) {
        console.log('[BudgetTab] Budgets from DB:', settings.category_budgets);
        setBudgets(settings.category_budgets);
      } else {
        console.log('[BudgetTab] No budgets in DB, starting empty');
        setBudgets({});
      }
      
      if (settings?.goals) {
        setGoals(settings.goals);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  const saveBudgetToDb = async (categoryId) => {
    try {
      // Convert empty string to 0 for DB
      const cleanedBudgets = Object.entries(budgets).reduce((acc, [key, val]) => {
        acc[key] = val === '' ? 0 : val;
        return acc;
      }, {});
      
      console.log('[BudgetTab] Saving budget:', { categoryId, budgetValue: cleanedBudgets[categoryId], allBudgets: cleanedBudgets });
      
      // Save to DB
      await dbService.updateUserSettings(user.id, {
        category_budgets: cleanedBudgets
      });
      
      console.log('[BudgetTab] Budget saved successfully');
      
      const finalValue = cleanedBudgets[categoryId];
      if (finalValue && finalValue > 0) {
        alert('✓ Orçamento guardado!');
      } else {
        alert('✓ Orçamento removido!');
      }
    } catch (error) {
      console.error('Error saving budget:', error);
      alert('Erro ao guardar orçamento');
    }
  };

  const saveGoals = async (updatedGoals) => {
    try {
      await dbService.updateUserSettings(user.id, {
        goals: updatedGoals
      });
      setGoals(updatedGoals);
    } catch (error) {
      console.error('Error saving goals:', error);
      alert('Erro ao guardar objetivos');
    }
  };

  const handleAddGoal = () => {
    if (!newGoal.name || !newGoal.amount) {
      alert('Preenche nome e valor');
      return;
    }

    const goal = {
      id: Date.now().toString(),
      ...newGoal,
      amount: parseFloat(newGoal.amount),
      currentSavings: parseFloat(newGoal.currentSavings) || 0
    };

    const updatedGoals = [...goals, goal];
    saveGoals(updatedGoals);

    setNewGoal({ name: '', amount: 0, targetDate: '', currentSavings: 0 });
  };

  const handleUpdateGoalSavings = async (goalId, value) => {
    const updatedGoals = goals.map(g => 
      g.id === goalId ? { ...g, currentSavings: parseFloat(value) || 0 } : g
    );
    saveGoals(updatedGoals);
  };

  const handleDeleteGoal = async (goalId) => {
    if (!confirm('Apagar este objetivo?')) return;
    
    const updatedGoals = goals.filter(g => g.id !== goalId);
    saveGoals(updatedGoals);
  };

  const handleLimitChange = (categoryId, value) => {
    console.log('[BudgetTab] Input change:', { categoryId, value, type: typeof value });
    
    // Keep empty string as-is, or parse to number
    const newValue = value === '' ? '' : (parseFloat(value) || 0);
    
    console.log('[BudgetTab] New value:', newValue);
    
    setBudgets(prev => {
      const updated = {
        ...prev,
        [categoryId]: newValue
      };
      console.log('[BudgetTab] Updated budgets state:', updated);
      return updated;
    });
  };

  // Calculate spent per category
  const getSpentByCategory = (categoryId) => {
    const categoryName = categories.expense.find(c => c.id === categoryId)?.label;
    return transactions
      .filter(t => t.type === 'expense' && t.category === categoryName && t.date.startsWith(currentMonth))
      .reduce((sum, t) => sum + parseFloat(t.amount), 0);
  };

  return (
    <div className="budget-tab">
      <div className="budget-header">
        <h2>Orçamento</h2>
        <p>Gestão financeira</p>
      </div>

      {/* View Toggle */}
      <div className="view-toggle">
        <button
          className={`toggle-btn ${activeView === 'budgets' ? 'active' : ''}`}
          onClick={() => setActiveView('budgets')}
        >
          <span className="sf-icon">◈</span>
          <span>Orçamentos</span>
        </button>
        <button
          className={`toggle-btn ${activeView === 'goals' ? 'active' : ''}`}
          onClick={() => setActiveView('goals')}
        >
          <span className="sf-icon">◆</span>
          <span>Objetivos</span>
        </button>
      </div>

      {/* Budgets View */}
      {activeView === 'budgets' && (
        <div className="budgets-section">
          <h3>Limites Mensais</h3>
          <div className="categories-budgets">
            {categories.expense.map(cat => {
              const limit = budgets[cat.id] || 0;
              const spent = getSpentByCategory(cat.id);
              const hasLimit = limit > 0;
              const percentage = hasLimit ? (spent / limit) * 100 : 0;
              const isOver = percentage > 100;

              return (
                <div key={cat.id} className="budget-category">
                  <div className="category-header">
                    <span className="category-icon">{getCategoryIcon(cat.label)}</span>
                    <span className="category-name">{cat.label}</span>
                  </div>

                  <div className="budget-input-row">
                    <input
                      type="number"
                      inputMode="decimal"
                      className="budget-input"
                      value={limit || ''}
                      onChange={(e) => handleLimitChange(cat.id, e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          saveBudgetToDb(cat.id);
                          e.target.blur();
                        }
                      }}
                      placeholder="0"
                      step="10"
                      min="0"
                    />
                    <span className="budget-currency">€/mês</span>
                    {limit > 0 && (
                      <button 
                        className="budget-save-btn"
                        onClick={() => saveBudgetToDb(cat.id)}
                        title="Guardar orçamento"
                      >
                        ✓
                      </button>
                    )}
                  </div>

                  {hasLimit && (
                    <div className="budget-progress-container">
                      <div className="budget-bar">
                        <div 
                          className={`budget-fill ${isOver ? 'over' : ''}`}
                          style={{ width: `${Math.min(percentage, 100)}%` }}
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
      )}

      {/* Goals View */}
      {activeView === 'goals' && (
        <div className="goals-section">
          <h3>Meus Objetivos</h3>
          
          {/* Goals List */}
          {goals.length === 0 ? (
            <div className="empty-state">
              <span className="sf-icon-large">◆</span>
              <p>Sem objetivos criados</p>
            </div>
          ) : (
            <div className="goals-list">
              {goals.map(goal => {
                const progress = goal.amount > 0 ? (goal.currentSavings / goal.amount) * 100 : 0;
                const remaining = goal.amount - goal.currentSavings;
                
                let daysRemaining = null;
                if (goal.targetDate) {
                  const target = new Date(goal.targetDate);
                  const today = new Date();
                  daysRemaining = Math.ceil((target - today) / (1000 * 60 * 60 * 24));
                }

                return (
                  <div key={goal.id} className="goal-card">
                    <div className="goal-header-row">
                      <h4>{goal.name}</h4>
                      <button 
                        className="btn-delete-goal"
                        onClick={() => handleDeleteGoal(goal.id)}
                        title="Apagar objetivo"
                      >
                        🗑️
                      </button>
                    </div>

                    <div className="goal-meta">
                      <div className="meta-item">
                        <span className="meta-label">Meta</span>
                        <span className="meta-value">{goal.amount.toFixed(0)}€</span>
                      </div>
                      {goal.targetDate && (
                        <div className="meta-item">
                          <span className="meta-label">Data</span>
                          <span className="meta-value">
                            {new Date(goal.targetDate).toLocaleDateString('pt-PT', { 
                              day: 'numeric', 
                              month: 'short',
                              year: 'numeric'
                            })}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="goal-progress">
                      <div className="progress-bar-container">
                        <div 
                          className="progress-bar-fill" 
                          style={{ width: `${Math.min(progress, 100)}%` }}
                        />
                      </div>
                      <div className="progress-text">
                        <span>{goal.currentSavings.toFixed(0)}€</span>
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
                          value={goal.currentSavings || ''}
                          onChange={(e) => handleUpdateGoalSavings(goal.id, e.target.value)}
                          step="10"
                          min="0"
                          placeholder="0"
                        />
                        <span>€</span>
                      </div>
                    </div>

                    {remaining > 0 && (
                      <div className="goal-remaining">
                        Faltam <strong>{remaining.toFixed(0)}€</strong>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Floating Add Button (only in goals view) */}
      {activeView === 'goals' && (
        <button 
          className="floating-add-btn"
          onClick={() => setEditingGoalId('new')}
          title="Novo objetivo"
        >
          +
        </button>
      )}

      {/* Add/Edit Goal Modal */}
      {editingGoalId && (
        <div className="modal-overlay" onClick={() => setEditingGoalId(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h4>Novo Objetivo</h4>
              <button className="modal-close" onClick={() => setEditingGoalId(null)}>×</button>
            </div>
            <div className="goal-form">
              <input
                type="text"
                className="goal-input"
                placeholder="Nome do objetivo"
                value={newGoal.name}
                onChange={(e) => setNewGoal({ ...newGoal, name: e.target.value })}
              />
              <input
                type="number"
                className="goal-input"
                placeholder="Valor (€)"
                value={newGoal.amount || ''}
                onChange={(e) => setNewGoal({ ...newGoal, amount: e.target.value })}
              />
              <div className="date-input-wrapper">
                <input
                  type="date"
                  className="goal-input date-input"
                  value={newGoal.targetDate}
                  onChange={(e) => setNewGoal({ ...newGoal, targetDate: e.target.value })}
                  placeholder="Data alvo"
                />
                <span className="calendar-icon">◷</span>
              </div>
              <button className="btn-add-goal" onClick={() => {
                handleAddGoal();
                setEditingGoalId(null);
              }}>
                Adicionar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BudgetTab;
