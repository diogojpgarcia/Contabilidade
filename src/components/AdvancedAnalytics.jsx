import React, { useState } from 'react';
import {
  calculateMonthlyAverages,
  compareWithPreviousMonth,
  checkSpendingAlerts,
  calculateSavingsGoal,
  getMonthlyTrends
} from '../utils/financial-analysis';

const AdvancedAnalytics = ({ 
  currentMonthTransactions,
  allTransactions,
  currentMonthKey,
  currentIncome,
  currentExpenses,
  currentBalance
}) => {
  const [savingsGoal, setSavingsGoal] = useState(1000);
  const [showGoalInput, setShowGoalInput] = useState(false);

  // Calculate averages
  const averages = calculateMonthlyAverages(allTransactions, 6);
  
  // Compare with previous month
  const comparison = compareWithPreviousMonth(
    currentMonthTransactions,
    allTransactions,
    currentMonthKey
  );
  
  // Check alerts
  const alerts = checkSpendingAlerts(currentExpenses, averages.avgExpenses, 20);
  
  // Savings goal
  const goalProgress = calculateSavingsGoal(currentBalance, savingsGoal, currentIncome);
  
  // Monthly trends
  const trends = getMonthlyTrends(allTransactions, 6);

  return (
    <div className="advanced-analytics">
      <h2>📊 Análises Avançadas</h2>

      {/* Comparison Cards */}
      <div className="analytics-section">
        <h3>📈 Comparação com Mês Anterior</h3>
        <div className="comparison-cards">
          <div className="comparison-card">
            <div className="comparison-label">Receitas</div>
            <div className="comparison-values">
              <span className="current-value">+{currentIncome.toFixed(2)}€</span>
              <span className={`change-badge ${comparison.incomeChange >= 0 ? 'positive' : 'negative'}`}>
                {comparison.incomeChange >= 0 ? '↑' : '↓'} {Math.abs(comparison.incomeChange).toFixed(1)}%
              </span>
            </div>
            <div className="previous-value">
              Anterior: {comparison.prevIncome.toFixed(2)}€
            </div>
          </div>

          <div className="comparison-card">
            <div className="comparison-label">Despesas</div>
            <div className="comparison-values">
              <span className="current-value">-{currentExpenses.toFixed(2)}€</span>
              <span className={`change-badge ${comparison.expensesChange <= 0 ? 'positive' : 'negative'}`}>
                {comparison.expensesChange >= 0 ? '↑' : '↓'} {Math.abs(comparison.expensesChange).toFixed(1)}%
              </span>
            </div>
            <div className="previous-value">
              Anterior: {comparison.prevExpenses.toFixed(2)}€
            </div>
          </div>
        </div>
      </div>

      {/* Averages */}
      <div className="analytics-section">
        <h3>📊 Médias (últimos {averages.monthsAnalyzed} meses)</h3>
        <div className="averages-grid">
          <div className="average-item">
            <span className="average-label">Receita Média:</span>
            <span className="average-value income">+{averages.avgIncome.toFixed(2)}€</span>
          </div>
          <div className="average-item">
            <span className="average-label">Despesa Média:</span>
            <span className="average-value expense">-{averages.avgExpenses.toFixed(2)}€</span>
          </div>
          <div className="average-item">
            <span className="average-label">Saldo Médio:</span>
            <span className={`average-value ${averages.avgBalance >= 0 ? 'income' : 'expense'}`}>
              {averages.avgBalance >= 0 ? '+' : ''}{averages.avgBalance.toFixed(2)}€
            </span>
          </div>
        </div>
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="analytics-section">
          <h3>⚠️ Alertas</h3>
          <div className="alerts-container">
            {alerts.map((alert, index) => (
              <div key={index} className={`alert alert-${alert.type} alert-${alert.severity}`}>
                {alert.type === 'warning' ? '⚠️' : '✅'} {alert.message}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Savings Goal */}
      <div className="analytics-section">
        <h3>🎯 Objetivo de Poupança</h3>
        {!showGoalInput ? (
          <div className="goal-display">
            <div className="goal-amount">
              Meta: {savingsGoal.toFixed(2)}€
              <button 
                className="btn-edit-goal"
                onClick={() => setShowGoalInput(true)}
              >
                ✏️
              </button>
            </div>
            {goalProgress && (
              <>
                <div className="goal-progress-bar">
                  <div 
                    className="goal-progress-fill"
                    style={{ width: `${goalProgress.progress}%` }}
                  />
                </div>
                <div className="goal-stats">
                  <span>{goalProgress.progress.toFixed(1)}% atingido</span>
                  {!goalProgress.achieved && goalProgress.monthsToGoal && (
                    <span>~{goalProgress.monthsToGoal} meses restantes</span>
                  )}
                  {goalProgress.achieved && (
                    <span className="goal-achieved">✅ Meta atingida!</span>
                  )}
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="goal-input">
            <input
              type="number"
              value={savingsGoal}
              onChange={(e) => setSavingsGoal(parseFloat(e.target.value) || 0)}
              step="100"
              min="0"
            />
            <button onClick={() => setShowGoalInput(false)}>💾 Guardar</button>
          </div>
        )}
      </div>

      {/* Monthly Trends Chart */}
      {trends.length > 0 && (
        <div className="analytics-section">
          <h3>📈 Evolução (últimos {trends.length} meses)</h3>
          <div className="trends-chart">
            {trends.map(({ month, income, expenses, balance }) => (
              <div key={month} className="trend-month">
                <div className="trend-label">{month.substring(5)}/{month.substring(2, 4)}</div>
                <div className="trend-bars">
                  <div 
                    className="trend-bar income-bar"
                    style={{ height: `${(income / Math.max(...trends.map(t => t.income || 1))) * 100}%` }}
                    title={`Receitas: ${income.toFixed(2)}€`}
                  />
                  <div 
                    className="trend-bar expense-bar"
                    style={{ height: `${(expenses / Math.max(...trends.map(t => t.expenses || 1))) * 100}%` }}
                    title={`Despesas: ${expenses.toFixed(2)}€`}
                  />
                </div>
                <div className={`trend-balance ${balance >= 0 ? 'positive' : 'negative'}`}>
                  {balance >= 0 ? '+' : ''}{balance.toFixed(0)}€
                </div>
              </div>
            ))}
          </div>
          <div className="trends-legend">
            <div className="legend-item">
              <div className="legend-color income-color" />
              <span>Receitas</span>
            </div>
            <div className="legend-item">
              <div className="legend-color expense-color" />
              <span>Despesas</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdvancedAnalytics;
