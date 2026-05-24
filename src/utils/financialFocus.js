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

const FOCUS_BOOSTS = {
  savings:  { opportunity: 200, trend: 120, pattern: 60 },
  budgets:  { alert: 200, risk: 160, trend: 60 },
  tracking: { pattern: 200, info: 160, opportunity: 40 },
  growth:   { opportunity: 200, info: 120, trend: 60 },
};

export const applyFocusBoost = (items, focus) => {
  if (!focus) return items;
  const boosts = FOCUS_BOOSTS[focus] || {};
  return items.map(item => ({
    ...item,
    priority: item.priority + (boosts[item.type] || 0),
  }));
};

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
