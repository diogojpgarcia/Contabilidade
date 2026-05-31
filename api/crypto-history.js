/**
 * api/crypto-history.js — Vercel serverless function
 * Proxy para CoinGecko market_chart (evita CORS do browser)
 *
 * GET /api/crypto-history?coin=bitcoin&days=7
 */
async function fetchWithTimeout(url, options = {}, timeoutMs = 8000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { coin, days = '7' } = req.query;
  if (!coin) return res.status(400).json({ error: 'coin param required' });

  const interval = days === '1' ? 'hourly' : 'daily';
  const url = `https://api.coingecko.com/api/v3/coins/${encodeURIComponent(coin)}/market_chart?vs_currency=eur&days=${days}&interval=${interval}`;

  try {
    const r = await fetchWithTimeout(url);
    if (!r.ok) return res.status(502).json({ error: `CoinGecko HTTP ${r.status}` });
    const data = await r.json();
    res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=60');
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
