/**
 * Financial Focus — lightweight personalization layer.
 *
 * Adjusts insight priority ordering based on the user's stated goal.
 * No new insight engine — only boosts priorities of existing insight types
 * so the right ones surface first. Everything else stays unchanged.
 */

export const FOCUS_OPTIONS = [
  {
    id: 'savings',
    label: 'Poupar',
    icon: '🏦',
    desc: 'Reduzir despesas e aumentar poupança mensal',
  },
  {
    id: 'budgets',
    label: 'Orçamento',
    icon: '📊',
    desc: 'Cumprir os limites definidos por categoria',
  },
  {
    id: 'tracking',
    label: 'Controlo',
    icon: '🔍',
    desc: 'Perceber padrões e hábitos de gasto',
  },
  {
    id: 'growth',
    label: 'Crescer',
    icon: '📈',
    desc: 'Aumentar rendimento e construir património',
  },
];

/**
 * Priority boosts applied to each insight type when a focus is active.
 * Higher = appears earlier in the top-4 list.
 *   savings  → surface "above average" (opportunity) and rising trends
 *   budgets  → surface budget alerts and near-limit risks first
 *   tracking → surface behavioral patterns and notable single expenses
 *   growth   → surface opportunities to free up money + rising costs
 */
const FOCUS_BOOSTS = {
  savings:  { opportunity: 25, trend: 10 },
  budgets:  { alert: 25, risk: 15 },
  tracking: { pattern: 20, info: 10 },
  growth:   { opportunity: 20, trend: 15 },
};

/**
 * Returns a copy of `items` with adjusted priority values.
 * Does NOT sort — caller is responsible for sorting after this.
 *
 * @param {Array}  items  - raw insight items from generateInsights
 * @param {string|null} focus - one of the FOCUS_OPTIONS ids, or null
 */
export const applyFocusBoost = (items, focus) => {
  if (!focus) return items;
  const boosts = FOCUS_BOOSTS[focus] || {};
  return items.map(item => ({
    ...item,
    priority: item.priority + (boosts[item.type] || 0),
  }));
};

/**
 * Returns a short contextual line for the Home Destaque card.
 * Uses already-computed insight data — no additional analysis.
 *
 * @param {string|null} focus   - active focus id
 * @param {object|null} insight - output of HomeInsight's computeInsight()
 * @returns {string|null}
 */
export const getFocusLine = (focus, insight) => {
  if (!focus) return null;
  const cat = insight?.categoryLabel || null;

  switch (focus) {
    case 'savings':
      return cat
        ? `Foco em poupar · cortar em ${cat} tem maior impacto`
        : 'Foco em poupar · regista despesas para ver onde cortar';
    case 'budgets':
      return cat
        ? `Foco em orçamento · define um limite para ${cat} no Budget`
        : 'Foco em orçamento · define limites por categoria no Budget';
    case 'tracking':
      return cat
        ? `Foco em controlo · ${cat} lidera os gastos deste mês`
        : 'Foco em controlo · adiciona transações para ver padrões';
    case 'growth':
      return cat
        ? `Foco em crescer · otimizar ${cat} liberta margem para investir`
        : 'Foco em crescer · controla despesas para aumentar margem mensal';
    default:
      return null;
  }
};
