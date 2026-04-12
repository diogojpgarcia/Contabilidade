import React, { useState } from 'react';
import './StatsTab.css';

const StatsTab = ({ transactions, currentMonthTransactions, currentMonth, categories }) => {
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);

  // Icon mapping
  const getCategoryIcon = (categoryName) => {
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
    return iconMap[categoryName] || '◌';
  };

  // Calculate expenses by category for selected month
  const getExpensesByCategory = (month) => {
    const monthTransactions = transactions.filter(t => 
      t.date.startsWith(month) && t.type === 'expense'
    );

    const byCategory = {};
    monthTransactions.forEach(t => {
      byCategory[t.category] = (byCategory[t.category] || 0) + parseFloat(t.amount);
    });

    const total = Object.values(byCategory).reduce((sum, val) => sum + val, 0);
    
    return Object.entries(byCategory)
      .map(([category, amount]) => ({
        category,
        amount,
        percentage: total > 0 ? (amount / total) * 100 : 0
      }))
      .sort((a, b) => b.amount - a.amount);
  };

  // Get last 6 months for chart
  const getLast6Months = () => {
    const months = [];
    const [year, month] = currentMonth.split('-').map(Number);
    
    for (let i = 5; i >= 0; i--) {
      const date = new Date(year, month - 1 - i, 1);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      months.push(monthKey);
    }
    
    return months;
  };

  // Get monthly data for chart
  const getMonthlyData = () => {
    const months = getLast6Months();
    
    return months.map(month => {
      const monthTransactions = transactions.filter(t => t.date.startsWith(month));
      const income = monthTransactions
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + parseFloat(t.amount), 0);
      const expenses = monthTransactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + parseFloat(t.amount), 0);
      
      return {
        month: month.substring(5) + '/' + month.substring(2, 4),
        income,
        expenses,
        balance: income - expenses
      };
    });
  };

  // Navigate months
  const goToPreviousMonth = () => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const prevDate = new Date(year, month - 2, 1);
    const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
    setSelectedMonth(prevMonth);
  };

  const goToNextMonth = () => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const nextDate = new Date(year, month, 1);
    const nextMonth = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}`;
    setSelectedMonth(nextMonth);
  };

  const categoryData = getExpensesByCategory(selectedMonth);
  const monthlyData = getMonthlyData();
  const maxAmount = Math.max(...monthlyData.map(m => Math.max(m.income, m.expenses))) || 1;

  const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];

  return (
    <div className="stats-tab">
      {/* Evolution Chart */}
      <div className="stats-section">
        <h3 className="stats-title">Evolução (6 meses)</h3>
        <div className="evolution-chart">
          {monthlyData.map((data, index) => (
            <div key={index} className="chart-month">
              <div className="chart-bars">
                <div 
                  className="chart-bar income-bar"
                  style={{ height: `${(data.income / maxAmount) * 100}%` }}
                  title={`Receitas: ${data.income.toFixed(2)}€`}
                />
                <div 
                  className="chart-bar expense-bar"
                  style={{ height: `${(data.expenses / maxAmount) * 100}%` }}
                  title={`Despesas: ${data.expenses.toFixed(2)}€`}
                />
              </div>
              <div className="chart-month-label">{data.month}</div>
              <div className={`chart-balance ${data.balance >= 0 ? 'positive' : 'negative'}`}>
                {data.balance >= 0 ? '+' : ''}{data.balance.toFixed(0)}€
              </div>
            </div>
          ))}
        </div>
        <div className="chart-legend">
          <div className="legend-item">
            <div className="legend-color income-legend" />
            <span>Receitas</span>
          </div>
          <div className="legend-item">
            <div className="legend-color expense-legend" />
            <span>Despesas</span>
          </div>
        </div>
      </div>

      {/* Category Breakdown */}
      <div className="stats-section">
        <div className="category-header">
          <h3 className="stats-title">Gastos por Categoria</h3>
          <div className="month-selector">
            <button className="month-btn" onClick={goToPreviousMonth}>←</button>
            <span className="month-label">{selectedMonth}</span>
            <button className="month-btn" onClick={goToNextMonth}>→</button>
          </div>
        </div>

        {categoryData.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">◌</div>
            <p>Sem despesas neste mês</p>
          </div>
        ) : (
          <div className="category-breakdown">
            {categoryData.map((item, index) => (
              <div key={item.category} className="category-row">
                <div className="category-info">
                  <div 
                    className="category-color-indicator"
                    style={{ background: COLORS[index % COLORS.length] }}
                  />
                  <span className="category-name">{item.category}</span>
                </div>
                <div className="category-amount-info">
                  <span className="category-amount">{item.amount.toFixed(2)}€</span>
                  <span className="category-percent">{item.percentage.toFixed(1)}%</span>
                </div>
                <div className="category-bar-container">
                  <div 
                    className="category-bar"
                    style={{ 
                      width: `${item.percentage}%`,
                      background: COLORS[index % COLORS.length]
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default StatsTab;
