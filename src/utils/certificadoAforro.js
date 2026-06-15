/**
 * certificadoAforro.js
 * Lógica para Certificados de Aforro portugueses.
 *
 * Série E (atual):  taxa = Euribor 3M (arredondado a 0,1%) + 1%, cap 3,5%, floor 0%
 * Séries anteriores: taxa fixa introduzida manualmente pelo utilizador.
 *
 * Fontes:
 *  - Taxa Euribor 3M:  ECB SDMX REST API (público, sem chave)
 *  - Fórmula Série E:  IGCP — Portaria n.º 261-A/2023
 *
 * Exported:
 *   BOND_SERIES_INFO          – info sobre cada série (label, taxa fixa ou variável)
 *   fetchEuribor3M()          – busca Euribor 3M via ECB API; devolve número ou null
 *   calcSerieERate(euribor)   – aplica fórmula IGCP à taxa Euribor; devolve %
 *   calcBondValue(item, rate) – valor atual dado o item e a taxa anual
 *   calcAccruedInterest(...)  – juros acumulados em €
 */

import { apiFetch } from '../lib/apiFetch';

// ─── Séries ──────────────────────────────────────────────────────────────────

export const BOND_SERIES_INFO = {
  E: { label: 'Série E', variable: true,  description: 'Euribor 3M + 1% (cap 3,5%)' },
  D: { label: 'Série D', variable: false, description: 'Taxa fixa (introduzida manualmente)' },
  C: { label: 'Série C', variable: false, description: 'Taxa fixa (introduzida manualmente)' },
  B: { label: 'Série B', variable: false, description: 'Taxa fixa (introduzida manualmente)' },
  A: { label: 'Série A', variable: false, description: 'Taxa fixa (introduzida manualmente)' },
};

// ─── Cache ────────────────────────────────────────────────────────────────────

const EURIBOR_TTL = 24 * 60 * 60_000; // 24 h — publica uma vez por dia
let euriborCache = { value: null, ts: 0 };

// ─── ECB API ──────────────────────────────────────────────────────────────────

/**
 * Obtém a taxa Euribor 3M mais recente via ECB SDMX REST API (sem chave, público).
 * Devolve um número (ex: 2.4) ou null se falhar.
 */
export const fetchEuribor3M = async () => {
  if (euriborCache.value !== null && Date.now() - euriborCache.ts < EURIBOR_TTL) {
    return euriborCache.value;
  }

  try {
    const ctrl = new AbortController();
    const t    = setTimeout(() => ctrl.abort(), 20_000); // 20s — proxy tenta múltiplos endpoints ECB

    // Usa o proxy server-side /api/euribor (evita CORS do ECB e tenta múltiplos endpoints)
    const res = await apiFetch('/api/euribor', { signal: ctrl.signal });
    clearTimeout(t);

    if (!res.ok) throw new Error(`proxy HTTP ${res.status}`);

    const data = await res.json();
    const rate = data?.rate ?? null;

    if (!Number.isFinite(rate)) throw new Error('Euribor: valor inválido ou indisponível');

    euriborCache = { value: rate, ts: Date.now() };
    return rate;
  } catch (err) {
    console.warn('[certificadoAforro] fetchEuribor3M falhou:', err.message);
    return euriborCache.value; // fallback para cache anterior se existir
  }
};

// ─── Fórmula Série E ──────────────────────────────────────────────────────────

/**
 * Aplica a fórmula IGCP para a Série E:
 *   taxa = round(euribor3m, 1) + 1,0 % (cap 3,5%, floor 0%)
 * @param {number} euribor3m — taxa Euribor 3M em % (ex: 2.4)
 * @returns {number} taxa anual em % (ex: 3.4)
 */
export const calcSerieERate = (euribor3m) => {
  if (!Number.isFinite(euribor3m)) return null;
  const rounded = Math.round(euribor3m * 10) / 10; // arredonda a 0,1%
  return Math.min(3.5, Math.max(0, rounded + 1.0));
};

// ─── Cálculo de valor ─────────────────────────────────────────────────────────

/**
 * Calcula o valor atual de um Certificado de Aforro.
 *
 * Fórmula (capitalização anual + acumulação diária no ano corrente):
 *   valor = faceValue × (1 + rate/100)^anosCompletos × (1 + rate/100 × diasNoAno/365)
 *
 * @param {number} faceValue    — valor subscrito em €
 * @param {string} purchaseDate — data de subscrição (ISO: "YYYY-MM-DD")
 * @param {number} annualRate   — taxa anual em % (ex: 3.4)
 * @returns {number} valor atual estimado em €
 */
export const calcBondValue = (faceValue, purchaseDate, annualRate) => {
  if (!faceValue || !purchaseDate || !Number.isFinite(annualRate)) return faceValue || 0;

  const msElapsed   = Date.now() - new Date(purchaseDate).getTime();
  if (msElapsed <= 0) return faceValue;

  const daysElapsed  = msElapsed / (1000 * 60 * 60 * 24);
  const fullYears    = Math.floor(daysElapsed / 365);
  const remainingDays = daysElapsed - fullYears * 365;
  const r            = annualRate / 100;

  const valueAfterYears   = faceValue * Math.pow(1 + r, fullYears);
  const accrualThisYear   = valueAfterYears * r * (remainingDays / 365);

  return valueAfterYears + accrualThisYear;
};

/**
 * Juros acumulados em € = valor atual − valor subscrito.
 */
export const calcAccruedInterest = (faceValue, purchaseDate, annualRate) => {
  const current = calcBondValue(faceValue, purchaseDate, annualRate);
  return current - (faceValue || 0);
};

/**
 * Tempo decorrido desde a subscrição, formatado.
 * Ex: "1 ano e 3 meses"
 */
export const formatBondAge = (purchaseDate) => {
  if (!purchaseDate) return null;
  const ms    = Date.now() - new Date(purchaseDate).getTime();
  if (ms <= 0) return null;
  const days  = Math.floor(ms / (1000 * 60 * 60 * 24));
  const years = Math.floor(days / 365);
  const months = Math.floor((days % 365) / 30);
  if (years === 0 && months === 0) return `${days}d`;
  if (years === 0) return `${months} ${months === 1 ? 'mês' : 'meses'}`;
  if (months === 0) return `${years} ${years === 1 ? 'ano' : 'anos'}`;
  return `${years}a ${months}m`;
};
