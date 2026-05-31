/**
 * api/quote.js — Vercel serverless function
 *
 * Proxy para cotações de ETFs/acções europeus.
 * Tenta Yahoo Finance v8 (chart endpoint, mais fiável que v7).
 * Fallback para Stooq.com (sem API key, europeus bem suportados).
 *
 * GET /api/quote?symbols=VWCE.DE,EUNL.DE,SXR8.DE
 * Returns: { "VWCE.DE": { price, changePct, currency }, ... }
 */

async function fetchWithTimeout(url, options = {}, timeoutMs = 8000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: ctrl.signal });
    return res;
  } finally {
    clearTimeout(t);
  }
}

async function fetchYahooV8(symbol) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d&includePrePost=false`;
  try {
    const res = await fetchWithTimeout(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
        'Accept-Language': 'en-US,en;q=0.9',
      }
    });
    if (!res.ok) return null;
    const data = await res.json();
    const meta = data?.chart?.result?.[0]?.meta;
    if (!meta?.regularMarketPrice) return null;
    const price = meta.regularMarketPrice;
    const prev  = meta.chartPreviousClose ?? meta.previousClose ?? null;
    const changePct = prev ? ((price - prev) / prev) * 100 : null;
    return { price, changePct, currency: meta.currency ?? 'EUR' };
  } catch {
    return null;
  }
}

async function fetchStooq(symbol) {
  // Stooq uses same .DE/.AS suffix format, lowercase
  const s = symbol.toLowerCase();
  const url = `https://stooq.com/q/l/?s=${encodeURIComponent(s)}&f=sd2t2ohlcv&h&e=csv`;
  try {
    const res = await fetchWithTimeout(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    if (!res.ok) return null;
    const text = await res.text();
    // CSV: Symbol,Date,Time,Open,High,Low,Close,Volume
    const lines = text.trim().split('\n');
    if (lines.length < 2) return null;
    const parts = lines[1].split(',');
    const close = parseFloat(parts[6]);
    const open  = parseFloat(parts[3]);
    if (!close || isNaN(close)) return null;
    const changePct = open ? ((close - open) / open) * 100 : null;
    return { price: close, changePct, currency: 'EUR' };
  } catch {
    return null;
  }
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { symbols } = req.query;
  if (!symbols) return res.status(400).json({ error: 'symbols param required' });

  const symList = symbols.split(',').map(s => s.trim()).filter(Boolean);
  if (!symList.length) return res.status(400).json({ error: 'no symbols' });

  // Fetch all symbols in parallel — Yahoo v8 first, Stooq as fallback
  const entries = await Promise.all(
    symList.map(async (sym) => {
      let data = await fetchYahooV8(sym);
      if (!data) {
        console.log(`[quote] Yahoo v8 failed for ${sym}, trying Stooq`);
        data = await fetchStooq(sym);
      }
      if (data) console.log(`[quote] ${sym} = ${data.price} ${data.currency}`);
      else console.warn(`[quote] No data for ${sym}`);
      return [sym, data];
    })
  );

  const result = {};
  for (const [sym, data] of entries) {
    if (data) result[sym] = data;
  }

  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=60');
  return res.json(result);
};
