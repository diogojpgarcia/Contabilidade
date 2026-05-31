/**
 * api/quote.js — Vercel serverless function (ES module)
 * Proxy para cotações via yahoo-finance2.
 * Suporta ETFs europeus (VWCE.DE, EUNL.DE, SXR8.DE), ações US e PT.
 *
 * GET /api/quote?symbols=VWCE.DE,EUNL.DE,AAPL
 * Aceita tanto formato Yahoo (.DE) como Twelve Data (:XETRA) — converte automaticamente.
 * Returns: { "VWCE.DE": { price, changePct, currency }, ... }
 */

import yahooFinance from 'yahoo-finance2';

// ─── Twelve Data :EXCHANGE → Yahoo Finance suffix ────────────────────────────
const TD_TO_YAHOO = {
  ':XETRA': '.DE',
  ':XAMS':  '.AS',
  ':XPAR':  '.PA',
  ':XLON':  '.L',
  ':XLIS':  '.LS',
  ':XMIL':  '.MI',
  ':XMAD':  '.MC',
  ':XHEL':  '.HE',
  ':XCSE':  '.CO',
  ':XSTO':  '.ST',
  ':XOSL':  '.OL',
  ':XBRU':  '.BR',
};

/** Convert any ticker format → Yahoo Finance ticker */
function toYahoo(sym) {
  if (!sym) return null;

  // Already has Yahoo dot-exchange suffix (e.g. VWCE.DE, EDP.LS)
  if (/\.[A-Z]{1,3}$/i.test(sym)) return sym.toUpperCase();

  // Twelve Data colon format (e.g. VWCE:XETRA → VWCE.DE)
  const colonIdx = sym.indexOf(':');
  if (colonIdx > 0) {
    const base = sym.slice(0, colonIdx);
    const exc  = sym.slice(colonIdx); // e.g. ':XETRA'
    const suffix = TD_TO_YAHOO[exc.toUpperCase()];
    return suffix ? base.toUpperCase() + suffix : base.toUpperCase(); // US fallback (no suffix)
  }

  // Bare ticker — assume US (Yahoo uses bare tickers for US stocks)
  return sym.toUpperCase();
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const symList = ((req.query || {}).symbols || '')
      .split(',').map(s => s.trim()).filter(Boolean);

    if (!symList.length) return res.status(200).json({});

    const result = {};

    await Promise.allSettled(
      symList.map(async (sym) => {
        try {
          const yahooSym = toYahoo(sym);
          if (!yahooSym) return;

          const q = await yahooFinance.quote(yahooSym, {}, { validateResult: false });

          const price = q?.regularMarketPrice ?? null;
          if (price == null || isNaN(price)) {
            console.warn(`[quote] ${sym}→${yahooSym}: sem preço`);
            return;
          }

          const changePct = q?.regularMarketChangePercent ?? null;
          const currency  = q?.currency ?? 'EUR';

          result[sym] = { price, changePct, currency };
          console.log(`[quote] ${sym}→${yahooSym} = ${price} ${currency} (${changePct?.toFixed(2)}%)`);
        } catch (e) {
          console.warn(`[quote] ${sym} erro:`, e.message);
        }
      })
    );

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=60');
    return res.json(result);
  } catch (err) {
    console.error('[quote] FATAL:', err.message);
    return res.status(200).json({});
  }
}
