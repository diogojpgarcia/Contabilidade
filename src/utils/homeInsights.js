/**
 * homeInsights.js — adapta o motor de insights (rules) para a Home.
 *
 * Wrapper PURO sobre `generateInsights` (insights.js): normaliza cada item
 * para a forma que a Home consome — { id, tone, text, subtext, action, type }.
 *
 * Não recalcula nada nem inventa fórmulas de dinheiro: só re-embrulha o que o
 * motor já produz e ordena. (localInsights/generateLocalAnalysis fica p/ depois.)
 */

import { generateInsights } from './insights.js';

// color do motor → tom da UI (mapeia para tokens cosmos no componente).
export const INSIGHT_TONE = {
  risk: 'danger',
  warn: 'warning',
  good: 'success',
  info: 'info',
};

/**
 * @returns {Array<{ id, tone, text, subtext, action, type }>}
 */
export function buildHomeInsights({
  transactions = [],
  budgets = {},
  categories,
  currentMonth,
  startDay = 1,
  focus = null,
  maxResults = 3,
} = {}) {
  if (!transactions.length || !currentMonth || !categories?.expense) return [];

  let raw = [];
  try {
    raw = generateInsights({
      transactions, budgets, categories,
      selectedMonth: currentMonth, startDay, focus, maxResults,
    }) || [];
  } catch {
    return [];
  }

  return raw.map((it, i) => ({
    id: `${it.type || 'insight'}-${i}`,
    tone: INSIGHT_TONE[it.color] || 'info',
    text: it.title,
    subtext: it.message || it.explanation || '',
    action: it.meta || null,
    type: it.type || 'info',
  }));
}
