/**
 * validateTransaction — rede de segurança na fronteira de escrita.
 *
 * Garante que nunca entra um `amount` NaN ou uma data malformada no estado/BD,
 * independentemente de quem chama (formulário, recorrentes, etc.). Puro e
 * testável. Lança Error com mensagem PT em dados inutilizáveis; devolve uma
 * cópia "limpa" caso contrário.
 */

export const VALID_TX_TYPES = new Set(['expense', 'income', 'transfer', 'adjustment']);

/** Converte para número finito (aceita vírgula decimal); NaN se impossível. */
export function normalizeAmount(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : NaN;
  if (typeof value === 'string') {
    const n = parseFloat(value.replace(',', '.'));
    return Number.isFinite(n) ? n : NaN;
  }
  return NaN;
}

/** True se for uma data 'YYYY-MM-DD' válida no calendário. */
export function isValidDate(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/**
 * Valida e normaliza uma transação antes de persistir.
 * @returns cópia limpa { amount: number, type, description, date, ... }
 * @throws Error se o valor ou a data forem inválidos.
 */
export function validateTransaction(tx) {
  if (!tx || typeof tx !== 'object') throw new Error('Transação inválida.');

  const amount = normalizeAmount(tx.amount);
  if (!Number.isFinite(amount)) throw new Error('Valor inválido.');
  if (amount < 0) throw new Error('O valor não pode ser negativo.');

  if (!isValidDate(tx.date)) throw new Error('Data inválida.');

  const type = VALID_TX_TYPES.has(tx.type) ? tx.type : 'expense';

  return {
    ...tx,
    amount,
    type,
    description: typeof tx.description === 'string' ? tx.description.trim() : (tx.description ?? ''),
  };
}
