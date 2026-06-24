/**
 * homeHero.js — modelo do herói da Home.
 *
 * PURO. Só calcula o que é factual e sem fórmula contestável:
 *   - fluxo do mês financeiro corrente (entrou / saiu / saldo)
 *   - uma frase-resumo derivada DIRETAMENTE do sinal do saldo
 *
 * NÃO calcula score de saúde nem previsão de fim de mês — esses ficam `null`
 * (placeholder) até a fórmula ser decidida com o utilizador. O componente
 * HealthRing mostra um estado neutro enquanto `score` for null.
 */

import { isInFinancialMonth } from './financialMonth.js';

const num = (v) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};

const eur = (v) => `${Math.round(num(v)).toLocaleString('pt-PT')}€`;
const signedEur = (v) => `${num(v) >= 0 ? '+' : '−'}${Math.round(Math.abs(num(v))).toLocaleString('pt-PT')}€`;

/**
 * @returns {{
 *   income, expenses, balance, hasFlow,
 *   headline: string,
 *   vitals: Array<{ key, label, value, tone }>,
 *   score: null, scoreDelta: null, forecast: null
 * }}
 */
export function buildHeroModel({ transactions = [], currentMonth, startDay = 1 } = {}) {
  let income = 0;
  let expenses = 0;

  if (currentMonth) {
    for (const t of transactions) {
      if (!t || !t.date || !isInFinancialMonth(t.date, currentMonth, startDay)) continue;
      const a = Math.abs(num(t.amount));
      if (t.type === 'income') income += a;
      else if (t.type === 'expense') expenses += a;
    }
  }

  const balance = income - expenses;
  const hasFlow = income > 0 || expenses > 0;

  const headline = !hasFlow
    ? 'Ainda sem movimentos este mês.'
    : balance > 0
      ? 'Estás a poupar este mês.'
      : balance < 0
        ? 'Estás a gastar mais do que recebes.'
        : 'Estás equilibrado este mês.';

  const vitals = [
    { key: 'in',  label: 'Entrou', value: eur(income),         tone: 'income' },
    { key: 'out', label: 'Saiu',   value: eur(expenses),       tone: 'expense' },
    { key: 'bal', label: 'Saldo',  value: signedEur(balance),  tone: balance >= 0 ? 'income' : 'expense' },
  ];

  return {
    income, expenses, balance, hasFlow,
    headline, vitals,
    // ── placeholders (lógica de dinheiro a decidir) ──
    score: null,
    scoreDelta: null,
    forecast: null,
  };
}
