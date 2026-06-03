/**
 * api/stock-history.js — Vercel serverless function (ES module)
 * Proxy para histórico de ações/ETFs via Yahoo Finance chart API.
 * Evita CORS e rate limits do Twelve Data.
 *
 * GET /api/stock-history?symbol=EUNL:XETRA&period=1S
 * Returns: { prices: number[], labels: string[] } ou { prices: [], labels: [] }
 */

import https from 'https';

// ─── Twelve Data :EXCHANGE → Yahoo Finance suffix ────────────────────────────
const TD_TO_YAHOO = {
  ':XETRA': '.DE', ':XAMS': '.AS', ':XPAR': '.PA', ':XLON': '.L',
  ':XLIS': '.LS', ':XMIL': '.MI', ':XMAD': '.MC', ':XHEL': '.HE',
  ':XCSE': '.CO', ':XSTO': '.ST', ':XOSL': '.OL', ':XBRU': '.BR',
};

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

// period → { range, interval }
const PERIOD_CFG = {
  '1D':   { range: '1d',  interval: '5m'   },
  '1S':   { range: '5d',  interval: '1d'   },
  '2S':   { range: '10d', interval: '1d'   },
  '1M':   { range: '1mo', interval: '1d'   },
  '6M':   { range: '6mo', interval: '1wk'  },
  '1A':   { range: '1y',  interval: '1wk'  },
  '5A':   { range: '5y',  interval: '1mo'  },
  'Tudo': { range: 'max', interval: '1mo'  },
  // sparkline default (7 days)
  'spark': { range: '5d', interval: '1d' },
};

function formatLabel(ts, period) {
  const d = new Date(ts * 1000);
  if (period === '1D') return d.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
  if (period === '1A' || period === '5A' || period === 'Tudo')
    return d.toLocaleDateString('pt-PT', { month: 'short', year: '2-digit' });
  return d.toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' });
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

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { symbol, period = '1S' } = req.query || {};
  if (!symbol) return res.status(400).json({ prices: [], labels: [] });

  const yahooSym = toYahoo(symbol);
  const cfg = PERIOD_CFG[period] ?? PERIOD_CFG['1S'];

  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSym)}?interval=${cfg.interval}&range=${cfg.range}`;

  try {
    const { status, body } = await httpsGet(url);
    if (status !== 200 || !body) {
      console.warn(`[stock-history] ${yahooSym}: HTTP ${status}`);
      return res.status(200).json({ prices: [], labels: [] });
    }

    let data;
    try { data = JSON.parse(body); } catch {
      return res.status(200).json({ prices: [], labels: [] });
    }

    const result = data?.chart?.result?.[0];
    if (!result) return res.status(200).json({ prices: [], labels: [] });

    const timestamps = result.timestamp ?? [];
    const closes     = result.indicators?.quote?.[0]?.close ?? [];
    const currency   = result.meta?.currency ?? 'USD';

    // Converter para EUR se necessário
    let fxRate = 1;
    if (currency !== 'EUR') {
      const reportCurrency = currency === 'GBp' ? 'GBP' : currency;
      const fxUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${reportCurrency}EUR=X?interval=1d&range=5d`;
      try {
        const { status: fxStatus, body: fxBody } = await httpsGet(fxUrl);
        if (fxStatus === 200 && fxBody) {
          const fxData = JSON.parse(fxBody);
          const fxPrice = fxData?.chart?.result?.[0]?.meta?.regularMarketPrice;
          if (fxPrice && !isNaN(fxPrice)) fxRate = fxPrice;
        }
      } catch { /* usa rate=1 */ }
      if (currency === 'GBp') fxRate = fxRate / 100; // pence → GBP → EUR
    }

    const prices = [];
    const labels = [];

    for (let i = 0; i < timestamps.length; i++) {
      const p = closes[i];
      if (p == null || isNaN(p)) continue;
      prices.push(p * fxRate);
      labels.push(formatLabel(timestamps[i], period));
    }

    if (prices.length < 2) return res.status(200).json({ prices: [], labels: [] });

    res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=120');
    return res.json({ prices, labels });
  } catch (err) {
    console.error('[stock-history] FATAL:', err.message);
    return res.status(200).json({ prices: [], labels: [] });
  }
}
