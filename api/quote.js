/**
 * api/quote.js — Vercel serverless function
 *
 * Proxy para cotações de ETFs/acções europeus via Yahoo Finance.
 * Chamado server-side → sem problemas de CORS.
 *
 * GET /api/quote?symbols=VWCE.DE,EUNL.DE,SXR8.DE
 * Returns: { "VWCE.DE": { price, changePct, currency }, ... }
 */

module.exports = async function handler(req, res) {
  // CORS — permite chamadas do frontend
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { symbols } = req.query;
  if (!symbols) return res.status(400).json({ error: 'symbols param required' });

  const symList = symbols.split(',').map(s => s.trim()).filter(Boolean);
  if (!symList.length) return res.status(400).json({ error: 'no symbols' });

  const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symList.join(','))}&fields=regularMarketPrice,regularMarketChangePercent,currency`;

  try {
    const yahooRes = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; financeapp/1.0)',
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!yahooRes.ok) {
      console.error('[quote] Yahoo Finance HTTP', yahooRes.status);
      return res.status(502).json({ error: `Yahoo Finance HTTP ${yahooRes.status}` });
    }

    const data = await yahooRes.json();
    const quotes = data?.quoteResponse?.result ?? [];

    const result = {};
    for (const q of quotes) {
      const price     = q.regularMarketPrice        ?? null;
      const changePct = q.regularMarketChangePercent ?? null;
      if (price == null) continue;
      result[q.symbol] = { price, changePct, currency: q.currency ?? 'EUR' };
    }

    // Cache 5 min no Vercel CDN
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=60');
    return res.json(result);
  } catch (err) {
    console.error('[quote] Error:', err.message);
    return res.status(500).json({ error: err.message });
  }
};
