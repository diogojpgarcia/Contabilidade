/**
 * usePatrimonyPrices.js
 * Custom hook that manages all live price fetching for the Patrimony tab:
 *   - Stock / ETF quotes (batch, polled every CRYPTO_CACHE_TTL)
 *   - Crypto quotes (CoinGecko, free)
 *   - 7-day sparkline history
 *   - Euribor 3M for Certificados de Aforro Série E
 *
 * Returns: { livePrices, assetHistory, refreshingTickers, euribor3M }
 * Side effect: calls onPatrimonyChange when prices update (so callers see live values).
 */

import { useState, useEffect, useRef } from 'react';
import {
  fetchStockQuoteBatch, fetchCryptoTwelveData, fetchStockHistory,
  fetchCryptoHistoryBatch,
  HAS_STOCK_KEY, CRYPTO_CACHE_TTL, HISTORY_TTL, isStale, isStaleCrypto,
} from '../utils/assetPrice';
import { fetchEuribor3M } from '../utils/certificadoAforro';
import { normCoin } from '../utils/budgetUtils';

const EURIBOR_TTL_MS = 24 * 60 * 60_000; // 24h

export function usePatrimonyPrices(externalPatrimony, onPatrimonyChange) {
  const [livePrices,        setLivePrices]        = useState({});
  const [assetHistory,      setAssetHistory]      = useState({});
  const [refreshingTickers, setRefreshingTickers] = useState(new Set());
  const [euribor3M,         setEuribor3M]         = useState(null);

  const patrimonyRef         = useRef(externalPatrimony);
  const onPatrimonyChangeRef = useRef(onPatrimonyChange);
  const triggerRefreshRef    = useRef(null);

  useEffect(() => { patrimonyRef.current = externalPatrimony; },  [externalPatrimony]);
  useEffect(() => { onPatrimonyChangeRef.current = onPatrimonyChange; }, [onPatrimonyChange]);

  // ── Live stock/ETF/crypto prices ───────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    const runRefresh = async () => {
      const current = patrimonyRef.current;
      if (!current) return;

      const stocks  = current.stocks  ?? [];
      const etfs    = current.etfs    ?? [];
      const cryptos = current.crypto  ?? [];
      const now     = new Date().toISOString();

      const staleStocks = HAS_STOCK_KEY ? stocks.filter(s => s.ticker && isStale(s.lastUpdated)) : [];
      const staleEtfs   = HAS_STOCK_KEY ? etfs.filter(e => e.ticker && isStale(e.lastUpdated))   : [];
      const staleCoins  = cryptos.filter(c => c.coin && isStaleCrypto(c.lastUpdated));
      const allStaleEquities = [...staleStocks, ...staleEtfs];

      if (allStaleEquities.length === 0 && staleCoins.length === 0) return;

      setRefreshingTickers(new Set([
        ...allStaleEquities.map(s => s.ticker),
        ...staleCoins.map(c => normCoin(c.coin)),
      ]));

      const [stockPrices, cryptoPrices] = await Promise.all([
        fetchStockQuoteBatch(allStaleEquities.map(s => s.ticker)),
        fetchCryptoTwelveData(staleCoins.map(c => normCoin(c.coin))),
      ]);

      if (cancelled) return;

      const priceUpdates = {};
      allStaleEquities.forEach(s => {
        const data = stockPrices[s.ticker];
        if (data?.price != null) priceUpdates[s.ticker] = { price: data.price, changePct: data.changePct ?? null, lastUpdated: now };
      });
      staleCoins.forEach(c => {
        const coinKey = normCoin(c.coin);
        const data    = cryptoPrices[coinKey];
        if (data?.price != null) priceUpdates[coinKey] = { price: data.price, changePct24h: data.changePct24h ?? null, lastUpdated: now };
      });

      if (Object.keys(priceUpdates).length === 0) { setRefreshingTickers(new Set()); return; }

      setLivePrices(prev => ({ ...prev, ...priceUpdates }));

      const updatedStocks  = stocks.map(s  => { const p = priceUpdates[s.ticker];            return p ? { ...s, lastPrice: p.price, changePct: p.changePct, lastUpdated: now } : s; });
      const updatedEtfs    = etfs.map(e    => { const p = priceUpdates[e.ticker];            return p ? { ...e, lastPrice: p.price, changePct: p.changePct, lastUpdated: now } : e; });
      const updatedCrypto  = cryptos.map(c => { const p = priceUpdates[normCoin(c.coin)];   return p ? { ...c, lastPrice: p.price, change24h: p.changePct24h, lastUpdated: now } : c; });
      onPatrimonyChangeRef.current?.({ ...current, stocks: updatedStocks, etfs: updatedEtfs, crypto: updatedCrypto });

      setRefreshingTickers(new Set());
    };

    triggerRefreshRef.current = runRefresh;
    runRefresh();
    const interval = setInterval(runRefresh, CRYPTO_CACHE_TTL);
    return () => { cancelled = true; triggerRefreshRef.current = null; clearInterval(interval); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-trigger when patrimony loads from Supabase (race condition guard)
  useEffect(() => {
    triggerRefreshRef.current?.();
  }, [externalPatrimony]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Sparkline history ──────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    const fetchHistories = async () => {
      const current = patrimonyRef.current;
      if (!current) return;
      const stocks   = (current.stocks  ?? []).filter(s => s.ticker);
      const etfs     = (current.etfs    ?? []).filter(e => e.ticker);
      const cryptos  = (current.crypto  ?? []).filter(c => c.coin);
      const equities = [...stocks, ...etfs];
      if (equities.length === 0 && cryptos.length === 0) return;

      const [stockResults, cryptoHistories] = await Promise.all([
        Promise.allSettled(equities.map(s => fetchStockHistory(s.ticker).then(prices => ({ ticker: s.ticker, prices })))),
        fetchCryptoHistoryBatch(cryptos.map(c => normCoin(c.coin))),
      ]);
      if (cancelled) return;

      const next = {};
      for (const r of stockResults) {
        if (r.status === 'fulfilled' && r.value?.prices) next[r.value.ticker] = r.value.prices;
      }
      Object.assign(next, cryptoHistories);
      if (Object.keys(next).length > 0) setAssetHistory(prev => ({ ...prev, ...next }));
    };

    fetchHistories();
    const id = setInterval(fetchHistories, HISTORY_TTL);
    return () => { cancelled = true; clearInterval(id); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Euribor 3M ────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      const rate = await fetchEuribor3M();
      if (!cancelled && rate !== null) setEuribor3M(rate);
    };
    refresh();
    const id = setInterval(refresh, EURIBOR_TTL_MS);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  return { livePrices, assetHistory, refreshingTickers, euribor3M };
}
