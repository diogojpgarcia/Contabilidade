import React from 'react';
import { formatCurrency } from '../utils/data';

const FinancialOverview = ({ metrics, savingsGoal }) => {
  const savingsRateColor = metrics.savingsRate >= 20 ? '#34d399' : 
                           metrics.savingsRate >= 10 ? '#fbbf24' : '#ef4444';
  
  return (
    <div className="financial-overview">
      <div className="overview-card">
        <div className="overview-label">Taxa de Poupança</div>
        <div className="overview-value" style={{ color: savingsRateColor }}>
          {metrics.savingsRate.toFixed(1)}%
        </div>
        <div className="overview-hint">
          {metrics.savingsRate >= 20 ? 'Excelente!' : 
           metrics.savingsRate >= 10 ? 'Razoável' : 'Pode melhorar'}
        </div>
      </div>
      
      {savingsGoal && (
        <div className="overview-card">
          <div className="overview-label">Meta de Poupança</div>
          <div className="overview-value">
            {formatCurrency(savingsGoal.currentSavings)}
          </div>
          <div className="savings-progress">
            <div className="progress-bar">
              <div 
                className="progress-fill" 
                style={{ width: `${savingsGoal.progress}%` }}
              />
            </div>
            <div className="progress-text">
              {savingsGoal.progress.toFixed(0)}% de {formatCurrency(savingsGoal.goalAmount)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FinancialOverview;
