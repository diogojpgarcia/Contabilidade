import React, { useState } from 'react';
import { formatCurrency, getCategoryById } from '../utils/data';

const ProfessionalDashboard = ({ metrics, transactions, currentMonth, categoryBreakdown }) => {
  const [activeChart, setActiveChart] = useState('pie'); // pie, bars, trends

  // Calculate data for pie chart
  const getPieChartData = () => {
    const sorted = Object.entries(categoryBreakdown)
      .sort(([, a], [, b]) => b.total - a.total)
      .slice(0, 8); // Top 8 categories

    const total = sorted.reduce((sum, [, data]) => sum + data.total, 0);
    
    return sorted.map(([catId, data]) => {
      const category = getCategoryById(catId, 'expense');
      return {
        id: catId,
        label: category.label,
        value: data.total,
        percentage: (data.total / total) * 100,
        color: category.color,
        icon: category.icon
      };
    });
  };

  // Calculate monthly evolution (last 6 months)
  const getMonthlyEvolution = () => {
    const [year, month] = currentMonth.split('-').map(Number);
    const months = [];
    
    for (let i = 5; i >= 0; i--) {
      const date = new Date(year, month - 1 - i, 1);
      const monthKey = date.toISOString().slice(0, 7);
      const monthName = date.toLocaleDateString('pt-PT', { month: 'short' });
      
      const monthTransactions = transactions.filter(t => t.date.startsWith(monthKey));
      const income = monthTransactions
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + t.amount, 0);
      const expenses = monthTransactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + t.amount, 0);
      
      months.push({
        month: monthName,
        income,
        expenses,
        balance: income - expenses
      });
    }
    
    return months;
  };

  const pieData = getPieChartData();
  const evolutionData = getMonthlyEvolution();
  const maxValue = Math.max(...evolutionData.map(m => Math.max(m.income, m.expenses)));

  return (
    <div className="professional-dashboard">
      {/* Chart Type Selector */}
      <div className="chart-selector">
        <button
          className={`chart-btn ${activeChart === 'pie' ? 'active' : ''}`}
          onClick={() => setActiveChart('pie')}
        >
          📊 Distribuição
        </button>
        <button
          className={`chart-btn ${activeChart === 'bars' ? 'active' : ''}`}
          onClick={() => setActiveChart('bars')}
        >
          📈 Evolução
        </button>
      </div>

      {/* Pie Chart */}
      {activeChart === 'pie' && pieData.length > 0 && (
        <div className="chart-container">
          <h3>Distribuição de Despesas</h3>
          <div className="pie-chart">
            <svg viewBox="0 0 200 200" className="pie-svg">
              {(() => {
                let currentAngle = 0;
                return pieData.map((item, index) => {
                  const angle = (item.percentage / 100) * 360;
                  const startAngle = currentAngle;
                  currentAngle += angle;
                  
                  // Convert to radians
                  const startRad = (startAngle - 90) * (Math.PI / 180);
                  const endRad = (currentAngle - 90) * (Math.PI / 180);
                  
                  // Calculate path
                  const x1 = 100 + 90 * Math.cos(startRad);
                  const y1 = 100 + 90 * Math.sin(startRad);
                  const x2 = 100 + 90 * Math.cos(endRad);
                  const y2 = 100 + 90 * Math.sin(endRad);
                  
                  const largeArc = angle > 180 ? 1 : 0;
                  
                  const pathData = [
                    `M 100 100`,
                    `L ${x1} ${y1}`,
                    `A 90 90 0 ${largeArc} 1 ${x2} ${y2}`,
                    'Z'
                  ].join(' ');
                  
                  return (
                    <path
                      key={index}
                      d={pathData}
                      fill={item.color}
                      opacity="0.9"
                      stroke="var(--bg-primary)"
                      strokeWidth="2"
                    >
                      <title>{item.label}: {formatCurrency(item.value)} ({item.percentage.toFixed(1)}%)</title>
                    </path>
                  );
                });
              })()}
            </svg>
          </div>

          <div className="pie-legend">
            {pieData.map((item, index) => (
              <div key={index} className="legend-item">
                <div className="legend-color" style={{ backgroundColor: item.color }}></div>
                <div className="legend-info">
                  <div className="legend-label">
                    {item.icon} {item.label}
                  </div>
                  <div className="legend-value">
                    {formatCurrency(item.value)} ({item.percentage.toFixed(1)}%)
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bar Chart - Monthly Evolution */}
      {activeChart === 'bars' && (
        <div className="chart-container">
          <h3>Evolução (6 meses)</h3>
          <div className="bar-chart">
            {evolutionData.map((month, index) => (
              <div key={index} className="bar-group">
                <div className="bar-label">{month.month}</div>
                <div className="bars">
                  <div className="bar-wrapper">
                    <div
                      className="bar income"
                      style={{ height: `${(month.income / maxValue) * 120}px` }}
                      title={`Receitas: ${formatCurrency(month.income)}`}
                    ></div>
                  </div>
                  <div className="bar-wrapper">
                    <div
                      className="bar expense"
                      style={{ height: `${(month.expenses / maxValue) * 120}px` }}
                      title={`Despesas: ${formatCurrency(month.expenses)}`}
                    ></div>
                  </div>
                </div>
                <div className="bar-value">
                  {formatCurrency(month.balance)}
                </div>
              </div>
            ))}
          </div>
          <div className="chart-legend-horizontal">
            <span className="legend-h-item">
              <span className="dot income"></span> Receitas
            </span>
            <span className="legend-h-item">
              <span className="dot expense"></span> Despesas
            </span>
          </div>
        </div>
      )}

      {/* Quick Stats */}
      <div className="quick-stats">
        <div className="stat-card">
          <div className="stat-icon">📊</div>
          <div className="stat-content">
            <div className="stat-label">Categorias Ativas</div>
            <div className="stat-value">{Object.keys(categoryBreakdown).length}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">💳</div>
          <div className="stat-content">
            <div className="stat-label">Transações</div>
            <div className="stat-value">
              {transactions.filter(t => t.date.startsWith(currentMonth)).length}
            </div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">💰</div>
          <div className="stat-content">
            <div className="stat-label">Gasto Médio</div>
            <div className="stat-value">
              {formatCurrency(
                metrics.expenses > 0 && Object.keys(categoryBreakdown).length > 0
                  ? metrics.expenses / Object.keys(categoryBreakdown).length
                  : 0
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfessionalDashboard;
