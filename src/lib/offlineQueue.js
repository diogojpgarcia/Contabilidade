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
const SETTINGS_KEY = 'financas_offline_settings_v1';

/**
 * Erro de rede (offline/flaky) vs. erro real (validação, RLS). O Supabase usa
 * fetch → falha de rede lança TypeError "Failed to fetch" (iOS Safari: "Load
 * failed"). Pura (só analisa o erro); o estado "offline agora" é verificado nos
 * call sites antes do pedido.
 */
export const isNetworkError = (err) =>
  err?.name === 'TypeError' ||
  /failed to fetch|networkerror|load failed|network request failed/i.test(err?.message || '');

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

/* ── Overlay de settings ──────────────────────────────────────────────────── */
/* Patches de user_settings feitos offline (ex. confirmed_recurring,             */
/* recurring_payments). Acumulam por chave (last-write-wins) e são empurrados     */
/* para o servidor na reconexão, ANTES do reload — senão o fetch sobrepunha-se.   */

export function getSettingsOverlay() {
  try {
    const raw = _storage.getItem(SETTINGS_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function persistOverlay(o) {
  try { _storage.setItem(SETTINGS_KEY, JSON.stringify(o)); } catch { /* ignora */ }
}

export function mergeSettingsPatch(patch) {
  persistOverlay({ ...getSettingsOverlay(), ...patch });
}

export function hasSettingsOverlay() {
  return Object.keys(getSettingsOverlay()).length > 0;
}

export function clearSettingsOverlay() {
  persistOverlay({});
}

function remapConfirmed(confirmed, remap) {
  if (!confirmed || typeof confirmed !== 'object') return confirmed;
  const out = {};
  for (const [recId, months] of Object.entries(confirmed)) {
    out[recId] = {};
    for (const [m, v] of Object.entries(months || {})) {
      out[recId][m] = (v && v.transactionId && remap[v.transactionId])
        ? { ...v, transactionId: remap[v.transactionId] }
        : v;
    }
  }
  return out;
}

/**
 * Reescreve transactionIds temporários (local-…) para os ids reais devolvidos
 * pelo flush, dentro do confirmed_recurring guardado na overlay. Garante que
 * "apagar e repor" um recorrente continua a encontrar a transação após sync.
 */
export function remapSettingsTxIds(remap) {
  if (!remap || !Object.keys(remap).length) return;
  const o = getSettingsOverlay();
  if (o.confirmed_recurring) {
    o.confirmed_recurring = remapConfirmed(o.confirmed_recurring, remap);
    persistOverlay(o);
  }
}
