/**
 * assetPrice.js
 * Live price fetcher for stocks and crypto via Twelve Data.
 *
 * Stocks  – VITE_TWELVE_DATA_KEY required  (free: 8 credits/min, 800/day)
 * Crypto  – Twelve Data BTC/USD pairs when key is set;
 *           falls back to CoinGecko (no key needed) for any failures.
 *
 * Exported:
 *   getPrice(symbol)              – single price via /price ("AAPL" or "BTC/USD")
 *   fetchStockQuote(ticker)       – price + changePct via /quote
 *   fetchCryptoTwelveData(syms)   – batch crypto prices; CoinGecko fallback
 *   fetchCryptoBatch(syms)        – CoinGecko batch (used internally as fallback)
 *   fetchStockHistory(ticker)     – 7-day sparkline via /time_series
 *   fetchCryptoHistoryBatch(syms) – 7-day sparkline via CoinGecko market_chart
 *   fetchStockSearch(query)       – autocomplete via /symbol_search
 *
 * All functions return null / {} on any failure — UI never crashes.
 * In-memory caches with CACHE_TTL = 5 min and HISTORY_TTL = 5 min.
 */

// ─── constants ───────────────────────────────────────────────────────────────

// Free Twelve Data: 8 credits/min, 800/day.
// With batch calls (1 HTTP request for all symbols), each refresh costs N credits
// but resolves in a single round-trip — much faster than N parallel calls.
// 800 credits/day ÷ ~5 symbols = 160 refreshes/day → safe at 8-min intervals.
export const CACHE_TTL       = 8 * 60_000;  // 8 min — stocks/ETFs (Twelve Data credits)
export const CRYPTO_CACHE_TTL = 2 * 60_000; // 2 min — crypto via CoinGecko (free/generous)
export const HISTORY_TTL     = 10 * 60_000; // 10 min — sparkline history changes slowly
const        FETCH_TIMEOUT   = 12_000;       // 12 s — headroom for slow mobile networks

const TWELVE_DATA_KEY = import.meta.env.VITE_TWELVE_DATA_KEY ?? '';
/** True when a Twelve Data API key is configured. */
export const HAS_STOCK_KEY = TWELVE_DATA_KEY.length > 0;

// ─── startup diagnostics ─────────────────────────────────────────────────────
// Logged once on module load — visible in DevTools on any device/platform.
      //       // 
// ─── in-memory caches ────────────────────────────────────────────────────────

/** ticker → { price, changePct, ts } */
const stockCache  = new Map();
/** coinId → { price, changePct24h, ts } */
const cryptoCache = new Map();
/** ticker → { prices: number[], ts } */
const stockHistoryCache  = new Map();
/** coinId → { prices: number[], ts } */
const cryptoHistoryCache = new Map();
/** `${ticker}:${period}` → { prices: number[], labels: string[], ts } */
const periodHistoryCache = new Map();

// ─── helpers ─────────────────────────────────────────────────────────────────

/**
 * True when lastUpdated (ISO string) is missing or older than ttl ms.
 * Defaults to CACHE_TTL.
 */
export const isStale = (lastUpdated, ttl = CACHE_TTL) =>
  !lastUpdated || (Date.now() - new Date(lastUpdated).getTime()) > ttl;

/** isStale variant using the shorter crypto TTL */
export const isStaleCrypto = (lastUpdated) => isStale(lastUpdated, CRYPTO_CACHE_TTL);

/** "agora mesmo", "3m", "1h", "2d" — null when no date. */
export const formatAge = (lastUpdated) => {
  if (!lastUpdated) return null;
  const ms  = Date.now() - new Date(lastUpdated).getTime();
  const min = Math.floor(ms / 60_000);
  if (min <  1) return 'agora mesmo';
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  return h < 24 ? `${h}h` : `${Math.floor(h / 24)}d`;
};

const abortAfter = (ms) => {
  const ctrl = new AbortController();
  const t    = setTimeout(() => ctrl.abort(), ms);
  return { signal: ctrl.signal, clear: () => clearTimeout(t) };
};

// ─── CoinGecko ID mapping ────────────────────────────────────────────────────
// Maps common ticker symbols → CoinGecko coin IDs.
// Extend freely; unknown symbols fall back to lowercase symbol.

const COIN_IDS = {
  // Layer 1
  BTC:   'bitcoin',              ETH:   'ethereum',           BNB:  'binancecoin',
  SOL:   'solana',               ADA:   'cardano',             XRP:  'ripple',
  DOT:   'polkadot',             DOGE:  'dogecoin',            AVAX: 'avalanche-2',
  LTC:   'litecoin',             BCH:   'bitcoin-cash',        ETC:  'ethereum-classic',
  XMR:   'monero',               XLM:   'stellar',             VET:  'vechain',
  ALGO:  'algorand',             NEAR:  'near',                ICP:  'internet-computer',
  APT:   'aptos',                SUI:   'sui',                 TRX:  'tron',
  TON:   'the-open-network',     ATOM:  'cosmos',              FIL:  'filecoin',
  // Layer 2 & DeFi
  MATIC: 'matic-network',        LINK:  'chainlink',           UNI:  'uniswap',
  OP:    'optimism',             ARB:   'arbitrum',            INJ:  'injective-protocol',
  AAVE:  'aave',                 MKR:   'maker',               CRV:  'curve-dao-token',
  SNX:   'havven',               LDO:   'lido-dao',            RUNE: 'thorchain',
  GRT:   'the-graph',            JUP:   'jupiter-exchange-solana',
  // AI / Infra
  RNDR:  'render-token',         FET:   'fetch-ai',
  // NFT / Gaming / Metaverse
  APE:   'apecoin',              SAND:  'the-sandbox',         MANA: 'decentraland',
  // Meme
  SHIB:  'shiba-inu',            PEPE:  'pepe',
  WIF:   'dogwifcoin',           BONK:  'bonk',
};

const toCoinId = (symbol) =>
  COIN_IDS[symbol?.toUpperCase()] ?? symbol?.toLowerCase() ?? '';

// ─── UCITS ETF exchange map ──────────────────────────────────────────────────
// Maps bare UCITS ETF tickers → their EUR-denominated Twelve Data symbol.
// XETRA (.DE) is preferred: liquid, EUR, well supported by Twelve Data free tier.
// When a user has "VWCE" saved (no suffix), we resolve it to "VWCE.DE" automatically.
const UCITS_EUR_TICKER = {
  // Vanguard
  VWCE:  'VWCE.DE',   // FTSE All-World Acc — XETRA EUR
  VUSA:  'VUSA.DE',   // S&P 500 UCITS — XETRA EUR
  VWRL:  'VWRL.AS',   // FTSE All-World Dist — Euronext Amsterdam EUR
  VAGP:  'VAGP.L',    // Global Aggregate Bond — London USD (best available)
  VEUR:  'VEUR.AS',   // FTSE Developed Europe — Euronext Amsterdam EUR
  VERX:  'VERX.AS',   // FTSE Developed Europe ex UK — Euronext Amsterdam EUR
  VFEM:  'VFEM.AS',   // FTSE Emerging Markets — Euronext Amsterdam EUR
  // iShares (BlackRock)
  IWDA:  'IWDA.AS',   // MSCI World Acc — Euronext Amsterdam EUR
  EUNL:  'EUNL.DE',   // MSCI World (same as IWDA, XETRA) — XETRA EUR
  CSPX:  'CSPX.L',    // Core S&P 500 Acc — London USD (only liquid listing)
  SXR8:  'SXR8.DE',   // Core S&P 500 Acc EUR-hedged — XETRA EUR
  EXSA:  'EXSA.DE',   // Core EURO STOXX 50 — XETRA EUR
  IEMA:  'IEMA.AS',   // Core MSCI EM IMI — Euronext Amsterdam EUR
  AGGH:  'AGGH.L',    // Core Global Aggregate Bond — London USD
  IAGG:  'IAGG.DE',   // Core Global Aggregate Bond EUR-hedged — XETRA EUR
  IDTL:  'IDTL.L',    // $ Treasury Bond 20+yr — London USD
  IS3N:  'IS3N.DE',   // Core MSCI EM IMI — XETRA EUR
  SPPW:  'SPPW.DE',   // Core MSCI World — XETRA EUR
  // Xtrackers (DWS)
  XDWD:  'XDWD.DE',   // MSCI World Swap Acc — XETRA EUR
  XDEM:  'XDEM.DE',   // MSCI World Momentum — XETRA EUR
  DBXW:  'DBXW.DE',   // MSCI World Swap — XETRA EUR
  // Amundi / Lyxor
  MEUD:  'MEUD.PA',   // MSCI Europe — Euronext Paris EUR
  LCWD:  'LCWD.PA',   // MSCI World — Euronext Paris EUR
  PANX:  'PANX.PA',   // Nasdaq-100 UCITS — Euronext Paris EUR
  // SPDR
  SPXS:  'SPXS.DE',   // S&P 500 UCITS — XETRA EUR
  // ── Ações portuguesas (Euronext Lisboa, EUR) ─────────────────────────────
  EDP:   'EDP.LS',    // EDP — Energias de Portugal
  GALP:  'GALP.LS',   // Galp Energia
  BCP:   'BCP.LS',    // Millennium BCP
  JMT:   'JMT.LS',    // Jerónimo Martins
  SON:   'SON.LS',    // Sonae SGPS
  NOS:   'NOS.LS',    // NOS SGPS
  EGL:   'EGL.LS',    // Greenvolt
};

/**
 * Resolve a potentially bare ETF/stock ticker to its Twelve Data symbol.
 * If the ticker already has an exchange suffix (contains "."), returns as-is.
 * Otherwise checks UCITS_EUR_TICKER map, falling back to the original ticker.
 */
export const resolveEquityTicker = (ticker) => {
  if (!ticker) return ticker;
  if (ticker.includes('.')) return ticker;             // already has exchange suffix
  return UCITS_EUR_TICKER[ticker.toUpperCase()] ?? ticker;
};

// ─── stocks (Twelve Data) ────────────────────────────────────────────────────

/**
 * Fetch a single stock quote.
 * Returns { price, changePct } or null.
 */
export const fetchStockQuote = async (ticker) => {
  if (!HAS_STOCK_KEY || !ticker) return null;

  // Resolve bare UCITS tickers to their EUR exchange variant (e.g. VWCE → VWCE.DE)
  const resolved = resolveEquityTicker(ticker);

  const hit = stockCache.get(resolved);
  if (hit && Date.now() - hit.ts < CACHE_TTL) return hit;

  const { signal, clear } = abortAfter(FETCH_TIMEOUT);
  try {
    const url = `https://api.twelvedata.com/quote?symbol=${encodeURIComponent(resolved)}&apikey=${TWELVE_DATA_KEY}`;
    const res = await fetch(url, { signal });
    if (!res.ok) {
      console.error(`[assetPrice] fetchStockQuote HTTP ${res.status} — ${resolved}`);
      return null;
    }

    const data = await res.json();
    if (data.code || data.status === 'error') {
      console.error(`[assetPrice] API ERROR ${resolved}:`, data);
      return null;
    }

    const price     = parseFloat(data.close) || null;
    const _chg      = parseFloat(data.percent_change);
    const changePct = Number.isFinite(_chg) ? _chg : null;
    const currency  = data.currency ?? '?';
    if (price === null) return null;

    if (currency !== 'EUR' && currency !== '?') {
      console.warn(`[assetPrice] ${resolved} priced in ${currency} — não EUR. Considera usar a versão EUR da bolsa.`);
    }

    const entry = { price, changePct, currency, ts: Date.now() };
    // Cache under both original and resolved ticker so callers using either key get a hit
    stockCache.set(resolved, entry);
    if (resolved !== ticker) stockCache.set(ticker, entry);
    return entry;
  } catch (err) {
    console.error(`[assetPrice] FETCH FAILED ${resolved}:`, err);
    return null;
  } finally {
    clear();
  }
};

// ─── crypto (CoinGecko) ──────────────────────────────────────────────────────

/**
 * Batch-fetch current EUR prices + 24 h change for an array of coin symbols.
 * Returns { [symbol]: { price, changePct24h } } — missing symbols are omitted.
 * No API key needed; uses CoinGecko public endpoint.
 */
export const fetchCryptoBatch = async (symbols) => {
  if (!symbols?.length) return {};

  // Split into cached vs stale
  const result   = {};
  const toFetch  = [];

  for (const sym of symbols) {
    const id  = toCoinId(sym);
    const hit = cryptoCache.get(id);
    if (hit && Date.now() - hit.ts < CRYPTO_CACHE_TTL) {
      result[sym] = hit;
    } else {
      toFetch.push({ sym, id });
    }
  }

  if (!toFetch.length) return result;

  const ids = [...new Set(toFetch.map(x => x.id))].join(',');
  const { signal, clear } = abortAfter(FETCH_TIMEOUT);

  try {
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(ids)}&vs_currencies=eur&include_24hr_change=true`;
    const res = await fetch(url, { signal });   // no Content-Type on GET — avoids CORS preflight
    if (!res.ok) {
      console.error(`[assetPrice] CoinGecko HTTP ${res.status}`);
      return result;
    }

    const data = await res.json();
      // 
    for (const { sym, id } of toFetch) {
      const coin = data[id];
      if (!coin) continue;
      const _p   = Number(coin.eur);
      const _chg = Number(coin.eur_24h_change);
      const entry = {
        price:        Number.isFinite(_p)   ? _p   : null,   // never store NaN
        changePct24h: Number.isFinite(_chg) ? _chg : null,
        ts:           Date.now(),
      };
      cryptoCache.set(id, entry);
      result[sym] = entry;
    }
  } catch (err) {
    console.error('[assetPrice] FETCH FAILED CoinGecko:', err);
    // return whatever was cached
  } finally {
    clear();
  }

  return result;
};

/**
 * Alias mantido para compatibilidade com PatrimonyView.
 * CoinGecko devolve preços em EUR diretamente — melhor que converter de USD.
 * Se no futuro quisermos usar Twelve Data para crypto basta substituir aqui.
 */
export const fetchCryptoTwelveData = fetchCryptoBatch;

/**
 * Batch-fetch quotes for multiple stock/ETF tickers in ONE HTTP request.
 * Returns { [ticker]: { price, changePct } } — missing tickers are omitted.
 *
 * Free Twelve Data: 1 credit per symbol, but only 1 round-trip regardless of
 * how many symbols you request → much faster than N parallel fetchStockQuote calls.
 * Respects the in-memory cache (CACHE_TTL) to avoid redundant API credits.
 */
export const fetchStockQuoteBatch = async (tickers) => {
  if (!HAS_STOCK_KEY || !tickers?.length) return {};

  const result  = {};
  // Map: resolved ticker → original ticker (so we return results keyed by original)
  const resolvedMap = new Map(); // resolvedTicker → originalTicker
  const toFetch = [];

  for (const ticker of tickers) {
    if (!ticker) continue;
    const resolved = resolveEquityTicker(ticker);
    resolvedMap.set(resolved, ticker);
    // Check cache under resolved key
    const hit = stockCache.get(resolved) ?? stockCache.get(ticker);
    if (hit && Date.now() - hit.ts < CACHE_TTL) {
      result[ticker] = hit;
    } else {
      toFetch.push(ticker);
    }
  }

  if (!toFetch.length) return result;

  // Use resolved tickers in the API request
  const resolvedTickers = toFetch.map(t => resolveEquityTicker(t));
  const symbolList = resolvedTickers.join(',');
  const { signal, clear } = abortAfter(FETCH_TIMEOUT);

  try {
    const url = `https://api.twelvedata.com/quote?symbol=${encodeURIComponent(symbolList)}&apikey=${TWELVE_DATA_KEY}`;
    const res = await fetch(url, { signal });
    if (!res.ok) {
      console.error(`[assetPrice] fetchStockQuoteBatch HTTP ${res.status}`);
      return result;
    }

    const data = await res.json();

    // Parse one quote object; store under both resolved and original ticker keys
    const parse = (q, resolvedTicker, originalTicker) => {
      if (!q || q.code || q.status === 'error') return;
      const price     = parseFloat(q.close) || null;
      const _chg      = parseFloat(q.percent_change);
      const changePct = Number.isFinite(_chg) ? _chg : null;
      const currency  = q.currency ?? '?';
      if (price === null) return;

      if (currency !== 'EUR' && currency !== '?') {
        console.warn(`[assetPrice] ${resolvedTicker} cotado em ${currency} — não EUR. Verifica a bolsa do ETF.`);
      }

      const entry = { price, changePct, currency, ts: Date.now() };
      stockCache.set(resolvedTicker, entry);
      if (resolvedTicker !== originalTicker) stockCache.set(originalTicker, entry);
      result[originalTicker] = entry;
    };

    if (toFetch.length === 1) {
      parse(data, resolvedTickers[0], toFetch[0]);
    } else {
      toFetch.forEach((origTicker, i) => {
        const resolved = resolvedTickers[i];
        // Twelve Data keys multi-symbol responses by the resolved ticker
        const q = data[resolved] ?? data[origTicker];
        parse(q, resolved, origTicker);
      });
    }
  } catch (err) {
    console.error('[assetPrice] fetchStockQuoteBatch FAILED:', err);
  } finally {
    clear();
  }

  return result;
};

// ─── history (sparkline data) ────────────────────────────────────────────────

/**
 * Fetch 7-day daily close prices for a stock (Twelve Data time_series).
 * Returns number[] oldest→newest, or null on failure / no key.
 */
export const fetchStockHistory = async (ticker) => {
  if (!HAS_STOCK_KEY || !ticker) return null;

  const resolved = resolveEquityTicker(ticker);
  const hit = stockHistoryCache.get(resolved) ?? stockHistoryCache.get(ticker);
  if (hit && Date.now() - hit.ts < HISTORY_TTL) return hit.prices;

  const { signal, clear } = abortAfter(FETCH_TIMEOUT);
  try {
    const res = await fetch(
      `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(resolved)}&interval=1day&outputsize=8&apikey=${TWELVE_DATA_KEY}`,
      { signal }
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (data.code || data.status === 'error' || !Array.isArray(data.values)) return null;

    // values are newest-first → reverse to oldest-first, take last 7
    const prices = data.values
      .slice(0, 7)
      .reverse()
      .map(v => parseFloat(v.close))
      .filter(n => !isNaN(n));
    if (prices.length < 2) return null;

    const entry = { prices, ts: Date.now() };
    stockHistoryCache.set(resolved, entry);
    if (resolved !== ticker) stockHistoryCache.set(ticker, entry);
    return prices;
  } catch {
    return null;
  } finally {
    clear();
  }
};

/**
 * Fetch 7-day EUR price history for an array of crypto symbols (CoinGecko).
 * Returns { [symbol]: number[] } — missing/failed symbols are omitted.
 * No API key needed.
 */
export const fetchCryptoHistoryBatch = async (symbols) => {
  if (!symbols?.length) return {};

  const result  = {};
  const toFetch = [];

  for (const sym of symbols) {
    const id  = toCoinId(sym);
    const hit = cryptoHistoryCache.get(id);
    if (hit && Date.now() - hit.ts < HISTORY_TTL) {
      result[sym] = hit.prices;
    } else {
      toFetch.push({ sym, id });
    }
  }

  if (!toFetch.length) return result;

  // One request per coin (CoinGecko market_chart cannot batch)
  await Promise.allSettled(
    toFetch.map(async ({ sym, id }) => {
      const { signal, clear } = abortAfter(FETCH_TIMEOUT);
      try {
        const res = await fetch(
          `https://api.coingecko.com/api/v3/coins/${encodeURIComponent(id)}/market_chart?vs_currency=eur&days=7&interval=daily`,
          { signal }
        );
        if (!res.ok) return;
        const data = await res.json();
        if (!Array.isArray(data?.prices) || data.prices.length < 2) return;

        const prices = data.prices.map(([, p]) => p);
        cryptoHistoryCache.set(id, { prices, ts: Date.now() });
        result[sym] = prices;
      } catch {
        // silent — return whatever was already in result
      } finally {
        clear();
      }
    })
  );

  return result;
};

// ─── Period history (1D / 1S / 2S / 1M / 1A) ────────────────────────────────
//
//  fetchPeriodHistory(sym, period, type)
//    sym    – ticker (stocks/etfs) or coin symbol (crypto)
//    period – '1D' | '1S' | '2S' | '1M' | '1A'
//    type   – 'stock' | 'etf' | 'crypto'
//  Returns { prices: number[], labels: string[] } | null
//
const PERIOD_TTL = 5 * 60_000;

const STOCK_PERIOD_CFG = {
  '1D':   { interval: '5min',   outputsize: 78  },
  '1S':   { interval: '1day',   outputsize: 7   },
  '2S':   { interval: '1day',   outputsize: 14  },
  '1M':   { interval: '1day',   outputsize: 30  },
  '6M':   { interval: '1week',  outputsize: 26  },
  '1A':   { interval: '1week',  outputsize: 52  },
  '5A':   { interval: '1month', outputsize: 60  },
  'Tudo': { interval: '1month', outputsize: 120 },
};

const CRYPTO_PERIOD_DAYS = {
  '1D': 1, '1S': 7, '2S': 14, '1M': 30,
  '6M': 180, '1A': 365, '5A': 1825, 'Tudo': 'max',
};

function formatLabel(dateStr, period) {
  const d = new Date(dateStr);
  if (period === '1D') return d.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
  if (period === '1A') return d.toLocaleDateString('pt-PT', { month: 'short', year: '2-digit' });
  return d.toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' });
}

function formatCryptoLabel(ts, period) {
  const d = new Date(ts);
  if (period === '1D') return d.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
  if (period === '1A') return d.toLocaleDateString('pt-PT', { month: 'short', year: '2-digit' });
  return d.toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' });
}

export const fetchPeriodHistory = async (sym, period, type) => {
  if (!sym || !period) return null;
  const cacheKey = `${sym}:${period}`;
  const hit = periodHistoryCache.get(cacheKey);
  if (hit && Date.now() - hit.ts < PERIOD_TTL) return { prices: hit.prices, labels: hit.labels };

  try {
    if (type === 'crypto') {
      const id = toCoinId(sym);
      const days = CRYPTO_PERIOD_DAYS[period] ?? 7;
      const interval = period === '1D' ? 'hourly' : 'daily';
      const { signal, clear } = abortAfter(FETCH_TIMEOUT);
      const res = await fetch(
        `https://api.coingecko.com/api/v3/coins/${encodeURIComponent(id)}/market_chart?vs_currency=eur&days=${days}${days !== 'max' ? `&interval=${interval}` : ''}`,
        { signal }
      );
      clear();
      if (!res.ok) return null;
      const data = await res.json();
      if (!Array.isArray(data?.prices) || data.prices.length < 2) return null;
      const prices = data.prices.map(([, p]) => p);
      const labels = data.prices.map(([ts]) => formatCryptoLabel(ts, period));
      periodHistoryCache.set(cacheKey, { prices, labels, ts: Date.now() });
      return { prices, labels };
    } else {
      if (!HAS_STOCK_KEY) return null;
      const cfg = STOCK_PERIOD_CFG[period] ?? STOCK_PERIOD_CFG['1S'];
      const resolvedSym = resolveEquityTicker(sym); // resolve UCITS bare tickers (e.g. VWCE → VWCE.DE)
      const { signal, clear } = abortAfter(FETCH_TIMEOUT);
      const res = await fetch(
        `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(resolvedSym)}&interval=${cfg.interval}&outputsize=${cfg.outputsize}&apikey=${TWELVE_DATA_KEY}`,
        { signal }
      );
      clear();
      if (!res.ok) return null;
      const data = await res.json();
      if (data.code || data.status === 'error' || !Array.isArray(data.values)) return null;
      const reversed = [...data.values].reverse();
      const prices = reversed.map(v => parseFloat(v.close)).filter(n => !isNaN(n));
      const labels = reversed.map(v => formatLabel(v.datetime, period));
      if (prices.length < 2) return null;
      periodHistoryCache.set(cacheKey, { prices, labels, ts: Date.now() });
      return { prices, labels };
    }
  } catch {
    return null;
  }
};

// ─── localStorage price cache ─────────────────────────────────────────────────
//
//  Schema (per ticker, key = "price_AAPL"):
//    { price: number, timestamp: number }
//
//  Flow for getPrice(ticker):
//    1. getCachedPrice()  →  fresh hit (< CACHE_TTL)  →  return cached price
//    2. fetchPrice()      →  API call + persist         →  return fresh price
//    3. API failure       →  getCachedPrice() stale     →  FALLBACK CACHE
//
//  In-flight deduplication: concurrent calls for the same ticker share one
//  Promise, so the API is never hit more than once simultaneously per symbol.

const LS_PREFIX = 'price_';

/** In-flight fetch promises keyed by normalised ticker. */
const inFlight = new Map();

// ── helpers ────────────────────────────────────────────────────────────────────

const lsKey = (ticker) => LS_PREFIX + ticker.toUpperCase();

const lsWrite = (ticker, price) => {
  try {
    localStorage.setItem(lsKey(ticker), JSON.stringify({ price, timestamp: Date.now() }));
  } catch { /* storage full / disabled — silent */ }
};

// ── public API ─────────────────────────────────────────────────────────────────

/**
 * Read a price entry from localStorage.
 * Returns { price: number, timestamp: number } or null.
 * Does NOT check TTL — callers decide if the entry is fresh enough.
 */
export const getCachedPrice = (ticker) => {
  if (!ticker) return null;
  try {
    const raw = localStorage.getItem(lsKey(ticker));
    if (!raw) return null;
    const entry = JSON.parse(raw);
    if (typeof entry?.price !== 'number' || typeof entry?.timestamp !== 'number') return null;
    return entry;
  } catch {
    return null;
  }
};

/**
 * Fetch a fresh price from Twelve Data /price, persist it to localStorage,
 * and return the numeric value.
 *
 * Concurrent calls for the same ticker are deduplicated — only one HTTP
 * request is made regardless of how many callers are waiting.
 *
 * Returns a number or null on any failure.
 */
export const fetchPrice = async (ticker) => {
  if (!HAS_STOCK_KEY || !ticker) return null;

  const key = ticker.toUpperCase();

  // Return the already-running promise (deduplication)
  if (inFlight.has(key)) return inFlight.get(key);

  const promise = (async () => {
    const { signal, clear } = abortAfter(FETCH_TIMEOUT);
    try {
      const res = await fetch(
        `https://api.twelvedata.com/price?symbol=${encodeURIComponent(key)}&apikey=${TWELVE_DATA_KEY}`,
        { signal }
      );
      if (!res.ok) return null;

      const data = await res.json();
      if (data.code || data.status === 'error') return null;

      const price = parseFloat(data.price);
      if (isNaN(price)) return null;

      lsWrite(key, price);
      return price;
    } catch (err) {
      console.error(`[assetPrice] fetchPrice error — ${key}:`, err);
      return null;
    } finally {
      clear();
      inFlight.delete(key); // always release the slot
    }
  })();

  inFlight.set(key, promise);
  return promise;
};

/**
 * Primary entry point — resolves a price for any Twelve Data symbol
 * ("AAPL", "BTC", "BTC/USD", "IWDA.L", …) using a three-tier strategy:
 *
 *   1. CACHE HIT     – localStorage entry is fresher than CACHE_TTL → no API call
 *   2. FETCH API     – entry is stale / absent  → fetch, persist, return fresh price
 *   3. FALLBACK CACHE – API failed              → return last known price if available
 *
 * Auto-detects crypto symbols: if the ticker is a bare base symbol (e.g. "BTC")
 * that exists in COIN_IDS, it is automatically converted to the Twelve Data
 * pair format "BTC/USD" before calling the API.
 *
 * Never throws; returns 0 when there is truly no data (never null/NaN).
 *
 * @param {string}  ticker    — symbol in any format ("AAPL", "BTC", "BTC/USD")
 * @param {string?} assetType — optional hint: "crypto" forces USD pair conversion
 */
export const getPrice = async (ticker, assetType = null) => {
  if (!ticker) return 0;

  // Normalise: strip any existing pair suffix so we can re-apply consistently
  const base  = ticker.toUpperCase().split('/')[0];
  const isCrypto = assetType === 'crypto' || COIN_IDS[base] !== undefined;
  // Twelve Data /price requires pair format for crypto: "BTC" → "BTC/USD"
  const key   = isCrypto ? `${base}/USD` : ticker.toUpperCase();

  const entry = getCachedPrice(key);
  const age   = entry ? Date.now() - entry.timestamp : Infinity;

  // 1 — fresh cache hit
  if (entry && age < CACHE_TTL) {
    const safePrice = Number(entry.price);
    return Number.isFinite(safePrice) ? safePrice : 0;
  }

  // 2 — fetch from API
  const fresh = await fetchPrice(key);
  if (fresh !== null) return fresh;

  // 3 — stale fallback (API down / no key)
  if (entry) {
    const safePrice = Number(entry.price);
    return Number.isFinite(safePrice) ? safePrice : 0;
  }

  return 0;  // never null — callers can safely do arithmetic without ?? guard
};

// ─── crypto prices via Twelve Data (BTC/USD format) ──────────────────────────
// When VITE_TWELVE_DATA_KEY is set, uses Twelve Data /quote with BTC/USD pairs.
// Falls back to CoinGecko (fetchCryptoBatch) for any symbols that fail or when
// no API key is configured.  Returns the same shape as fetchCryptoBatch:
//   { [symbol]: { price, changePct24h } }

/**
 * Batch-fetch crypto prices via Twelve Data (BTC/USD, ETH/USD, …).
 * Falls back to CoinGecko for individual failures or when no key is set.
 * Returns { [symbol]: { price, changePct24h } }.
 */
export const fetchCryptoTwelveData = async (symbols) => {
  if (!symbols?.length) return {};

  // No key → delegate entirely to CoinGecko
  if (!HAS_STOCK_KEY) return fetchCryptoBatch(symbols);

  const result  = {};
  const toFetch = [];

  for (const sym of symbols) {
    const tdSym = `${sym.toUpperCase()}/USD`;
    const hit   = cryptoCache.get(tdSym);
    if (hit && Date.now() - hit.ts < CACHE_TTL) {
      result[sym] = hit;
    } else {
      toFetch.push({ sym, tdSym });
    }
  }

  if (!toFetch.length) return result;

  const symbolList = toFetch.map(x => x.tdSym).join(',');
  const { signal, clear } = abortAfter(FETCH_TIMEOUT);

  try {
    const url = `https://api.twelvedata.com/quote?symbol=${encodeURIComponent(symbolList)}&apikey=${TWELVE_DATA_KEY}`;
    const res = await fetch(url, { signal });   // no Content-Type on GET — avoids CORS preflight
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
      // 
    for (const { sym, tdSym } of toFetch) {
      // Single-symbol responses come unwrapped; multi-symbol come as { "BTC/USD": {...}, … }
      const q = toFetch.length === 1 ? data : (data[tdSym] ?? data[sym]);
      if (!q || q.code || q.status === 'error') {
        console.error(`[assetPrice] API ERROR ${tdSym}:`, q);
        continue;
      }

      const price     = parseFloat(q.close) || null;               // NaN || null → null ✓
      const _chg      = parseFloat(q.percent_change);
      const changePct = Number.isFinite(_chg) ? _chg : null;       // NaN → null (never store NaN)
      if (!price) continue;

      const entry = { price, changePct24h: changePct, ts: Date.now() };
      cryptoCache.set(tdSym, entry);
      result[sym] = entry;
    }
  } catch (err) {
    console.error('[assetPrice] FETCH FAILED crypto (TD):', err);
  } finally {
    clear();
  }

  // CoinGecko fallback for any symbols Twelve Data didn't return
  const failed = toFetch.filter(({ sym }) => !result[sym]).map(({ sym }) => sym);
  if (failed.length) {
    try {
      const fallback = await fetchCryptoBatch(failed);
      Object.assign(result, fallback);
    } catch { /* silent */ }
  }

  return result;
};

// ─── stock symbol search (Twelve Data) ───────────────────────────────────────

/**
 * Search for stocks/ETFs by name or ticker (Twelve Data /symbol_search).
 * @param {string}   query         — search query
 * @param {string[]} instrumentTypes — filter to these Twelve Data instrument_type values
 *   e.g. ['Common Stock'] for ações, ['ETF'] for ETFs, ['Common Stock','ETF'] for both
 * Returns [{ symbol, name, exchange, type }] — max 8 results — or [] on any failure.
 */
export const fetchStockSearch = async (query, instrumentTypes = ['Common Stock', 'ETF']) => {
  if (!HAS_STOCK_KEY || !query?.trim()) return [];

  const { signal, clear } = abortAfter(5_000);
  try {
    const res = await fetch(
      `https://api.twelvedata.com/symbol_search?symbol=${encodeURIComponent(query.trim())}&apikey=${TWELVE_DATA_KEY}`,
      { signal }
    );
    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data?.data)) return [];

    return data.data
      .filter(r => !r.instrument_type || instrumentTypes.includes(r.instrument_type))
      .slice(0, 8)
      .map(r => ({
        symbol:   r.symbol,
        name:     r.instrument_name ?? r.symbol,
        exchange: r.exchange ?? '',
        type:     r.instrument_type === 'ETF' ? 'etf' : 'stock',
      }));
  } catch {
    return [];
  } finally {
    clear();
  }
};
