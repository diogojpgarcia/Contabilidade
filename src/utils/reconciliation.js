/**
 * reconciliation — "conferir saldo" de uma conta.
 *
 * O utilizador diz o saldo REAL da conta numa data; a app calcula o seu próprio
 * saldo até essa data e mostra a diferença (gap). Depois ajuda a LOCALIZAR o que
 * falta através das recorrentes PREVISTAS e ainda NÃO casadas no período
 * (candidatas fortes ao que falta), deixando o ajuste manual como rede de
 * segurança para o que sobrar.
 *
 * Funções puras e determinísticas — sem React, sem efeitos.
 */

import { computeAccountBalance } from './budgetUtils';
import { getOccurrencesInRange, getRecurringMonthKey, safeNum } from './recurringPayments';
import { findMatchingTransaction } from './recurringMatch';

/** Tolerância (€) para considerar o gap "fechado" — evita ruído de cêntimos. */
export const GAP_EPSILON = 0.01;

/**
 * Saldo da conta numa data (inclusive). Atalho com nome explícito por cima de
 * computeAccountBalance({ asOf }).
 */
export function computeAccountBalanceAsOf(account, transactions, asOfDate) {
  return computeAccountBalance(account, transactions, { asOf: asOfDate || null });
}

/**
 * Reconcilia o saldo declarado com o calculado pela app.
 * @returns { computed, real, gap, direction }
 *   gap = real - computed (positivo → faltam RECEITAS; negativo → faltam DESPESAS).
 *   direction: 'ok' | 'missing-expense' | 'missing-income'
 */
export function reconcileAccount({ account, transactions, realBalance, asOfDate }) {
  const computed = computeAccountBalanceAsOf(account, transactions, asOfDate);
  const real = safeNum(realBalance);
  const gap = Math.round((real - computed) * 100) / 100;
  const direction = Math.abs(gap) <= GAP_EPSILON ? 'ok' : gap < 0 ? 'missing-expense' : 'missing-income';
  return { computed, real, gap, direction };
}

/**
 * Localiza candidatos ao gap: ocorrências de pagamentos recorrentes PREVISTAS no
 * período [fromDate..toDate] que pertencem a esta conta (accountId vazio ou igual)
 * e que NÃO casam com nenhuma transação já existente na conta nem já foram
 * confirmadas/associadas/dispensadas. Reutiliza o matching ±5% / ±5 dias úteis.
 *
 * @returns [{ payment, dueDate, monthKey, amount, paymentType }]  (mais recentes primeiro)
 */
export function findGapCandidates({
  recurringPayments = [],
  transactions = [],
  accountId = null,
  fromDate,
  toDate,
  confirmedRecurring = {},
}) {
  if (!fromDate || !toDate || fromDate > toDate) return [];

  // Só transações desta conta — a reconciliação é por conta.
  const accountTxns = (transactions || []).filter(t => t.account_id === accountId);
  const used = new Set();
  const candidates = [];

  for (const p of recurringPayments) {
    if (!p || p.active === false) continue;
    // Recorrente "desta conta": sem conta atribuída (genérica) ou a desta conta.
    const pAcc = p.accountId || null;
    if (pAcc && pAcc !== accountId) continue;

    const amount = p.paymentType === 'variable' && p.estimatedAmount
      ? safeNum(p.estimatedAmount)
      : safeNum(p.amount);
    if (amount <= 0) continue;

    for (const dueDate of getOccurrencesInRange(p, fromDate, toDate)) {
      const monthKey = getRecurringMonthKey(dueDate);
      // Já tratada (confirmada, associada ou dispensada) → não é candidata.
      if (confirmedRecurring?.[p.id]?.[monthKey]) continue;
      // Já existe no histórico da conta → não falta.
      const match = findMatchingTransaction({ amount, dueDate }, accountTxns, { usedIds: used });
      if (match) { used.add(match.id); continue; }
      candidates.push({ payment: p, dueDate, monthKey, amount, paymentType: p.paymentType || 'fixed' });
    }
  }

  // Mais recentes primeiro — o que falta tende a ser o mais próximo da data conferida.
  return candidates.sort((a, b) => b.dueDate.localeCompare(a.dueDate));
}

/** Nº de dias inteiros entre duas datas 'YYYY-MM-DD' (b - a), imune a DST. */
function daysSince(dateStr, asOf) {
  const u = (s) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
  return Math.round((u(asOf) - u(dateStr)) / 86400000);
}

/**
 * Contas que precisam de conferência: nunca conferidas ou conferidas há mais de
 * `staleDays` dias. Usado pelo nudge do modo extrato. Puro.
 * @returns [{ account, reason: 'never'|'stale', days }]  (mais "atrasadas" primeiro)
 */
export function accountsNeedingReconcile(accounts = [], { staleDays = 30, asOf = null } = {}) {
  const today = asOf || new Date().toISOString().split('T')[0];
  const out = [];
  for (const a of accounts) {
    if (!a) continue;
    if (!a.reconciledAt) { out.push({ account: a, reason: 'never', days: Infinity }); continue; }
    const days = daysSince(a.reconciledAt, today);
    if (days > staleDays) out.push({ account: a, reason: 'stale', days });
  }
  return out.sort((x, y) => y.days - x.days);
}
