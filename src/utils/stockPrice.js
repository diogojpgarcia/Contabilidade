/**
 * stockPrice.js
 * Safe stock price fetcher with 5-minute in-memory cache.
 *
 * Provider : Finnhub.io (free tier — 60 calls/min)
 * API key  : set VITE_FINNHUB_KEY in .env
 * Fallback : returns null on any failure; caller uses stored lastPrice / avgPrice
 */

const CACHE_TTL   = 5 * 60 * 1000; // 5 minutes in ms
const FETCH_TIMEOUT = 6_000;        // abort after 6 s

/** Module-level memory cache: ticker → { price: number, ts: number } */
const memCache = new Map();

const FINNHUB_KEY = import.meta.env.VITE_FINNHUB_KEY ?? '';

/** Whether an API key is configured. Feature is silently disabled without it. */
export const HAS_API_KEY = FINNHUB_KEY.length > 0;

// ─── helpers ────────────────────────────────────────────────────────────────

/** True when lastUpdated is missing or older than 5 minutes. */
export const isStale = (lastUpdated) =>
  !lastUpdated || (Date.now() - new Date(lastUpdated).getTime()) > CACHE_TTL;

/** Human-readable age string, e.g. "3m", "1h", "2d". Returns null if no date. */
export const formatAge = (lastUpdated) => {
  if (!lastUpdated) return null;
  const ms  = Date.now() - new Date(lastUpdated).getTime();
  const min = Math.floor(ms / 60_000);
  if (min <  1) return 'agora mesmo';
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  if (h  < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
};

// ─── fetch ──────────────────────────────────────────────────────────────────

/**
 * Fetch the latest price for a single ticker.
 *
 * - Returns a number on success.
 * - Returns null on every failure (network, timeout, bad response, missing key).
 * - Results are stored in the in-memory cache for CACHE_TTL ms.
 */
export const fetchPrice = async (ticker) => {
  if (!HAS_API_KEY) return null;

  // Return from in-memory cache if still fresh
  const hit = memCache.get(ticker);
  if (hit && Date.now() - hit.ts < CACHE_TTL) return hit.price;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

  try {
    const res = await fetch(
      `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(ticker)}&token=${FINNHUB_KEY}`,
      { signal: controller.signal }
    );

    if (!res.ok) return null;

    const data = await res.json();
    // c = current price (0 when market closed), pc = previous close
    const price = (data?.c > 0) ? data.c : (data?.pc > 0) ? data.pc : null;
    if (price === null) return null;

    memCache.set(ticker, { price, ts: Date.now() });
    return price;
  } catch {
    // Network error, abort, parse failure — all treated as null
    return null;
  } finally {
    clearTimeout(timer);
  }
};
