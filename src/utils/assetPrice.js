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

export const CACHE_TTL    = 5 * 60_000;  // 5 minutes — price refresh interval
export const HISTORY_TTL  = 5 * 60_000;  // 5 minutes — history changes slowly
const        FETCH_TIMEOUT = 7_000;   // abort after 7 s

const TWELVE_DATA_KEY = import.meta.env.VITE_TWELVE_DATA_KEY ?? '';
/** True when a Twelve Data API key is configured. */
export const HAS_STOCK_KEY = TWELVE_DATA_KEY.length > 0;

// ─── in-memory caches ────────────────────────────────────────────────────────

/** ticker → { price, changePct, ts } */
const stockCache  = new Map();
/** coinId → { price, changePct24h, ts } */
const cryptoCache = new Map();
/** ticker → { prices: number[], ts } */
const stockHistoryCache  = new Map();
/** coinId → { prices: number[], ts } */
const cryptoHistoryCache = new Map();

// ─── helpers ─────────────────────────────────────────────────────────────────

/**
 * True when lastUpdated (ISO string) is missing or older than ttl ms.
 * Defaults to CACHE_TTL.
 */
export const isStale = (lastUpdated, ttl = CACHE_TTL) =>
  !lastUpdated || (Date.now() - new Date(lastUpdated).getTime()) > ttl;

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
  BTC: 'bitcoin',       ETH: 'ethereum',       BNB: 'binancecoin',
  SOL: 'solana',        ADA: 'cardano',         XRP: 'ripple',
  DOT: 'polkadot',      DOGE: 'dogecoin',       AVAX: 'avalanche-2',
  MATIC: 'matic-network', LINK: 'chainlink',    LTC: 'litecoin',
  ATOM: 'cosmos',       UNI: 'uniswap',         ALGO: 'algorand',
  XLM: 'stellar',       VET: 'vechain',         FIL: 'filecoin',
  SAND: 'the-sandbox',  MANA: 'decentraland',   NEAR: 'near',
  ICP: 'internet-computer', APE: 'apecoin',     OP: 'optimism',
  ARB: 'arbitrum',      INJ: 'injective-protocol',
};

const toCoinId = (symbol) =>
  COIN_IDS[symbol?.toUpperCase()] ?? symbol?.toLowerCase() ?? '';

// ─── stocks (Twelve Data) ────────────────────────────────────────────────────

/**
 * Fetch a single stock quote.
 * Returns { price, changePct } or null.
 */
export const fetchStockQuote = async (ticker) => {
  if (!HAS_STOCK_KEY || !ticker) return null;

  const hit = stockCache.get(ticker);
  if (hit && Date.now() - hit.ts < CACHE_TTL) return hit;

  const { signal, clear } = abortAfter(FETCH_TIMEOUT);
  try {
    const res = await fetch(
      `https://api.twelvedata.com/quote?symbol=${encodeURIComponent(ticker)}&apikey=${TWELVE_DATA_KEY}`,
      { signal }
    );
    if (!res.ok) return null;

    const data = await res.json();
    // Twelve Data returns { code: 400, ... } for errors
    if (data.code || data.status === 'error') return null;

    const price     = parseFloat(data.close)           || null;
    const changePct = parseFloat(data.percent_change)  ?? null;
    if (price === null) return null;

    const entry = { price, changePct, ts: Date.now() };
    stockCache.set(ticker, entry);
    return entry;
  } catch {
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
    if (hit && Date.now() - hit.ts < CACHE_TTL) {
      result[sym] = hit;
    } else {
      toFetch.push({ sym, id });
    }
  }

  if (!toFetch.length) return result;

  const ids = [...new Set(toFetch.map(x => x.id))].join(',');
  const { signal, clear } = abortAfter(FETCH_TIMEOUT);

  try {
    const res = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(ids)}&vs_currencies=eur&include_24hr_change=true`,
      { signal }
    );
    if (!res.ok) return result;

    const data = await res.json();

    for (const { sym, id } of toFetch) {
      const coin = data[id];
      if (!coin) continue;
      const entry = {
        price:        coin.eur            ?? null,
        changePct24h: coin.eur_24h_change ?? null,
        ts:           Date.now(),
      };
      cryptoCache.set(id, entry);
      result[sym] = entry;
    }
  } catch {
    // return whatever was cached
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

  const hit = stockHistoryCache.get(ticker);
  if (hit && Date.now() - hit.ts < HISTORY_TTL) return hit.prices;

  const { signal, clear } = abortAfter(FETCH_TIMEOUT);
  try {
    const res = await fetch(
      `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(ticker)}&interval=1day&outputsize=8&apikey=${TWELVE_DATA_KEY}`,
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
    stockHistoryCache.set(ticker, entry);
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

// ─── simple price getter (Twelve Data /price) ────────────────────────────────
// Accepts any symbol Twelve Data understands: "AAPL", "BTC/USD", "ETH/EUR", …
// Returns a numeric price, or null on any failure.

/**
 * Fetch the current price for a single symbol from Twelve Data /price.
 * symbol can be a stock ticker ("AAPL") or a crypto pair ("BTC/USD").
 * Returns a number or null.
 */
export const getPrice = async (symbol) => {
  if (!HAS_STOCK_KEY || !symbol) return null;
  const { signal, clear } = abortAfter(FETCH_TIMEOUT);
  try {
    const res = await fetch(
      `https://api.twelvedata.com/price?symbol=${encodeURIComponent(symbol)}&apikey=${TWELVE_DATA_KEY}`,
      { signal }
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (data.code || data.status === 'error') return null;
    const price = parseFloat(data.price);
    return isNaN(price) ? null : price;
  } catch (err) {
    console.error('[assetPrice] getPrice error:', symbol, err);
    return null;
  } finally {
    clear();
  }
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
    const res = await fetch(
      `https://api.twelvedata.com/quote?symbol=${encodeURIComponent(symbolList)}&apikey=${TWELVE_DATA_KEY}`,
      { signal }
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    for (const { sym, tdSym } of toFetch) {
      // Single-symbol responses come unwrapped; multi-symbol come as { "BTC/USD": {...}, … }
      const q = toFetch.length === 1 ? data : (data[tdSym] ?? data[sym]);
      if (!q || q.code || q.status === 'error') continue;

      const price     = parseFloat(q.close) || null;
      const changePct = parseFloat(q.percent_change) ?? null;
      if (!price) continue;

      const entry = { price, changePct24h: changePct, ts: Date.now() };
      cryptoCache.set(tdSym, entry);
      result[sym] = entry;
    }
  } catch (err) {
    console.error('[assetPrice] fetchCryptoTwelveData error:', err);
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
 * Search for stocks by name or ticker (Twelve Data /symbol_search).
 * Returns [{ symbol, name, exchange }] — max 8 results — or [] on any failure.
 */
export const fetchStockSearch = async (query) => {
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
      .filter(r => !r.instrument_type || r.instrument_type === 'Common Stock' || r.instrument_type === 'ETF')
      .slice(0, 8)
      .map(r => ({ symbol: r.symbol, name: r.instrument_name ?? r.symbol, exchange: r.exchange ?? '' }));
  } catch {
    return [];
  } finally {
    clear();
  }
};
