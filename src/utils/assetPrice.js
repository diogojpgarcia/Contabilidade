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
// ─── UCITS ETF → Twelve Data symbol map ─────────────────────────────────────
// Twelve Data uses the format SYMBOL:EXCHANGE (e.g. VOW3:XETRA — their docs).
// NOT the Stooq dot format (.de, .as, .uk, etc.) which Twelve Data
// does NOT recognise. Bare UCITS tickers are resolved to their canonical
// Twelve Data symbol here.
const UCITS_EUR_TICKER = {
  // Vanguard
  VWCE:  'VWCE:XETRA',   // FTSE All-World Acc — XETRA EUR
  VUSA:  'VUSA:XETRA',   // S&P 500 UCITS — XETRA EUR
  VWRL:  'VWRL:XAMS',    // FTSE All-World Dist — Euronext Amsterdam EUR
  VAGP:  'VAGP:XLON',    // Global Aggregate Bond — London USD
  VEUR:  'VEUR:XAMS',    // FTSE Developed Europe — Euronext Amsterdam EUR
  VERX:  'VERX:XAMS',    // FTSE Developed Europe ex UK — Euronext Amsterdam EUR
  VFEM:  'VFEM:XAMS',    // FTSE Emerging Markets — Euronext Amsterdam EUR
  // iShares (BlackRock)
  IWDA:  'IWDA:XAMS',    // MSCI World Acc — Euronext Amsterdam EUR
  EUNL:  'EUNL:XETRA',   // MSCI World (same as IWDA, XETRA) — XETRA EUR
  CSPX:  'CSPX:XLON',    // Core S&P 500 Acc — London USD
  SXR8:  'SXR8:XETRA',   // Core S&P 500 Acc EUR-hedged — XETRA EUR
  EXSA:  'EXSA:XETRA',   // Core EURO STOXX 50 — XETRA EUR
  IEMA:  'IEMA:XAMS',    // Core MSCI EM IMI — Euronext Amsterdam EUR
  AGGH:  'AGGH:XLON',    // Core Global Aggregate Bond — London USD
  IAGG:  'IAGG:XETRA',   // Core Global Aggregate Bond EUR-hedged — XETRA EUR
  IDTL:  'IDTL:XLON',    // $ Treasury Bond 20+yr — London USD
  IS3N:  'IS3N:XETRA',   // Core MSCI EM IMI — XETRA EUR
  SPPW:  'SPPW:XETRA',   // Core MSCI World — XETRA EUR
  // Xtrackers (DWS)
  XDWD:  'XDWD:XETRA',   // MSCI World Swap Acc — XETRA EUR
  XDEM:  'XDEM:XETRA',   // MSCI World Momentum — XETRA EUR
  DBXW:  'DBXW:XETRA',   // MSCI World Swap — XETRA EUR
  // Amundi / Lyxor
  MEUD:  'MEUD:XPAR',    // MSCI Europe — Euronext Paris EUR
  LCWD:  'LCWD:XPAR',    // MSCI World — Euronext Paris EUR
  PANX:  'PANX:XPAR',    // Nasdaq-100 UCITS — Euronext Paris EUR
  // SPDR
  SPXS:  'SPXS:XETRA',   // S&P 500 UCITS — XETRA EUR
  // ── Ações portuguesas (Euronext Lisboa, EUR) ─────────────────────────────
  EDP:   'EDP:XLIS',     // EDP — Energias de Portugal
  GALP:  'GALP:XLIS',    // Galp Energia
  BCP:   'BCP:XLIS',     // Millennium BCP
  JMT:   'JMT:XLIS',     // Jerónimo Martins
  SON:   'SON:XLIS',     // Sonae SGPS
  NOS:   'NOS:XLIS',     // NOS SGPS
  EGL:   'EGL:XLIS',     // Greenvolt
};

// ─── MIC code → Twelve Data :EXCHANGE suffix ─────────────────────────────────
// Twelve Data /symbol_search returns bare tickers + mic_code.
// This maps MIC codes to the ":EXCHANGE" suffix used by Twelve Data /quote.
// (Twelve Data uses SYMBOL:EXCHANGE format, not Stooq SYMBOL.xx format)
const MIC_TO_TD_EXCHANGE = {
  XETR: ':XETRA',   // XETRA (Germany)
  XFRA: ':XETRA',   // Frankfurt (routed via XETRA for ETFs)
  XAMS: ':XAMS',    // Euronext Amsterdam
  XPAR: ':XPAR',    // Euronext Paris
  XBRU: ':XBRU',    // Euronext Brussels
  XLON: ':XLON',    // London Stock Exchange
  XLIS: ':XLIS',    // Euronext Lisbon
  XMIL: ':XMIL',    // Milan (Borsa Italiana)
  XMAD: ':XMAD',    // Madrid
  XHEL: ':XHEL',    // Helsinki
  XCSE: ':XCSE',    // Copenhagen
  XSTO: ':XSTO',    // Stockholm
  XOSL: ':XOSL',    // Oslo
};

// Stooq dot-suffix → Twelve Data :EXCHANGE suffix
// Handles tickers previously stored with .DE / .AS / .L etc.
const DOT_TO_TD = {
  '.DE': ':XETRA',
  '.AS': ':XAMS',
  '.PA': ':XPAR',
  '.L':  ':XLON',
  '.LS': ':XLIS',
  '.MI': ':XMIL',
  '.MC': ':XMAD',
  '.HE': ':XHEL',
  '.CO': ':XCSE',
  '.ST': ':XSTO',
  '.OL': ':XOSL',
  '.BR': ':XBRU',
};

// ─── Twelve Data :EXCHANGE → Stooq suffix ────────────────────────────────────────
// Stooq uses SYMBOL.de / SYMBOL.as etc. for European listings.
// Twelve Data free tier does NOT support European exchange ETFs (XETRA/Euronext/LSE),
// so we fall back to Stooq (via /api/quote proxy) for any ticker with a European :EXCHANGE suffix.
const TD_TO_STOOQ = {
  ':XETRA': '.de',
  ':XAMS':  '.as',
  ':XPAR':  '.pa',
  ':XLON':  '.uk',
  ':XLIS':  '.ls',
  ':XMIL':  '.it',
  ':XMAD':  '.es',
  ':XHEL':  '.fi',
  ':XCSE':  '.dk',
  ':XSTO':  '.se',
  ':XOSL':  '.no',
  ':XBRU':  '.be',
};

/** Convert SYMBOL:EXCHANGE (Twelve Data) → SYMBOL.xx (Stooq format). Returns null for US tickers. */
const toStooqTicker = (tdTicker) => {
  if (!tdTicker?.includes(':')) return null;
  const colonIdx = tdTicker.indexOf(':');
  const sym    = tdTicker.slice(0, colonIdx);
  const exc    = tdTicker.slice(colonIdx);   // e.g. ':XETRA'
  const suffix = TD_TO_STOOQ[exc];
  return suffix ? sym + suffix : null;
};

/**
 * Batch-fetch quotes via /api/quote proxy (Yahoo Finance) for European ETFs / stocks.
 * Falls back silently on CORS failures, rate limits, or any network error.
 *
 * @param {Map<string,string>} resolvedToOrig  resolvedTicker → originalTicker
 * @returns {{ [originalTicker]: { price, changePct, currency } }}
 */
const fetchStooqQuoteBatch = async (resolvedToOrig) => {
  // Build map: resolvedTicker → originalTicker (only European tickers that Stooq/Yahoo supports)
  const euroMap = new Map(); // resolvedTicker (SYMBOL:XETRA) → originalTicker
  for (const [resolved, original] of resolvedToOrig) {
    // Send the resolved ticker as-is; api/quote converts :XETRA → .DE internally
    euroMap.set(resolved, original);
  }
  if (!euroMap.size) return {};

  const symbols = [...euroMap.keys()].join(',');
  const result  = {};
  const { signal, clear } = abortAfter(FETCH_TIMEOUT);
  try {
    // Chama o proxy server-side /api/quote (Yahoo Finance, sem CORS)
    const url = `/api/quote?symbols=${encodeURIComponent(symbols)}`;
    const res = await fetch(url, { signal });
    if (!res.ok) {
      console.warn(`[assetPrice] /api/quote HTTP ${res.status}`);
      return result;
    }
    const data = await res.json();
    // data = { "EUNL:XETRA": { price, changePct, currency }, ... }
    for (const [resolved, orig] of euroMap) {
      const q = data[resolved];
      if (!q?.price) continue;
      const entry = { price: q.price, changePct: q.changePct ?? null, currency: q.currency ?? 'EUR', ts: Date.now() };
      stockCache.set(orig, entry);
      stockCache.set(resolved, entry);
      result[orig] = entry;
    }
    if (Object.keys(result).length) {
      console.log('[assetPrice] /api/quote proxy OK:', Object.keys(result));
    } else {
      console.warn('[assetPrice] /api/quote proxy retornou vazio para:', symbols);
    }
  } catch (err) {
    console.warn('[assetPrice] Yahoo fallback failed:', err?.message ?? err);
  } finally {
    clear();
  }
  return result;
};

/**
 * Given a bare ticker + mic_code from Twelve Data /symbol_search,
 * returns the properly qualified Twelve Data symbol (e.g. "VWCE" + "XETR" → "VWCE:XETRA").
 * Falls back to resolveEquityTicker (UCITS map) if mic_code not known.
 */
export const qualifyTicker = (symbol, micCode) => {
  if (!symbol) return symbol;
  if (symbol.includes(':')) return symbol; // already in Twelve Data :EXCHANGE format
  if (symbol.includes('.')) return resolveEquityTicker(symbol); // convert .DE → :XETRA
  const tdExchange = micCode ? MIC_TO_TD_EXCHANGE[micCode?.toUpperCase()] : null;
  if (tdExchange) return symbol + tdExchange;
  return resolveEquityTicker(symbol); // fall back to UCITS map
};

/**
 * Resolve a potentially bare or Stooq-format ticker to Twelve Data's SYMBOL:EXCHANGE format.
 * - SYMBOL:EXCHANGE → returned as-is (already Twelve Data format)
 * - SYMBOL.de (Stooq format) → converted to SYMBOL:XETRA
 * - SYMBOL (bare) → looked up in UCITS_EUR_TICKER, falls back to bare ticker
 */
export const resolveEquityTicker = (ticker) => {
  if (!ticker) return ticker;
  if (ticker.includes(':')) return ticker;   // already SYMBOL:EXCHANGE — Twelve Data format
  // Convert Stooq dot-suffix to Twelve Data colon format
  for (const [dotSuffix, tdSuffix] of Object.entries(DOT_TO_TD)) {
    if (ticker.endsWith(dotSuffix)) {
      return ticker.slice(0, -dotSuffix.length) + tdSuffix;
    }
  }
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
    if (price === null) {
      // Try Stooq as fallback for European ETFs not covered by Twelve Data free tier
      const yt = toStooqTicker(resolved);
      if (yt) {
        const yRes = await fetchStooqQuoteBatch(new Map([[resolved, ticker]]));
        return yRes[ticker] ?? null;
      }
      return null;
    }

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
  if (!tickers?.length) return {};

  const result  = {};
  const toFetch = [];

  for (const ticker of tickers) {
    if (!ticker) continue;
    const resolved = resolveEquityTicker(ticker);
    const hit = stockCache.get(resolved) ?? stockCache.get(ticker);
    if (hit && Date.now() - hit.ts < CACHE_TTL) {
      result[ticker] = hit;
    } else {
      toFetch.push(ticker);
    }
  }

  if (!toFetch.length) return result;

  // Todos os tickers → /api/quote (Yahoo Finance, com conversão USD→EUR automática)
  // Evita Twelve Data que: (a) 429/404 para tickers europeus, (b) devolve USD sem converter
  const proxyMap = new Map(toFetch.map(t => [resolveEquityTicker(t), t]));
  const proxyResult = await fetchStooqQuoteBatch(proxyMap);
  Object.assign(result, proxyResult);
  for (const [t, entry] of Object.entries(proxyResult)) {
    const resolved = resolveEquityTicker(t);
    stockCache.set(resolved, entry);
    if (resolved !== t) stockCache.set(t, entry);
  }

  return result;
};

// ─── history (sparkline data) ────────────────────────────────────────────────

/**
 * Fetch 7-day daily close prices for a stock via /api/stock-history proxy (Yahoo Finance).
 * Returns number[] oldest→newest, or null on failure.
 */
export const fetchStockHistory = async (ticker) => {
  if (!ticker) return null;

  const resolved = resolveEquityTicker(ticker);
  const hit = stockHistoryCache.get(resolved) ?? stockHistoryCache.get(ticker);
  if (hit && Date.now() - hit.ts < HISTORY_TTL) return hit.prices;

  const { signal, clear } = abortAfter(FETCH_TIMEOUT);
  try {
    const res = await fetch(
      `/api/stock-history?symbol=${encodeURIComponent(resolved)}&period=1S`,
      { signal }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const prices = data?.prices ?? [];
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
          `/api/crypto-history?coin=${encodeURIComponent(id)}&days=7`,
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
        `/api/crypto-history?coin=${encodeURIComponent(id)}&days=${days}`,
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
      const resolvedSym = resolveEquityTicker(sym);
      const { signal, clear } = abortAfter(FETCH_TIMEOUT);
      const res = await fetch(
        `/api/stock-history?symbol=${encodeURIComponent(resolvedSym)}&period=${encodeURIComponent(period)}`,
        { signal }
      );
      clear();
      if (!res.ok) return null;
      const data = await res.json();
      const prices = data?.prices ?? [];
      const labels = data?.labels ?? [];
      if (prices.length < 2) return null;
      periodHistoryCache.set(cacheKey, { prices, labels, ts: Date.now() });
      return { prices, labels };
    }
  } catch {
    return null;
  }
};
export const fetchStockSearch = async (query, types) => {
  if (!HAS_STOCK_KEY || !query?.trim()) return [];
  const { signal, clear } = abortAfter(FETCH_TIMEOUT);
  try {
    const res = await fetch(
      `https://api.twelvedata.com/symbol_search?symbol=${encodeURIComponent(query)}&apikey=${TWELVE_DATA_KEY}`,
      { signal }
    );
    clear();
    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data?.data)) return [];
    const results = data.data.map(d => ({
      symbol:     d.symbol,
      fullSymbol: qualifyTicker(d.symbol, d.mic_code),
      name:       d.instrument_name,
      exchange:   d.exchange,
      mic_code:   d.mic_code,
      type:       d.instrument_type,
    }));
    if (types?.length) return results.filter(r => types.includes(r.type));
    return results;
  } catch {
    clear();
    return [];
  }
};
