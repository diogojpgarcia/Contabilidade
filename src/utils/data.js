/**
 * Data utilities for transactions and categories
 */

// Categories — single source of truth lives in categories-professional.js.
// Re-exported here for backward-compat with any component that imports from data.js.
export { CATEGORIES_EXPENSE, CATEGORIES_INCOME } from './categories-professional';

// Format currency
export const formatCurrency = (value) => {
  return new Intl.NumberFormat("pt-PT", {
    style: "currency",
    currency: "EUR"
  }).format(value);
};

// Format percentage
export const formatPercentage = (value) => {
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
};

// Generate unique ID
export const generateId = () => {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
};

// Get today's date in YYYY-MM-DD format
export const getToday = () => {
  return new Date().toISOString().slice(0, 10);
};

// Get month key from date (YYYY-MM)
export const getMonthKey = (date) => {
  return date.slice(0, 7);
};

// Month names
export const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

// Short month names
export const MONTHS_SHORT = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez"
];

// Get category by ID
export const getCategoryById = (categoryId, type = 'expense') => {
  const categories = type === 'income' ? CATEGORIES_INCOME : CATEGORIES_EXPENSE;
  return categories.find(cat => cat.id === categoryId) || categories[categories.length - 1];
};

// Calculate monthly totals
export const calculateMonthlyTotals = (transactions, monthKey) => {
  const monthTransactions = transactions.filter(t => getMonthKey(t.date) === monthKey);
  
  const income = monthTransactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);
  
  const expenses = monthTransactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);
  
  return {
    income,
    expenses,
    balance: income - expenses
  };
};

// Calculate category totals for a month
export const calculateCategoryTotals = (transactions, monthKey) => {
  const monthTransactions = transactions.filter(t => getMonthKey(t.date) === monthKey);
  const totals = {};
  
  monthTransactions.forEach(t => {
    if (!totals[t.category]) {
      totals[t.category] = 0;
    }
    totals[t.category] += t.amount;
  });
  
  return totals;
};
