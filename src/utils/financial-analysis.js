/**
 * Financial Analysis Engine
 * Calculates metrics, trends, and provides smart suggestions
 */

import { getMonthKey, formatCurrency } from './data';

/**
 * Calculate comprehensive financial metrics for a period
 */
export const calculateFinancialMetrics = (transactions, monthKey) => {
  const monthTransactions = transactions.filter(t => getMonthKey(t.date) === monthKey);
  
  const income = monthTransactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);
  
  const expenses = monthTransactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);
  
  const balance = income - expenses;
  const savingsRate = income > 0 ? ((balance / income) * 100) : 0;
  
  return {
    income,
    expenses,
    balance,
    savingsRate,
    monthKey
  };
};

/**
 * Calculate category breakdown for expenses
 */
export const calculateCategoryBreakdown = (transactions, monthKey) => {
  const monthExpenses = transactions.filter(
    t => getMonthKey(t.date) === monthKey && t.type === 'expense'
  );
  
  const breakdown = {};
  monthExpenses.forEach(t => {
    if (!breakdown[t.category]) {
      breakdown[t.category] = { total: 0, count: 0, transactions: [] };
    }
    breakdown[t.category].total += t.amount;
    breakdown[t.category].count += 1;
    breakdown[t.category].transactions.push(t);
  });
  
  return breakdown;
};

/**
 * Calculate trends over last N months
 */
export const calculateTrends = (transactions, currentMonthKey, monthsBack = 6) => {
  const [year, month] = currentMonthKey.split('-').map(Number);
  const trends = [];
  
  for (let i = monthsBack - 1; i >= 0; i--) {
    const date = new Date(year, month - 1 - i, 1);
    const monthKey = getMonthKey(date.toISOString());
    const metrics = calculateFinancialMetrics(transactions, monthKey);
    trends.push(metrics);
  }
  
  return trends;
};

/**
 * Calculate average spending by category over N months
 */
export const calculateCategoryAverages = (transactions, currentMonthKey, monthsBack = 3) => {
  const trends = calculateTrends(transactions, currentMonthKey, monthsBack);
  const categoryTotals = {};
  
  trends.forEach(trend => {
    const breakdown = calculateCategoryBreakdown(transactions, trend.monthKey);
    Object.entries(breakdown).forEach(([catId, data]) => {
      if (!categoryTotals[catId]) {
        categoryTotals[catId] = { total: 0, months: 0 };
      }
      categoryTotals[catId].total += data.total;
      categoryTotals[catId].months += 1;
    });
  });
  
  const averages = {};
  Object.entries(categoryTotals).forEach(([catId, data]) => {
    averages[catId] = data.total / data.months;
  });
  
  return averages;
};

/**
 * Detect spending anomalies (spending significantly above average)
 */
export const detectAnomalies = (transactions, currentMonthKey) => {
  const currentBreakdown = calculateCategoryBreakdown(transactions, currentMonthKey);
  const averages = calculateCategoryAverages(transactions, currentMonthKey, 3);
  const anomalies = [];
  
  Object.entries(currentBreakdown).forEach(([catId, data]) => {
    const average = averages[catId] || 0;
    if (average > 0) {
      const percentChange = ((data.total - average) / average) * 100;
      if (percentChange > 25) { // 25% above average
        anomalies.push({
          category: catId,
          current: data.total,
          average: average,
          percentChange: percentChange
        });
      }
    }
  });
  
  return anomalies.sort((a, b) => b.percentChange - a.percentChange);
};

/**
 * Generate smart savings suggestions
 */
export const generateSmartSuggestions = (transactions, currentMonthKey) => {
  const metrics = calculateFinancialMetrics(transactions, currentMonthKey);
  const anomalies = detectAnomalies(transactions, currentMonthKey);
  const breakdown = calculateCategoryBreakdown(transactions, currentMonthKey);
  const suggestions = [];
  
  // Suggestion 1: High spending alert
  if (anomalies.length > 0) {
    const top = anomalies[0];
    suggestions.push({
      type: 'warning',
      category: top.category,
      title: 'Gasto Acima da Média',
      message: `Este mês gastou ${top.percentChange.toFixed(0)}% mais em ${top.category} que a média (${formatCurrency(top.average)}).`,
      potentialSaving: top.current - top.average
    });
  }
  
  // Suggestion 2: Low savings rate
  if (metrics.savingsRate < 10 && metrics.income > 0) {
    suggestions.push({
      type: 'info',
      title: 'Taxa de Poupança Baixa',
      message: `Está a poupar apenas ${metrics.savingsRate.toFixed(1)}%. Recomenda-se 20% do rendimento.`,
      potentialSaving: (metrics.income * 0.20) - metrics.balance
    });
  }
  
  // Suggestion 3: Category optimization (find biggest expense category)
  const sortedCategories = Object.entries(breakdown)
    .sort(([, a], [, b]) => b.total - a.total);
  
  if (sortedCategories.length > 0 && sortedCategories[0][1].total > metrics.expenses * 0.35) {
    const [catId, data] = sortedCategories[0];
    suggestions.push({
      type: 'tip',
      category: catId,
      title: 'Maior Categoria de Gasto',
      message: `${catId} representa ${((data.total / metrics.expenses) * 100).toFixed(0)}% das suas despesas. Considere otimizar aqui.`,
      potentialSaving: data.total * 0.10 // 10% reduction
    });
  }
  
  // Suggestion 4: Positive reinforcement
  if (metrics.savingsRate > 20) {
    suggestions.push({
      type: 'success',
      title: 'Excelente Poupança!',
      message: `Está a poupar ${metrics.savingsRate.toFixed(1)}% do rendimento. Continue assim! 🎉`,
      potentialSaving: 0
    });
  }
  
  return suggestions.slice(0, 3); // Max 3 suggestions
};

/**
 * Calculate savings goal progress
 */
export const calculateSavingsGoalProgress = (transactions, goalAmount, startDate) => {
  const relevantTransactions = transactions.filter(
    t => new Date(t.date) >= new Date(startDate)
  );
  
  const totalIncome = relevantTransactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);
  
  const totalExpenses = relevantTransactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);
  
  const currentSavings = totalIncome - totalExpenses;
  const progress = goalAmount > 0 ? (currentSavings / goalAmount) * 100 : 0;
  
  return {
    goalAmount,
    currentSavings,
    remaining: goalAmount - currentSavings,
    progress: Math.min(progress, 100),
    achieved: currentSavings >= goalAmount
  };
};
