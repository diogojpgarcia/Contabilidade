/**
 * homeInbox.js — constrói a "inbox de ações" da Home.
 *
 * Função PURA: dado o estado atual, devolve a lista priorizada do que precisa
 * de tratamento. Não toca em saldos nem em lógica de dinheiro — só LÊ e agrega.
 *
 * Determinístico: recebe `today` ('YYYY-MM-DD') e injeta-o em todas as primitivas
 * de data, por isso é testável sem fake timers.
 *
 * Tipos de item (v1):
 *   - 'recurring-due'    🔴  pagamento recorrente venceu e não foi confirmado
 *   - 'uncategorized'    🟠  transações recentes por categorizar (category 'Outros')
 *   - 'reconcile-stale'  🔵  conta nunca conferida ou conferida há muito tempo
 *
 * Cada item: { id, type, priority, title, subtitle, action, meta }
 *   - priority: número (menor = mais urgente, fica no topo)
 *   - action:   descreve o que fazer ao tocar — interpretado pelo componente
 *   - meta:     dados estruturados (datas, contagens) para ordenação/render
 */

import {
  getOccurrencesInRange,
  getRecurringMonthKey,
  isConfirmedForMonth,
  safeNum,
} from './recurringPayments.js';
import { accountsNeedingReconcile } from './reconciliation.js';

// Categoria-fallback do enrichTransactions para despesas sem regra.
export const UNCATEGORIZED_LABEL = 'Outros';

// Prioridade por tipo (menor = mais urgente).
export const INBOX_PRIORITY = {
  'recurring-due': 0,
  'uncategorized': 1,
  'reconcile-stale': 2,
};

// ── Date helpers (locais, DST-safe, determinísticos) ─────────────────────────
const fmtLocal = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const todayLocal = () => fmtLocal(new Date());

// Desloca uma data 'YYYY-MM-DD' por n dias (aritmética por componentes → imune a DST).
function shiftDays(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00');
  return fmtLocal(new Date(d.getFullYear(), d.getMonth(), d.getDate() + safeNum(n)));
}

// Dias inteiros entre duas strings 'YYYY-MM-DD' (b - a). Usa UTC → imune a DST.
function diffDays(aStr, bStr) {
  const u = (s) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
  return Math.round((u(bStr) - u(aStr)) / 86400000);
}

// "Hoje" / "ontem" / "há Nd" para uma data <= today (determinístico).
function relativeOverdue(today, dateStr) {
  const d = diffDays(dateStr, today); // >= 0 quando dateStr <= today
  if (d <= 0) return 'hoje';
  if (d === 1) return 'ontem';
  return `há ${d} dias`;
}

const eur = (n) => `${safeNum(n).toFixed(2)}€`;

// ── Builders por tipo ────────────────────────────────────────────────────────

// Recorrentes vencidos e por confirmar dentro da janela de lookback.
function buildRecurringDue({ recurringPayments, confirmedRecurring, today, lookbackDays }) {
  const windowStart = shiftDays(today, -lookbackDays);
  const items = [];

  for (const p of (recurringPayments || [])) {
    if (!p || p.active === false) continue;

    // Última ocorrência em [today-lookback, today]. Determinístico.
    const occ = getOccurrencesInRange(p, windowStart, today);
    if (!occ.length) continue;
    const due = occ[occ.length - 1];

    const monthKey = getRecurringMonthKey(due);
    if (isConfirmedForMonth(p.id, monthKey, confirmedRecurring)) continue;

    const isVariable = p.paymentType === 'variable' && p.estimatedAmount != null;
    const amount = isVariable ? safeNum(p.estimatedAmount) : safeNum(p.amount);

    items.push({
      id: `recurring-${p.id}-${monthKey}`,
      type: 'recurring-due',
      priority: INBOX_PRIORITY['recurring-due'],
      title: `${p.title || 'Pagamento'} — confirmar`,
      subtitle: `${isVariable ? '~' : ''}${eur(amount)} · ${relativeOverdue(today, due)}`,
      action: { kind: 'confirm-recurring', paymentId: p.id, monthKey, dueDate: due, amount },
      meta: { dueDate: due, daysOverdue: diffDays(due, today), amount },
    });
  }
  return items;
}

// Transações recentes por categorizar (category 'Outros' ou em falta), agregadas.
function buildUncategorized({ transactions, today, windowDays, minCount }) {
  const since = shiftDays(today, -windowDays);
  const matched = (transactions || []).filter((t) => {
    if (!t || !t.date || t.date < since || t.date > today) return false;
    const c = t.category;
    return !c || c === UNCATEGORIZED_LABEL;
  });

  const n = matched.length;
  if (n < minCount) return [];

  return [{
    id: 'uncategorized',
    type: 'uncategorized',
    priority: INBOX_PRIORITY['uncategorized'],
    title: `${n} ${n === 1 ? 'transação por categorizar' : 'transações por categorizar'}`,
    subtitle: 'Atribui categorias para um retrato fiel',
    action: { kind: 'review-uncategorized', count: n },
    meta: { count: n },
  }];
}

// Contas que precisam de conferência (nunca ou há muito tempo).
function buildReconcileStale({ accounts, today, staleDays }) {
  return accountsNeedingReconcile(accounts || [], { staleDays, asOf: today }).map(({ account, reason, days }) => ({
    id: `reconcile-${account.id}`,
    type: 'reconcile-stale',
    priority: INBOX_PRIORITY['reconcile-stale'],
    title: `${account.name || 'Conta'} por conferir`,
    subtitle: reason === 'never' ? 'Saldo nunca conferido' : `Última vez há ${days} dias`,
    action: { kind: 'reconcile-account', accountId: account.id },
    // 'never' (days = Infinity) fica no topo dos reconcile.
    meta: { reason, days: Number.isFinite(days) ? days : 99999 },
  }));
}

// ── Ordenação ────────────────────────────────────────────────────────────────
// Por prioridade asc; dentro do mesmo tipo, mais urgente primeiro.
function urgencyScore(item) {
  if (item.type === 'recurring-due')   return item.meta.daysOverdue; // mais dias vencido = mais urgente
  if (item.type === 'reconcile-stale') return item.meta.days;        // mais dias sem conferir = mais urgente
  if (item.type === 'uncategorized')   return item.meta.count;       // mais transações = mais urgente
  return 0;
}

/**
 * Constrói a inbox priorizada. Puro.
 * @returns {Array<{id,type,priority,title,subtitle,action,meta}>} ordenada (vazia = inbox-zero)
 */
export function buildInbox({
  recurringPayments = [],
  confirmedRecurring = {},
  transactions = [],
  accounts = [],
  today = null,
  // tuning (defaults sensatos; ajustáveis sem mexer na lógica)
  staleDays = 30,
  lookbackDays = 40,
  uncategorizedWindowDays = 45,
  uncategorizedMinCount = 1,
} = {}) {
  const _today = today || todayLocal();

  const items = [
    ...buildRecurringDue({ recurringPayments, confirmedRecurring, today: _today, lookbackDays }),
    ...buildUncategorized({ transactions, today: _today, windowDays: uncategorizedWindowDays, minCount: uncategorizedMinCount }),
    ...buildReconcileStale({ accounts, today: _today, staleDays }),
  ];

  return items.sort((a, b) =>
    a.priority - b.priority || urgencyScore(b) - urgencyScore(a)
  );
}
