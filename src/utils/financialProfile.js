/**
 * financialProfile — perfil que "ensina" à análise o que o utilizador pretende.
 *
 * Capturado por um questionário (FinancialProfileSheet) e persistido nas
 * settings (financial_profile). Alimenta generateLocalAnalysis (metas e ênfase)
 * e o boost dos insights regra-a-regra (via goalToFocus).
 */

export const GOAL_OPTIONS = [
  { id: 'savings',   label: 'Poupar mais',              icon: '🏦', desc: 'Reduzir despesas e poupar mais todos os meses' },
  { id: 'emergency', label: 'Criar fundo de emergência', icon: '🛟', desc: 'Juntar uma reserva de 3 a 6 meses de despesas' },
  { id: 'debt',      label: 'Pagar dívidas',            icon: '💳', desc: 'Libertar margem para liquidar créditos' },
  { id: 'budgets',   label: 'Cumprir orçamentos',       icon: '📊', desc: 'Manter os gastos dentro dos limites por categoria' },
  { id: 'tracking',  label: 'Controlar gastos',         icon: '🔍', desc: 'Perceber padrões e hábitos de despesa' },
  { id: 'growth',    label: 'Crescer património',        icon: '📈', desc: 'Aumentar a margem para investir e crescer' },
];

export const SAVINGS_TARGETS = [10, 15, 20, 30];

export const DEFAULT_PROFILE = {
  goal: 'savings',
  savingsTarget: 20,
  variableIncome: false,
  monthlyIncome: 0, // âncora: ordenado/rendimento mensal declarado (0 = não declarado)
  emergencyIncludesAforro: true, // contar certificados de aforro como liquidez no fundo de emergência
  configured: false, // passa a true quando o utilizador guarda o questionário
};

/** Garante um perfil completo a partir de dados possivelmente parciais/antigos. */
export function normalizeProfile(p) {
  const goal = GOAL_OPTIONS.some(g => g.id === p?.goal) ? p.goal : DEFAULT_PROFILE.goal;
  const t = Number(p?.savingsTarget);
  const savingsTarget = Number.isFinite(t) ? Math.min(80, Math.max(5, Math.round(t))) : DEFAULT_PROFILE.savingsTarget;
  const mi = Number(p?.monthlyIncome);
  const monthlyIncome = Number.isFinite(mi) && mi > 0 ? Math.round(mi * 100) / 100 : 0;
  return {
    goal,
    savingsTarget,
    variableIncome: !!p?.variableIncome,
    monthlyIncome,
    // default true quando o campo não existe (perfis antigos mantêm comportamento atual)
    emergencyIncludesAforro: p?.emergencyIncludesAforro !== false,
    configured: !!p?.configured,
  };
}

export const goalLabel = (id) => GOAL_OPTIONS.find(g => g.id === id)?.label || '';

/** Mapeia o objetivo do perfil para o id de foco do motor regra-a-regra. */
export function goalToFocus(goal) {
  switch (goal) {
    case 'emergency':
    case 'debt':
      return 'savings';   // ambos beneficiam de boostar oportunidades de poupança
    case 'budgets':  return 'budgets';
    case 'tracking': return 'tracking';
    case 'growth':   return 'growth';
    case 'savings':  return 'savings';
    default:         return null;
  }
}
