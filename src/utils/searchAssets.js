/**
 * searchAssets.js
 * Fast local search over the ASSETS registry.
 *
 * Usage:
 *   searchAssets('apple')              → top 8 matches across all types
 *   searchAssets('spy', ['etf'])       → ETF-only matches
 *   searchAssets('btc', ['crypto'])    → crypto-only matches
 *   searchAssets('vwce', ['stock','etf']) → stocks + ETFs
 *
 * Ranking (highest first):
 *   3 — exact symbol match (case-insensitive)
 *   2 — symbol starts with query
 *   1 — name starts with query word
 *   0 — substring match anywhere in name
 */

import { ASSETS } from '../data/assetsList';

/**
 * @param {string}   query  — raw user input (any case, any length)
 * @param {string[]|null} types  — filter to these type values; null = all types
 * @param {number}   limit  — max results (default 8)
 * @returns {{ type: string, symbol: string, name: string }[]}
 */
export function searchAssets(query, types = null, limit = 8) {
  if (!query?.trim()) return [];

  const q    = query.trim().toLowerCase();

  const pool = types
    ? ASSETS.filter(a => types.includes(a.type))
    : ASSETS;

  const scored = pool
    .map(a => {
      const symLo  = a.symbol.toLowerCase();
      const nameLo = a.name.toLowerCase();
      let score = -1;

      if (symLo === q)                         score = 3; // exact symbol
      else if (symLo.startsWith(q))            score = 2; // symbol prefix
      else if (nameLo.startsWith(q))           score = 1; // name prefix
      else if (symLo.includes(q) ||
               nameLo.includes(q))             score = 0; // substring

      return score >= 0 ? { ...a, _score: score } : null;
    })
    .filter(Boolean)
    .sort((a, b) => b._score - a._score || a.symbol.localeCompare(b.symbol))
    .slice(0, limit)
    .map(({ _score, ...a }) => a); // strip internal score

  return scored;
}
