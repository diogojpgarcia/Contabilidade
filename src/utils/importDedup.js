/**
 * importDedup — deduplicação de import robusta, para re-uploads de extrato não
 * criarem sobreposições/duplicados nem perderem linhas legítimas.
 *
 * Puro e determinístico (sem React, sem rede).
 */

/** Normalização determinística da descrição para chaves de import. */
export function normImportDesc(description) {
  return (description || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60);
}

/** Chave-base de uma linha (data|montante|descrição) — sem desempate de ocorrência. */
export function importHashBase(date, amount, description) {
  return `${date}|${(Number(amount) || 0).toFixed(2)}|${normImportDesc(description)}`;
}

/**
 * Índice de ocorrência (seq) de cada linha no ficheiro: 0 na 1ª vez que uma
 * chave-base aparece, 1,2,… nas repetições. Permite que linhas GENUINAMENTE
 * iguais (ex.: 2 cafés de 1,50€ no mesmo dia) tenham import_hash distintos e não
 * sejam descartadas pela constraint UNIQUE — mantendo a dedup de re-imports
 * (mesmo ficheiro → mesma ordem → mesmos seq). 1ª ocorrência fica com seq 0 →
 * hash igual ao formato antigo (retrocompatível com o que já foi importado).
 * @returns number[] alinhado a `rows`.
 */
export function assignImportSeqs(rows) {
  const seen = new Map();
  return (rows || []).map(r => {
    const k = importHashBase(r.date, r.amount, r.clean_description || r.description);
    const n = seen.get(k) || 0;
    seen.set(k, n + 1);
    return n;
  });
}

/**
 * Marca quais linhas do import JÁ existem nas transações da conta (re-import,
 * sobreposição de períodos, ou lançadas à mão antes). Match EXATO por
 * data+montante+tipo+descrição, com CONTAGEM: se o ficheiro tem 2 cafés iguais e
 * a conta já tem 1, só 1 é marcado como existente (o outro é novo). Conservador
 * (match exato) para nunca descartar uma transação realmente nova.
 * @returns Set<number> índices das linhas já existentes.
 */
export function findExistingDuplicates(rows, accountTxns) {
  const keyOf = (date, amount, type, description) =>
    `${date}|${(Math.abs(Number(amount)) || 0).toFixed(2)}|${type}|${normImportDesc(description)}`;

  const pool = new Map(); // chave → nº disponível nas transações existentes
  for (const t of (accountTxns || [])) {
    const k = keyOf(t.date, t.amount, t.type, t.description);
    pool.set(k, (pool.get(k) || 0) + 1);
  }

  const dup = new Set();
  (rows || []).forEach((r, i) => {
    const k = keyOf(r.date, r.amount, r.type, r.clean_description || r.description);
    const avail = pool.get(k) || 0;
    if (avail > 0) { dup.add(i); pool.set(k, avail - 1); }
  });
  return dup;
}
