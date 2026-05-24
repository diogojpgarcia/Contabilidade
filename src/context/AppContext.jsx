import { createContext, useContext } from 'react';

/**
 * AppContext — dados estáveis partilhados por toda a app.
 *
 * O que entra aqui: dados que mudam raramente e são lidos por 3+ componentes.
 *   - currentUser  → RecurringView, PatrimonyView, ImportTab, ProfileTab
 *   - categories   → HomeTab, StatsTab, AddTab, BudgetsView, CategoryHistorySheet, RecurringView
 *   - onCategoriesChange → ProfileTab
 *
 * O que NÃO entra aqui: dados que mudam frequentemente (transactions, patrimony,
 * currentMonth, budgets) — esses continuam como props para evitar re-renders
 * desnecessários em toda a árvore.
 */
const AppContext = createContext(null);

export function AppProvider({ value, children }) {
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

/**
 * Hook para consumir o AppContext.
 * Lança erro com mensagem clara se usado fora do AppProvider.
 */
export function useAppContext() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppContext deve ser usado dentro de <AppProvider>');
  return ctx;
}
