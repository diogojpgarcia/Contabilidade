/**
 * Data utilities for transactions and categories
 */

// Categories for expenses
export const CATEGORIES_EXPENSE = [
  { id: "alimentacao", label: "Alimentação", icon: "🍽", color: "#E8734A" },
  { id: "habitacao", label: "Habitação", icon: "🏠", color: "#5B8DEF" },
  { id: "transporte", label: "Transporte", icon: "🚗", color: "#F5B731" },
  { id: "saude", label: "Saúde", icon: "💊", color: "#4ECDC4" },
  { id: "lazer", label: "Lazer", icon: "🎭", color: "#A78BFA" },
  { id: "educacao", label: "Educação", icon: "📚", color: "#34D399" },
  { id: "roupa", label: "Roupa", icon: "👕", color: "#F472B6" },
  { id: "tech", label: "Tecnologia", icon: "💻", color: "#60A5FA" },
  { id: "subscricoes", label: "Subscrições", icon: "📱", color: "#FBBF24" },
  { id: "outros", label: "Outros", icon: "📦", color: "#9CA3AF" },
];

// Categories for income
export const CATEGORIES_INCOME = [
  { id: "salario", label: "Salário", icon: "💰", color: "#34D399" },
  { id: "freelance", label: "Freelance", icon: "💼", color: "#60A5FA" },
  { id: "investimentos", label: "Investimentos", icon: "📈", color: "#A78BFA" },
  { id: "bonus", label: "Bónus", icon: "🎁", color: "#F5B731" },
  { id: "outros", label: "Outros", icon: "💵", color: "#9CA3AF" },
];

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

// Load transactions from localStorage
export const loadTransactions = (userId) => {
  const key = `transactions_${userId}`;
  const data = localStorage.getItem(key);
  return data ? JSON.parse(data) : [];
};

// Save transactions to localStorage
export const saveTransactions = (userId, transactions) => {
  const key = `transactions_${userId}`;
  localStorage.setItem(key, JSON.stringify(transactions));
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
