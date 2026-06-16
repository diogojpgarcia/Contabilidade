/**
 * offlineQueue — fila persistente de escritas para suporte offline.
 *
 * Guarda mutações (add/update/delete de transações) quando não há rede e
 * reproduz-nas por ordem quando a ligação volta. Pura e sem React — toda a
 * orquestração (quando dar flush, reconciliar estado) vive nos hooks.
 *
 * INVARIANTE-CHAVE: a fila nunca contém um `update`/`delete` que aponte para um
 * id temporário (`local-…`). Editar/apagar uma transação ainda pendente altera
 * a própria entrada `add` (amendQueuedAdd / removeQueuedAdd). Assim o flush só
 * lida com `add` (tempId) e `update`/`delete` com ids REAIS → replay trivial.
 */

const KEY = 'financas_offline_queue_v1';

// Storage injetável: localStorage no browser, fallback em memória nos testes (node).
const _mem = new Map();
const _storage =
  (typeof localStorage !== 'undefined' && localStorage) || {
    getItem: (k) => (_mem.has(k) ? _mem.get(k) : null),
    setItem: (k, v) => _mem.set(k, v),
    removeItem: (k) => _mem.delete(k),
  };

function randomId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function loadQueue() {
  try {
    const raw = _storage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persist(queue) {
  try {
    _storage.setItem(KEY, JSON.stringify(queue));
  } catch { /* quota/serialização — ignora, melhor perder a fila do que rebentar */ }
}

export function getAll() { return loadQueue(); }
export function size() { return loadQueue().length; }
export function clearQueue() { persist([]); }

/** Gera um id temporário para uma transação criada offline. */
export function newTempId() { return `local-${randomId()}`; }

/** True se o id é de uma transação ainda não sincronizada. */
export function isTempId(id) { return typeof id === 'string' && id.startsWith('local-'); }

/** Enfileira a criação de uma transação (offline). */
export function enqueueAdd(transaction, tempId) {
  const q = loadQueue();
  q.push({ id: randomId(), kind: 'add', payload: { transaction, tempId }, createdAt: Date.now() });
  persist(q);
}

/**
 * Enfileira a edição de uma transação JÁ sincronizada (id real).
 * Last-write-wins: substitui um `update` pendente do mesmo id.
 */
export function enqueueUpdate(id, updates) {
  const q = loadQueue().filter((e) => !(e.kind === 'update' && e.payload.id === id));
  q.push({ id: randomId(), kind: 'update', payload: { id, updates }, createdAt: Date.now() });
  persist(q);
}

/**
 * Enfileira a remoção de uma transação JÁ sincronizada (id real).
 * Remove updates pendentes do mesmo id (ficariam sem efeito).
 */
export function enqueueDelete(id) {
  const q = loadQueue().filter((e) => !(e.payload.id === id && (e.kind === 'update' || e.kind === 'delete')));
  q.push({ id: randomId(), kind: 'delete', payload: { id }, createdAt: Date.now() });
  persist(q);
}

/** Aplica uma edição a uma transação ainda pendente (mexe na entrada `add`). */
export function amendQueuedAdd(tempId, partialTransaction) {
  const q = loadQueue().map((e) =>
    e.kind === 'add' && e.payload.tempId === tempId
      ? { ...e, payload: { ...e.payload, transaction: { ...e.payload.transaction, ...partialTransaction } } }
      : e,
  );
  persist(q);
}

/** Remove uma transação ainda pendente (cancela a entrada `add`). */
export function removeQueuedAdd(tempId) {
  persist(loadQueue().filter((e) => !(e.kind === 'add' && e.payload.tempId === tempId)));
}

/** Remove uma entrada da fila pelo seu id interno (após replay com sucesso). */
export function removeEntry(entryId) {
  persist(loadQueue().filter((e) => e.id !== entryId));
}
