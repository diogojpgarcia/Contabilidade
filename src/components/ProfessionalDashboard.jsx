import React from 'react';

const ProfessionalDashboard = ({ 
  income, 
  expenses, 
  balance, 
  transactions,
  categories 
}) => {
  // Calcular despesas por categoria
  const expensesByCategory = transactions
    .filter(t => t.type === 'expense')
    .reduce((acc, t) => {
      acc[t.category] = (acc[t.category] || 0) + parseFloat(t.amount);
      return acc;
    }, {});

  // Top 5 categorias
  const topCategories = Object.entries(expensesByCategory)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 5);

  // Calcular percentagem de cada categoria
  const categoryPercentages = topCategories.map(([cat, amount]) => ({
    category: cat,
    amount,
    percentage: ((amount / expenses) * 100).toFixed(1)
  }));

  // Taxa de poupança
  const savingsRate = income > 0 ? ((balance / income) * 100).toFixed(1) : 0;

  // Cores para categorias (palette profissional)
  const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

  return (
    <div className="professional-dashboard">
      {/* Cards de Resumo */}
      <div className="dashboard-cards">
        <div className="stat-card income-card">
          <div className="stat-icon">💰</div>
          <div className="stat-content">
            <div className="stat-label">Receitas</div>
            <div className="stat-value">+{income.toFixed(2)}€</div>
          </div>
        </div>

        <div className="stat-card expense-card">
          <div className="stat-icon">💳</div>
          <div className="stat-content">
            <div className="stat-label">Despesas</div>
            <div className="stat-value">-{expenses.toFixed(2)}€</div>
          </div>
        </div>

        <div className={`stat-card balance-card ${balance >= 0 ? 'positive' : 'negative'}`}>
          <div className="stat-icon">{balance >= 0 ? '📈' : '📉'}</div>
          <div className="stat-content">
            <div className="stat-label">Saldo</div>
            <div className="stat-value">
              {balance >= 0 ? '+' : ''}{balance.toFixed(2)}€
            </div>
          </div>
        </div>

        <div className="stat-card savings-card">
          <div className="stat-icon">🎯</div>
          <div className="stat-content">
            <div className="stat-label">Taxa Poupança</div>
            <div className="stat-value">{savingsRate}%</div>
          </div>
        </div>
      </div>

      {/* Top Categorias */}
      {topCategories.length > 0 && (
        <div className="top-categories">
          <h3>🔥 Top Categorias</h3>
          <div className="category-list">
            {categoryPercentages.map(({ category, amount, percentage }, index) => (
              <div key={category} className="category-item">
                <div className="category-info">
                  <div 
                    className="category-dot" 
                    style={{ backgroundColor: colors[index] }}
                  />
                  <span className="category-name">{category}</span>
                </div>
                <div className="category-stats">
                  <span className="category-amount">{amount.toFixed(2)}€</span>
                  <span className="category-percentage">{percentage}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Gráfico de Pizza Simples (CSS) */}
      {topCategories.length > 0 && (
        <div className="expense-chart">
          <h3>📊 Distribuição de Despesas</h3>
          <div className="pie-chart">
            {categoryPercentages.map(({ category, percentage }, index) => (
              <div key={category} className="pie-slice-info">
                <div className="pie-legend">
                  <div 
                    className="pie-color" 
                    style={{ backgroundColor: colors[index] }}
                  />
                  <span>{category}</span>
                </div>
                <div className="pie-bar-container">
                  <div 
                    className="pie-bar"
                    style={{ 
                      width: `${percentage}%`,
                      backgroundColor: colors[index]
                    }}
                  />
                  <span className="pie-label">{percentage}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Resumo Transações */}
      <div className="transaction-summary">
        <div className="summary-item">
          <span className="summary-label">Total Transações:</span>
          <span className="summary-value">{transactions.length}</span>
        </div>
        <div className="summary-item">
          <span className="summary-label">Média por Transação:</span>
          <span className="summary-value">
            {transactions.length > 0 
              ? (expenses / transactions.filter(t => t.type === 'expense').length).toFixed(2)
              : '0.00'}€
          </span>
        </div>
      </div>
    </div>
  );
};

export default ProfessionalDashboard;
