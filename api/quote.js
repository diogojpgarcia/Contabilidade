/**
 * api/quote.js — Vercel serverless function
 * Proxy para cotações via Stooq — sem dependências externas, sem CORS.
 *
 * GET /api/quote?symbols=VWCE.DE,EDP.LS,AAPL
 * Returns: { "VWCE.DE": { price, changePct, currency }, ... }
 */

import https from 'https';

// Twelve Data MIC code → Stooq suffix
const MIC_SUFFIX = {
  XETRA: '.de', XFRA: '.de',
  XLON:  '.uk', XLIS: '.ls',
  XPAR:  '.fr', XAMS: '.nl',
  XMIL:  '.it', XMAD: '.es',
  XBRU:  '.be', XHEL: '.fi',
  XSTO:  '.se', XCSE: '.dk',
  XOSL:  '.no',
};

// Stooq suffix → ISO currency
const SUFFIX_CCY = {
  de: 'EUR', ls: 'EUR', fr: 'EUR', nl: 'EUR',
  it: 'EUR', es: 'EUR', be: 'EUR', fi: 'EUR',
  uk: 'GBP', se: 'SEK', dk: 'DKK', no: 'NOK',
  us: 'USD',
};

/**
 * Convert our internal ticker to a Stooq ticker (always lowercase).
 * Handles:
 *   VWCE.DE    → vwce.de       (dot-exchange suffix)
 *   VWCE:XETRA → vwce.de       (MIC code)
 *   EDP.LS     → edp.ls        (Portuguese stock)
 *   AAPL       → aapl.us       (US stock, bare)
 */
function toStooq(sym) {
  if (!sym) return null;
  // Already has dot-exchange suffix (e.g. VWCE.DE, EDP.LS, CSPX.L)
  if (/\.[A-Za-z]{1,3}$/.test(sym)) return sym.toLowerCase();
  // MIC code format (e.g. VWCE:XETRA)
  const micMatch = sym.match(/^([^:]+):([A-Z]+)$/);
  if (micMatch) {
    const suffix = MIC_SUFFIX[micMatch[2]];
    return suffix
      ? (micMatch[1] + suffix).toLowerCase()
      : micMatch[1].toLowerCase() + '.us';
  }
  // Bare ticker — assume US
  return sym.toLowerCase() + '.us';
}

function httpsGet(url) {
  return new Promise((resolve) => {
    const req = https.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': '*/*' },
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
 * Parse Stooq CSV with format code sd2t2ohlcvp:
 * Columns: Symbol, Date, Time, Open, High, Low, Close, Volume, %Chg
 * Positions:  0      1     2     3     4     5    6      7       8
 */
function parseStooq(stooqSym, body) {
  const lines = body.trim().split('\n');
  if (lines.length < 2) return null;
  const vals = lines[1].split(',');
  if (vals.length < 7) return null;

  const close = parseFloat(vals[6]);
  if (!close || isNaN(close) || close <= 0) return null;

  const changePct = vals.length > 8 ? parseFloat(vals[8]) : null;
  const suffix    = (stooqSym.match(/\.([a-z]+)$/) || [])[1] || 'us';
  const currency  = SUFFIX_CCY[suffix] ?? 'EUR';

  return {
    price:     close,
    changePct: (changePct != null && !isNaN(changePct)) ? changePct : null,
    currency,
  };
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
          const stooqSym = toStooq(sym);
          if (!stooqSym) return;

          // sd2t2ohlcvp → Symbol,Date,Time,Open,High,Low,Close,Volume,%Chg
          const url = `https://stooq.com/q/l/?s=${encodeURIComponent(stooqSym)}&f=sd2t2ohlcvp&e=csv`;
          const { status, body } = await httpsGet(url);

          if (status !== 200 || !body.includes(',')) {
            console.warn(`[quote] ${sym}→${stooqSym}: HTTP ${status}`);
            return;
          }

          const parsed = parseStooq(stooqSym, body);
          if (!parsed) {
            console.warn(`[quote] ${sym}→${stooqSym}: dados inválidos ou mercado fechado`);
            return;
          }

          result[sym] = parsed;
          console.log(`[quote] ${sym}→${stooqSym} = ${parsed.price} ${parsed.currency} (${parsed.changePct}%)`);
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
};
