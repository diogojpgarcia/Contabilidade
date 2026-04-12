import React, { useState, useEffect } from 'react';
import { dbService } from '../../lib/supabase';
import './BudgetTab.css';

const BudgetTab = ({ user, transactions, currentMonth, categories }) => {
  const [budgets, setBudgets] = useState({});

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
    } catch (error) {
      console.error('Error saving budget:', error);
      alert('Erro ao guardar orçamento: ' + error.message);
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

  return (
    <div className="budget-tab">
      <div className="budget-header">
        <h2>💰 Orçamentos por Categoria</h2>
        <p>Define o gasto máximo mensal para cada categoria</p>
      </div>

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
                <span className="cat-icon">{cat.icon}</span>
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

              {!hasLimit && (
                <div className="budget-empty">
                  <span>Sem limite definido</span>
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
