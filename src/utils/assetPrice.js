/**
 * assetPrice.js
 * Live price fetcher for stocks (Twelve Data) and crypto (CoinGecko).
 *
 * Stocks  – VITE_TWELVE_DATA_KEY required  (free: 8 credits/min, 800/day)
 * Crypto  – no API key needed              (CoinGecko free, batched per call)
 *
 * Each asset type has its own in-memory cache (TTL = 60 s).
 * Every exported fetch function returns null/empty on any failure so the
 * caller can fall back to the last stored value without breaking the UI.
 */

// ─── constants ───────────────────────────────────────────────────────────────

export const CACHE_TTL    = 60_000;   // 1 minute — matches the 60 s refresh interval
const        FETCH_TIMEOUT = 7_000;   // abort after 7 s

const TWELVE_DATA_KEY = import.meta.env.VITE_TWELVE_DATA_KEY ?? '';
/** True when a Twelve Data API key is configured. */
export const HAS_STOCK_KEY = TWELVE_DATA_KEY.length > 0;

// ─── in-memory caches ────────────────────────────────────────────────────────

/** ticker → { price, changePct, ts } */
const stockCache  = new Map();
/** coinId → { price, changePct24h, ts } */
const cryptoCache = new Map();

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
