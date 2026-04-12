import React, { useState, useEffect } from 'react';
import { dbService } from '../../lib/supabase';
import './BudgetTab.css';

const BudgetTab = ({ user, transactions, currentMonth, categories }) => {
  const [budgets, setBudgets] = useState({});
  const [editingCategory, setEditingCategory] = useState(null);
  const [editValue, setEditValue] = useState('');

  useEffect(() => {
    loadBudgets();
  }, [user]);

  const loadBudgets = async () => {
    try {
      const settings = await dbService.getUserSettings(user.id);
      if (settings?.category_budgets) {
        setBudgets(settings.category_budgets);
      }
    } catch (error) {
      console.error('Error loading budgets:', error);
    }
  };

  const saveBudget = async (categoryId, limit) => {
    try {
      const newBudgets = { ...budgets, [categoryId]: parseFloat(limit) };
      await dbService.updateUserSettings(user.id, {
        category_budgets: newBudgets
      });
      setBudgets(newBudgets);
      setEditingCategory(null);
      setEditValue('');
    } catch (error) {
      console.error('Error saving budget:', error);
      alert('Erro ao guardar orçamento: ' + error.message);
    }
  };

  const removeBudget = async (categoryId) => {
    if (!confirm('Remover este orçamento?')) return;
    
    try {
      const newBudgets = { ...budgets };
      delete newBudgets[categoryId];
      await dbService.updateUserSettings(user.id, {
        category_budgets: newBudgets
      });
      setBudgets(newBudgets);
    } catch (error) {
      console.error('Error removing budget:', error);
      alert('Erro ao remover orçamento: ' + error.message);
    }
  };

  const getCategorySpending = (categoryName) => {
    return transactions
      .filter(t => t.date.startsWith(currentMonth) && t.type === 'expense' && t.category === categoryName)
      .reduce((sum, t) => sum + parseFloat(t.amount), 0);
  };

  const handleStartEdit = (categoryId, currentLimit) => {
    setEditingCategory(categoryId);
    setEditValue(currentLimit?.toString() || '');
  };

  const handleSaveEdit = (categoryId) => {
    const value = parseFloat(editValue);
    if (isNaN(value) || value <= 0) {
      alert('Valor inválido!');
      return;
    }
    saveBudget(categoryId, value);
  };

  const categoriesWithBudgets = categories.expense.filter(cat => budgets[cat.id]);
  const categoriesWithoutBudgets = categories.expense.filter(cat => !budgets[cat.id]);

  return (
    <div className="budget-tab">
      <div className="budget-header">
        <h2 className="budget-title">💰 Orçamentos Mensais</h2>
        <p className="budget-subtitle">Defina limites de gastos por categoria</p>
      </div>

      {/* Categories with budgets */}
      {categoriesWithBudgets.length > 0 && (
        <div className="budget-section">
          <h3 className="section-label">Orçamentos Ativos</h3>
          <div className="budget-list">
            {categoriesWithBudgets.map(cat => {
              const limit = budgets[cat.id];
              const spent = getCategorySpending(cat.name);
              const percentage = limit > 0 ? (spent / limit) * 100 : 0;
              const isOver = percentage > 100;
              const remaining = limit - spent;

              return (
                <div key={cat.id} className={`budget-card ${isOver ? 'over-budget' : ''}`}>
                  <div className="budget-card-header">
                    <div className="budget-category-info">
                      <span className="budget-icon">{cat.icon}</span>
                      <span className="budget-category-name">{cat.name}</span>
                    </div>
                    <button 
                      className="btn-remove"
                      onClick={() => removeBudget(cat.id)}
                      title="Remover orçamento"
                    >
                      ✕
                    </button>
                  </div>

                  {editingCategory === cat.id ? (
                    <div className="budget-edit-form">
                      <div className="edit-input-group">
                        <input
                          type="number"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          placeholder="Limite mensal"
                          step="10"
                          min="0"
                          autoFocus
                        />
                        <span className="currency">€/mês</span>
                      </div>
                      <div className="edit-actions">
                        <button 
                          className="btn-cancel"
                          onClick={() => setEditingCategory(null)}
                        >
                          Cancelar
                        </button>
                        <button 
                          className="btn-save"
                          onClick={() => handleSaveEdit(cat.id)}
                        >
                          ✓ Guardar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="budget-limit-row">
                        <span className="budget-limit-label">Limite:</span>
                        <span className="budget-limit-value">{limit.toFixed(2)}€/mês</span>
                        <button 
                          className="btn-edit"
                          onClick={() => handleStartEdit(cat.id, limit)}
                        >
                          ✏️
                        </button>
                      </div>

                      <div className="budget-progress">
                        <div className="budget-progress-bar">
                          <div 
                            className={`budget-progress-fill ${isOver ? 'over' : ''}`}
                            style={{ width: `${Math.min(percentage, 100)}%` }}
                          />
                        </div>
                        <div className="budget-progress-text">
                          {spent.toFixed(2)}€ ({percentage.toFixed(1)}%)
                        </div>
                      </div>

                      <div className={`budget-status ${isOver ? 'over' : 'under'}`}>
                        {isOver ? (
                          <>
                            <span className="status-icon">⚠️</span>
                            <span className="status-text">
                              Excesso: <strong>{Math.abs(remaining).toFixed(2)}€</strong>
                            </span>
                          </>
                        ) : (
                          <>
                            <span className="status-icon">✓</span>
                            <span className="status-text">
                              Resta: <strong>{remaining.toFixed(2)}€</strong>
                            </span>
                          </>
                        )}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Categories without budgets */}
      {categoriesWithoutBudgets.length > 0 && (
        <div className="budget-section">
          <h3 className="section-label">Adicionar Orçamento</h3>
          <div className="add-budget-grid">
            {categoriesWithoutBudgets.map(cat => (
              <button
                key={cat.id}
                className="add-budget-card"
                onClick={() => handleStartEdit(cat.id, null)}
              >
                <span className="add-budget-icon">{cat.icon}</span>
                <span className="add-budget-name">{cat.name}</span>
                <span className="add-budget-plus">+</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {categoriesWithBudgets.length === 0 && (
        <div className="empty-budgets">
          <div className="empty-icon">💰</div>
          <p className="empty-text">Ainda não tens orçamentos definidos</p>
          <p className="empty-hint">Clica numa categoria abaixo para começar</p>
        </div>
      )}
    </div>
  );
};

export default BudgetTab;
