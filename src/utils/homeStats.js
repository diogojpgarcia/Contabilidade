/**
 * homeStats.js — agregações puras para a Home.
 *
 * Sem React, sem side-effects, sem lógica de saldos. Só lê transações e agrega.
 */

import { isInFinancialMonth } from './financialMonth.js';

const FALLBACK_COLOR = 'var(--cosmos-text-3)';

const num = (v) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};

// Mapa label→cor a partir das categorias do contexto ({ expense:[{label,color}], ... }).
function colorMap(categories) {
  const map = {};
  for (const cat of (categories?.expense || [])) {
    if (cat?.label) map[cat.label] = cat.color || FALLBACK_COLOR;
  }
  return map;
}

/**
 * Gasto por categoria no mês financeiro corrente, ordenado desc.
 * Acima de `topN` categorias, a cauda é agregada numa fatia `restLabel`.
 *
 * @returns {{ slices: Array<{label,amount,color,pct}>, total: number }}
 */
export function spendingByCategory({
  transactions = [],
  currentMonth,
  categories,
  startDay = 1,
  topN = 4,
  restLabel = 'Resto',
  restColor = FALLBACK_COLOR,
} = {}) {
  if (!currentMonth) return { slices: [], total: 0 };

  const colors = colorMap(categories);

  // Soma por label (despesas do mês financeiro corrente).
  const byLabel = {};
  let total = 0;
  for (const t of transactions) {
    if (!t || t.type !== 'expense' || !t.date) continue;
    if (!isInFinancialMonth(t.date, currentMonth, startDay)) continue;
    const label = t.category || 'Outros';
    const amount = Math.abs(num(t.amount));
    if (amount === 0) continue;
    byLabel[label] = (byLabel[label] || 0) + amount;
    total += amount;
  }

  if (total === 0) return { slices: [], total: 0 };

  const sorted = Object.entries(byLabel)
    .map(([label, amount]) => ({ label, amount }))
    .sort((a, b) => b.amount - a.amount);

  // Top (topN-1) categorias + cauda agregada, OU todas se couberem em topN.
  let rows;
  if (sorted.length > topN) {
    const head = sorted.slice(0, topN - 1);
    const restAmount = sorted.slice(topN - 1).reduce((s, r) => s + r.amount, 0);
    rows = [...head, { label: restLabel, amount: restAmount, isRest: true }];
  } else {
    rows = sorted;
  }

  const slices = rows.map((r) => ({
    label: r.label,
    amount: r.amount,
    color: r.isRest ? restColor : (colors[r.label] || FALLBACK_COLOR),
    pct: Math.round((r.amount / total) * 100),
  }));

  return { slices, total };
}
