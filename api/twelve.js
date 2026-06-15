/**
 * api/twelve.js — proxy server-side para a Twelve Data.
 * Mantém a API key no servidor (process.env), em vez de a expor no bundle.
 *
 * GET /api/twelve?path=quote&symbol=AAPL
 * GET /api/twelve?path=symbol_search&symbol=apple
 */
import authMod from './_auth.js';

const ALLOWED = new Set(['quote', 'symbol_search']);

export default async function handler(req, res) {
  if (!(await authMod.requireAuth(req, res))) return;

  const q = req.query || {};
  const path = q.path;
  if (!ALLOWED.has(path)) {
    return res.status(400).json({ error: 'invalid path' });
  }

  const key = process.env.TWELVE_DATA_KEY || process.env.VITE_TWELVE_DATA_KEY;
  if (!key) return res.status(500).json({ error: 'TWELVE_DATA_KEY not configured' });

  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(q)) {
    if (k !== 'path' && v != null) params.set(k, String(v));
  }
  params.set('apikey', key);

  try {
    const r = await fetch(`https://api.twelvedata.com/${path}?${params.toString()}`);
    const data = await r.json();
    return res.status(200).json(data);
  } catch (e) {
    return res.status(502).json({ error: 'twelve data fetch failed', detail: String(e && e.message || e) });
  }
}
