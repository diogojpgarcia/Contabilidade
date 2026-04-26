export function getMonthKey(date) {
  return String(date).slice(0, 7);
}

function prevMonth(monthStr) {
  const [y, m] = monthStr.split('-').map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function getLastNMonths(fromMonth, n) {
  const result = [];
  let cur = fromMonth;
  for (let i = 0; i < n; i++) {
    result.unshift(cur);
    cur = prevMonth(cur);
  }
  return result;
}

export function computeMonthAnalytics(transactions, month) {
  const txs = transactions.filter(t => getMonthKey(t.date) === month);
  const income   = txs.filter(t => t.type === 'income').reduce((s, t) => s + parseFloat(t.amount), 0);
  const expenses = txs.filter(t => t.type === 'expense').reduce((s, t) => s + parseFloat(t.amount), 0);
  const byCategory = {};
  for (const tx of txs.filter(t => t.type === 'expense')) {
    const cat = tx.category || 'Outros';
    byCategory[cat] = (byCategory[cat] || 0) + parseFloat(tx.amount);
  }
  return { month, income, expenses, balance: income - expenses, byCategory, count: txs.length };
}

export function getMonthlyHistory(transactions, currentMonth, n = 6) {
  return getLastNMonths(currentMonth, n).map(m => computeMonthAnalytics(transactions, m));
}

export function getTopCategories(transactions, month, n = 3) {
  const { byCategory, expenses } = computeMonthAnalytics(transactions, month);
  return Object.entries(byCategory)
    .map(([category, amount]) => ({ category, amount, percentage: expenses > 0 ? (amount / expenses) * 100 : 0 }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, n);
}

export function detectRecurring(transactions) {
  const groups = {};
  for (const tx of transactions) {
    const key = `${Math.round(tx.amount * 100)}|${String(tx.description || '').slice(0, 25).toLowerCase().trim()}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(tx);
  }
  return Object.values(groups)
    .filter(g => g.length >= 2)
    .map(g => ({
      description: g[0].description,
      amount: g[0].amount,
      type: g[0].type,
      occurrences: g.length,
      lastDate: g.sort((a, b) => b.date.localeCompare(a.date))[0].date,
    }))
    .sort((a, b) => b.occurrences - a.occurrences)
    .slice(0, 10);
}

export function buildPieData(transactions, month) {
  const top = getTopCategories(transactions, month, 8);
  return top.map(({ category, amount, percentage }) => ({ name: category, value: parseFloat(amount.toFixed(2)), percentage: parseFloat(percentage.toFixed(1)) }));
}

export function buildBarData(transactions, currentMonth, n = 6) {
  return getMonthlyHistory(transactions, currentMonth, n).map(h => ({
    month: h.month.slice(5) + '/' + h.month.slice(2, 4),
    income: parseFloat(h.income.toFixed(2)),
    expenses: parseFloat(h.expenses.toFixed(2)),
    balance: parseFloat(h.balance.toFixed(2)),
  }));
}
