/**
 * recurringMatch — casa uma ocorrência prevista de um pagamento recorrente com
 * uma transação real já existente (importada ou lançada à mão).
 *
 * Critério (configurável): montante dentro de ±5% e data dentro de ±5 dias úteis
 * da data prevista. Evita que a mesma despesa seja contada duas vezes (recorrente
 * + histórico). Puro e determinístico.
 */

/** Nº de dias ÚTEIS entre duas datas 'YYYY-MM-DD' (ordem indiferente). */
export function businessDaysBetween(a, b) {
  if (!a || !b) return Infinity;
  const lo = a <= b ? a : b;
  const hi = a <= b ? b : a;
  const d = new Date(lo + 'T00:00:00');
  const end = new Date(hi + 'T00:00:00');
  let count = 0;
  while (d < end) {
    d.setDate(d.getDate() + 1);
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) count += 1; // ignora sábado e domingo
  }
  return count;
}

/**
 * Encontra a melhor transação que corresponde a uma ocorrência prevista.
 * @param occurrence { amount, dueDate }
 * @param transactions lista de transações
 * @param opts { amountTolerance=0.05, businessDays=5, usedIds?:Set }
 * @returns a transação correspondente ou null
 */
export function findMatchingTransaction(occurrence, transactions, opts = {}) {
  const { amountTolerance = 0.05, businessDays = 5, usedIds = null } = opts;
  const amt = Number(occurrence?.amount) || 0;
  if (amt <= 0 || !occurrence?.dueDate) return null;
  const tol = amt * amountTolerance;

  let best = null;
  let bestScore = Infinity;
  for (const t of transactions || []) {
    if (!t || t.type !== 'expense' || !t.date) continue;
    if (usedIds && usedIds.has(t.id)) continue;
    const tAmt = Math.abs(Number(t.amount) || 0);
    if (Math.abs(tAmt - amt) > tol) continue;
    const bd = businessDaysBetween(t.date, occurrence.dueDate);
    if (bd > businessDays) continue;
    // Preferir data mais próxima e, em empate, montante mais próximo.
    const score = bd * 1000 + Math.abs(tAmt - amt);
    if (score < bestScore) { bestScore = score; best = t; }
  }
  return best;
}

/**
 * Casa uma lista de ocorrências pendentes com transações, sem reutilizar a mesma
 * transação para duas ocorrências. Devolve cada pendente com `.match` (tx|null).
 */
export function matchPendingRecurrings(pending, transactions, opts = {}) {
  const used = new Set();
  return (pending || []).map(p => {
    const amount = p.paymentType === 'variable' && p.estimatedAmount ? p.estimatedAmount : p.amount;
    const match = findMatchingTransaction({ amount, dueDate: p.dueDate }, transactions, { ...opts, usedIds: used });
    if (match) used.add(match.id);
    return { ...p, match };
  });
}
