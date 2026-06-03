/**
 * api/quote.js — Vercel serverless function (ES module)
 * Proxy para cotações via Yahoo Finance chart API.
 * Converte automaticamente USD → EUR (e GBP → EUR) para que o frontend
 * receba sempre preços em EUR, independentemente da bolsa do ativo.
 *
 * GET /api/quote?symbols=EUNL:XETRA,VWCE:XETRA,AAPL,SMH
 * Returns: { "SMH": { price: 212.50, changePct: 1.2, currency: "EUR" }, ... }
 */

import https from 'https';

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
  if (/\.[A-Za-z]{1,2}$/.test(sym)) return sym.toUpperCase();
  const colonIdx = sym.indexOf(':');
  if (colonIdx > 0) {
    const base   = sym.slice(0, colonIdx);
    const exc    = sym.slice(colonIdx);
    const suffix = TD_TO_YAHOO[exc.toUpperCase()];
    return suffix ? (base + suffix).toUpperCase() : base.toUpperCase();
  }
  return sym.toUpperCase();
}

function httpsGet(url) {
  return new Promise((resolve) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
      },
    }, (res) => {
      let body = '';
      res.on('data', d => (body += d));
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.setTimeout(9000, () => { req.destroy(); resolve({ status: 408, body: '' }); });
    req.on('error', () => resolve({ status: 0, body: '' }));
  });
}

/**
 * Fetch price from Yahoo Finance chart API.
 * Returns { price, changePct, currency } or null.
 */
async function fetchYahooChart(yahooSym) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSym)}?interval=1d&range=5d`;
  const { status, body } = await httpsGet(url);
  if (status !== 200 || !body) return null;

  let data;
  try { data = JSON.parse(body); } catch { return null; }

  const meta = data?.chart?.result?.[0]?.meta;
  if (!meta) return null;

  const price = meta.regularMarketPrice ?? meta.chartPreviousClose ?? null;
  if (!price || isNaN(price)) return null;

  const prevClose = meta.chartPreviousClose ?? meta.previousClose ?? price;
  const changePct = prevClose ? ((price - prevClose) / prevClose) * 100 : null;
  const currency  = meta.currency ?? 'USD';

  return { price, changePct, currency };
}

/**
 * Fetch FX rate from Yahoo Finance (e.g. USDEUR=X → how many EUR per 1 USD).
 * Returns the rate or null.
 */
async function fetchFxRate(fromCurrency, toCurrency = 'EUR') {
  if (fromCurrency === toCurrency) return 1;
  const pair = `${fromCurrency}${toCurrency}=X`;
  const q = await fetchYahooChart(pair);
  return q?.price ?? null;
}

// Cache FX rates for the lifetime of the function invocation
const fxCache = {};

async function getRate(currency) {
  if (currency === 'EUR') return 1;
  if (fxCache[currency] !== undefined) return fxCache[currency];
  const rate = await fetchFxRate(currency, 'EUR');
  fxCache[currency] = rate;
  return rate;
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

          const q = await fetchYahooChart(yahooSym);
          if (!q) {
            console.warn(`[quote] ${sym}→${yahooSym}: sem dados`);
            return;
          }

          let { price, changePct, currency } = q;

          // Converter para EUR se necessário (USD, GBp=pence→GBP→EUR, etc.)
          if (currency !== 'EUR') {
            // London Stock Exchange preços em pence (GBp) — converter para GBP primeiro
            const reportCurrency = currency === 'GBp' ? 'GBP' : currency;
            let fxRate = await getRate(reportCurrency);

            if (fxRate && fxRate > 0) {
              const rawPrice = currency === 'GBp' ? price / 100 : price;
              price    = rawPrice * fxRate;
              currency = 'EUR';
              // debug removed
            } else {
              console.warn(`[quote] ${sym}: não foi possível obter taxa ${currency}→EUR`);
            }
          }

          result[sym] = { price, changePct, currency };
          // debug removed
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
