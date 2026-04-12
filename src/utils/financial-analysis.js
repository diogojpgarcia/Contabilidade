/**
 * Financial Analysis Utilities
 */

/**
 * Calculate monthly averages for the last N months
 */
export const calculateMonthlyAverages = (transactions, months = 6) => {
  const monthlyData = {};
  
  transactions.forEach(t => {
    const monthKey = t.date.substring(0, 7); // YYYY-MM
    if (!monthlyData[monthKey]) {
      monthlyData[monthKey] = { income: 0, expenses: 0 };
    }
    
    if (t.type === 'income') {
      monthlyData[monthKey].income += parseFloat(t.amount);
    } else {
      monthlyData[monthKey].expenses += parseFloat(t.amount);
    }
  });
  
  const sortedMonths = Object.keys(monthlyData).sort().slice(-months);
  const avgIncome = sortedMonths.reduce((sum, m) => sum + monthlyData[m].income, 0) / sortedMonths.length;
  const avgExpenses = sortedMonths.reduce((sum, m) => sum + monthlyData[m].expenses, 0) / sortedMonths.length;
  
  return {
    avgIncome: avgIncome || 0,
    avgExpenses: avgExpenses || 0,
    avgBalance: (avgIncome - avgExpenses) || 0,
    monthsAnalyzed: sortedMonths.length
  };
};

/**
 * Compare current month with previous month
 */
export const compareWithPreviousMonth = (currentMonthTransactions, allTransactions, currentMonthKey) => {
  // Get previous month
  const [year, month] = currentMonthKey.split('-').map(Number);
  const prevDate = new Date(year, month - 2, 1);
  const prevMonthKey = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
  
  const prevMonthTransactions = allTransactions.filter(t => t.date.startsWith(prevMonthKey));
  
  const currentIncome = currentMonthTransactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + parseFloat(t.amount), 0);
  const currentExpenses = currentMonthTransactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + parseFloat(t.amount), 0);
  
  const prevIncome = prevMonthTransactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + parseFloat(t.amount), 0);
  const prevExpenses = prevMonthTransactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + parseFloat(t.amount), 0);
  
  const incomeChange = prevIncome > 0 ? ((currentIncome - prevIncome) / prevIncome) * 100 : 0;
  const expensesChange = prevExpenses > 0 ? ((currentExpenses - prevExpenses) / prevExpenses) * 100 : 0;
  
  return {
    currentIncome,
    currentExpenses,
    prevIncome,
    prevExpenses,
    incomeChange: isFinite(incomeChange) ? incomeChange : 0,
    expensesChange: isFinite(expensesChange) ? expensesChange : 0,
    prevMonthKey
  };
};

/**
 * Check if spending exceeds threshold
 */
export const checkSpendingAlerts = (currentExpenses, avgExpenses, threshold = 20) => {
  const alerts = [];
  
  if (avgExpenses > 0) {
    const percentageOver = ((currentExpenses - avgExpenses) / avgExpenses) * 100;
    
    if (percentageOver > threshold) {
      alerts.push({
        type: 'warning',
        message: `Gastas ${percentageOver.toFixed(1)}% acima da média!`,
        severity: percentageOver > 50 ? 'high' : 'medium'
      });
    } else if (percentageOver < -threshold) {
      alerts.push({
        type: 'success',
        message: `Gastas ${Math.abs(percentageOver).toFixed(1)}% abaixo da média!`,
        severity: 'low'
      });
    }
  }
  
  return alerts;
};

/**
 * Calculate savings goals progress
 */
export const calculateSavingsGoal = (currentBalance, goalAmount, monthlyIncome) => {
  if (!goalAmount || goalAmount <= 0) return null;
  
  const progress = (currentBalance / goalAmount) * 100;
  const remaining = goalAmount - currentBalance;
  const monthsToGoal = monthlyIncome > 0 && remaining > 0 
    ? Math.ceil(remaining / monthlyIncome)
    : null;
  
  return {
    progress: Math.min(progress, 100),
    remaining: Math.max(remaining, 0),
    monthsToGoal,
    achieved: currentBalance >= goalAmount
  };
};

/**
 * Get last N months data for charts
 */
export const getMonthlyTrends = (transactions, months = 6) => {
  const monthlyData = {};
  
  transactions.forEach(t => {
    const monthKey = t.date.substring(0, 7);
    if (!monthlyData[monthKey]) {
      monthlyData[monthKey] = { income: 0, expenses: 0 };
    }
    
    if (t.type === 'income') {
      monthlyData[monthKey].income += parseFloat(t.amount);
    } else {
      monthlyData[monthKey].expenses += parseFloat(t.amount);
    }
  });
  
  const sortedMonths = Object.keys(monthlyData).sort().slice(-months);
  
  return sortedMonths.map(month => ({
    month,
    income: monthlyData[month].income,
    expenses: monthlyData[month].expenses,
    balance: monthlyData[month].income - monthlyData[month].expenses
  }));
};
