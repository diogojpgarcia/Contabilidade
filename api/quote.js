/**
 * api/quote.js — Vercel serverless function
 *
 * Proxy para cotações de ETFs/acções europeus via yahoo-finance2.
 * O pacote gere automaticamente cookies/crumb do Yahoo Finance.
 *
 * GET /api/quote?symbols=VWCE.DE,EUNL.DE,SXR8.DE
 * Returns: { "VWCE.DE": { price, changePct, currency }, ... }
 */
const yahooFinance = require('yahoo-finance2').default;

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const { symbols } = req.query || {};
    const symList = (symbols || '').split(',').map(s => s.trim()).filter(Boolean);
    if (!symList.length) return res.status(200).json({});

    const result = {};

    await Promise.allSettled(
      symList.map(async (sym) => {
        try {
          const q = await yahooFinance.quote(sym, {}, { validateResult: false });
          const price = q?.regularMarketPrice ?? null;
          if (price == null) return;
          result[sym] = {
            price,
            changePct: q.regularMarketChangePercent ?? null,
            currency:  q.currency ?? 'EUR',
          };
          console.log(`[quote] ${sym} = ${price} ${q.currency}`);
        } catch (e) {
          console.warn(`[quote] ${sym} falhou:`, e.message);
        }
      })
    );

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=60');
    return res.json(result);
  } catch (err) {
    console.error('[quote] FATAL:', err.message);
    return res.status(200).json({});
  }
};
