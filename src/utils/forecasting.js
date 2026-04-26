import { getLastNMonths, computeMonthAnalytics } from './analytics.js';

function nextMonthStr(monthStr) {
  const [y, m] = monthStr.split('-').map(Number);
  const d = new Date(y, m, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function forecastNextMonth(transactions, currentMonth) {
  const months = getLastNMonths(currentMonth, 3);
  const histories = months.map(m => computeMonthAnalytics(transactions, m)).filter(h => h.count > 0);
  if (!histories.length) return null;

  const avgExpenses = histories.reduce((s, h) => s + h.expenses, 0) / histories.length;

  const allCats = new Set(histories.flatMap(h => Object.keys(h.byCategory)));
  const byCategory = {};
  for (const cat of allCats) {
    const vals = histories.map(h => h.byCategory[cat] || 0);
    byCategory[cat] = parseFloat((vals.reduce((s, v) => s + v, 0) / vals.length).toFixed(2));
  }

  const trend = histories.length >= 2
    ? (histories[histories.length - 1].expenses - histories[0].expenses) / Math.max(histories[0].expenses, 1)
    : 0;

  return {
    month: nextMonthStr(currentMonth),
    total: parseFloat((avgExpenses * (1 + trend * 0.3)).toFixed(2)),
    avgBase: parseFloat(avgExpenses.toFixed(2)),
    byCategory,
    trend: parseFloat((trend * 100).toFixed(1)),
    confidence: histories.length >= 3 ? 'high' : histories.length === 2 ? 'medium' : 'low',
  };
}
