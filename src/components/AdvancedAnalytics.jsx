import React from 'react';
import { formatCurrency, getCategoryById, MONTHS_SHORT } from '../utils/data';

const AdvancedAnalytics = ({ trends, categoryBreakdown, averages, onClose }) => {
  return (
    <div className="analytics-overlay" onClick={onClose}>
      <div className="analytics-modal" onClick={(e) => e.stopPropagation()}>
        <div className="analytics-header">
          <h2>📊 Análise Avançada</h2>
          <button onClick={onClose} className="btn-close">×</button>
        </div>
        
        <div className="analytics-content">
          {/* Trends Chart */}
          <section className="analytics-section">
            <h3>Evolução (6 meses)</h3>
            <div className="trends-chart">
              {trends.map((trend, index) => {
                const [year, month] = trend.monthKey.split('-').map(Number);
                const monthName = MONTHS_SHORT[month - 1];
                const maxValue = Math.max(...trends.map(t => Math.max(t.income, t.expenses)));
                
                return (
                  <div key={index} className="trend-bar">
                    <div className="trend-label">{monthName}</div>
                    <div className="trend-bars">
                      <div 
                        className="bar income" 
                        style={{ height: `${(trend.income / maxValue) * 100}px` }}
                        title={formatCurrency(trend.income)}
                      />
                      <div 
                        className="bar expense" 
                        style={{ height: `${(trend.expenses / maxValue) * 100}px` }}
                        title={formatCurrency(trend.expenses)}
                      />
                    </div>
                    <div className="trend-value">{formatCurrency(trend.balance)}</div>
                  </div>
                );
              })}
            </div>
            <div className="chart-legend">
              <span className="legend-item"><span className="dot income"></span> Receitas</span>
              <span className="legend-item"><span className="dot expense"></span> Despesas</span>
            </div>
          </section>
          
          {/* Category Averages */}
          <section className="analytics-section">
            <h3>Médias por Categoria (3 meses)</h3>
            <div className="category-averages">
              {Object.entries(averages)
                .sort(([, a], [, b]) => b - a)
                .map(([catId, avg]) => {
                  const category = getCategoryById(catId, 'expense');
                  const current = categoryBreakdown[catId]?.total || 0;
                  const diff = current - avg;
                  const diffPercent = avg > 0 ? (diff / avg) * 100 : 0;
                  
                  return (
                    <div key={catId} className="avg-item">
                      <div className="avg-category">
                        <span style={{ color: category.color }}>{category.icon}</span>
                        {category.label}
                      </div>
                      <div className="avg-values">
                        <div className="avg-current">{formatCurrency(current)}</div>
                        <div className={`avg-diff ${diff > 0 ? 'negative' : 'positive'}`}>
                          {diff > 0 ? '+' : ''}{formatCurrency(diff)} ({diffPercent.toFixed(0)}%)
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default AdvancedAnalytics;
