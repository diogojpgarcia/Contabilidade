/**
 * textMatch — utilitários partilhados para matching de descrições de
 * transações (regras aprendidas, deteção de similares, padrões).
 *
 * Usado por useTransactions (categorização) e ImportTab (aplicar regras).
 * Mantém a normalização IDÊNTICA em todos os pontos para que padrões
 * multi-palavra (ex. "uber eats") façam match de forma fiável.
 */

export const NOISE_WORDS = new Set([
  'payment', 'compra', 'ref', 'mbway', 'transfer', 'debito', 'credito',
  'debit', 'credit', 'via', 'para', 'from', 'por', 'com', 'the', 'and',
  'pagamento', 'direta', 'direto', 'sepa', 'trf', 'pos', 'atm',
]);

/** Minúsculas, remove não-letras → espaço, colapsa espaços. */
export function normalizeDesc(desc) {
  return (desc || '')
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Tokens significativos (>= 3 chars, sem ruído), na ordem original. */
export function tokensOf(desc) {
  return normalizeDesc(desc)
    .split(' ')
    .filter(w => w.length >= 3 && !NOISE_WORDS.has(w));
}

/** True se a descrição normalizada contém o padrão (substring normalizada). */
export function descMatchesPattern(desc, pattern) {
  if (!pattern) return false;
  return normalizeDesc(desc).includes(pattern);
}

/**
 * Deriva o padrão MAIS CURTO (prefixo de tokens da seed) que:
 *   - faz match em TODAS as descrições selecionadas, e
 *   - NÃO faz match em NENHUMA das rejeitadas.
 *
 * Permite diferenciar "uber eats" de "uber rides": se o utilizador
 * seleciona só os Eats e deixa os Rides de fora, o padrão "uber"
 * (ambíguo) é rejeitado e devolve-se "uber eats".
 *
 * Devolve null se nenhum prefixo da seed for seguro.
 */
export function derivePattern(seedDesc, selectedDescs, rejectedDescs = []) {
  const seedTokens = tokensOf(seedDesc);
  if (seedTokens.length === 0) return null;

  const selected = selectedDescs.map(normalizeDesc);
  const rejected = rejectedDescs.map(normalizeDesc);

  for (let len = 1; len <= seedTokens.length; len++) {
    const pattern = seedTokens.slice(0, len).join(' ');
    const matchesAllSelected = selected.every(d => d.includes(pattern));
    const matchesNoRejected = rejected.every(d => !d.includes(pattern));
    if (matchesAllSelected && matchesNoRejected) return pattern;
  }
  return null;
}
