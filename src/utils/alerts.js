import { computeMonthAnalytics, getLastNMonths } from './analytics.js';

function pctChange(current, previous) {
  if (!previous || previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

export function generateAlerts(transactions, currentMonth) {
  const alerts = [];
  if (!transactions.length) return alerts;

  const cur  = computeMonthAnalytics(transactions, currentMonth);
  const prevM = getLastNMonths(currentMonth, 2)[0];
  const prev = computeMonthAnalytics(transactions, prevM);

  const last3 = getLastNMonths(currentMonth, 4).slice(0, 3).map(m => computeMonthAnalytics(transactions, m));
  const avgExpenses = last3.reduce((s, h) => s + h.expenses, 0) / Math.max(last3.filter(h => h.count > 0).length, 1);

  // Total expenses vs average
  const totalDelta = pctChange(cur.expenses, avgExpenses);
  if (totalDelta !== null && totalDelta > 15) {
    alerts.push({
      type: 'warning',
      message: `Despesas ${totalDelta.toFixed(0)}% acima da tua média dos últimos 3 meses`,
      delta: parseFloat(totalDelta.toFixed(1)),
    });
  } else if (totalDelta !== null && totalDelta < -15) {
    alerts.push({
      type: 'info',
      message: `Despesas ${Math.abs(totalDelta).toFixed(0)}% abaixo da tua média — bom trabalho!`,
      delta: parseFloat(totalDelta.toFixed(1)),
    });
  }

  // Per-category vs previous month
  const allCats = new Set([...Object.keys(cur.byCategory), ...Object.keys(prev.byCategory)]);
  for (const cat of allCats) {
    const c = cur.byCategory[cat] || 0;
    const p = prev.byCategory[cat] || 0;
    const delta = pctChange(c, p);
    if (delta === null) continue;
    if (delta > 20 && c > 10) {
      alerts.push({
        type: 'warning',
        message: `Gastaste ${delta.toFixed(0)}% mais em "${cat}" do que no mês passado`,
        category: cat,
        delta: parseFloat(delta.toFixed(1)),
      });
    } else if (delta < -20 && p > 10) {
      alerts.push({
        type: 'info',
        message: `Poupaste ${Math.abs(delta).toFixed(0)}% em "${cat}" vs mês passado`,
        category: cat,
        delta: parseFloat(delta.toFixed(1)),
      });
    }
  }

  // Outlier transactions (amount > mean + 2*stddev)
  const expTxs = transactions.filter(t => t.type === 'expense' && getMonthKey(t.date) === currentMonth);
  if (expTxs.length >= 3) {
    const amounts = expTxs.map(t => parseFloat(t.amount));
    const mean = amounts.reduce((s, v) => s + v, 0) / amounts.length;
    const std  = Math.sqrt(amounts.map(v => (v - mean) ** 2).reduce((s, v) => s + v, 0) / amounts.length);
    const outliers = expTxs.filter(t => parseFloat(t.amount) > mean + 2 * std);
    for (const tx of outliers.slice(0, 2)) {
      alerts.push({
        type: 'warning',
        message: `Transação invulgar: "${tx.description}" — ${parseFloat(tx.amount).toFixed(2)}€`,
        category: tx.category,
      });
    }
  }

  return alerts.slice(0, 8);
}

function getMonthKey(date) { return String(date).slice(0, 7); }
