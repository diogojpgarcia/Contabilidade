import React, { useState, useEffect, useRef } from 'react';
import { useForm } from '../../hooks/useForm';
import Overlay from '../Overlay';
import SwipeRevealCard from '../SwipeRevealCard';
import { searchAssets } from '../../utils/searchAssets';
import {
  fetchStockQuote, fetchCryptoTwelveData, fetchStockHistory,
  fetchCryptoHistoryBatch, fetchStockSearch, formatAge,
  HAS_STOCK_KEY, CACHE_TTL, HISTORY_TTL, isStale,
} from '../../utils/assetPrice';
import { shiftMonth } from '../../utils/insights';
import { filterByFinancialMonth } from '../../utils/financialMonth';
import {
  PATRIMONY_TYPES, EMPTY_PATRIMONY, toNum, normCoin,
  sortPatrimonyTypes, sortItemsByType,
  computeAccountBalance,
} from '../../utils/budgetUtils';
import Sparkline from './Sparkline';

const PatrimonyView = ({
  transactions,
  patrimony: externalPatrimony,
  onPatrimonyChange,
  onAccountRename,
  mainAccountId,
  onMainAccountChange,
  currentMonth,
  financialMonthStartDay,
}) => {
  const { draft: patrimonyForm, setField: setPatrimonyField, reset: resetPatrimonyForm } = useForm({});

  const [confirmDeleteAsset, setConfirmDeleteAsset] = useState(null); // { typeKey, id, name }
  const [showPatrimonyModal,  setShowPatrimonyModal]  = useState(false);
  const [patrimonyFormType,   setPatrimonyFormType]   = useState(null);
  const [editingAssetId,      setEditingAssetId]      = useState(null);
  const [refreshingTickers,   setRefreshingTickers]   = useState(new Set());
  const [assetHistory,        setAssetHistory]        = useState({});
  const [stockSearchQuery,    setStockSearchQuery]    = useState('');
  const [stockConfirmed,      setStockConfirmed]      = useState(false);
  const [etfSearchQuery,      setEtfSearchQuery]      = useState('');
  const [etfConfirmed,        setEtfConfirmed]        = useState(false);
  const [etfApiResults,       setEtfApiResults]       = useState([]);
  const [etfApiLoading,       setEtfApiLoading]       = useState(false);
  const [cryptoSearchQuery,   setCryptoSearchQuery]   = useState('');
  const [cryptoConfirmed,     setCryptoConfirmed]     = useState(false);
  const [stockApiResults,     setStockApiResults]     = useState([]);
  const [stockApiLoading,     setStockApiLoading]     = useState(false);
  const [livePrices,          setLivePrices]          = useState({});

  const patrimonyRef         = useRef(externalPatrimony);
  const onPatrimonyChangeRef = useRef(onPatrimonyChange);
  const stockSearchTimerRef  = useRef(null);
  const etfSearchTimerRef    = useRef(null);

  useEffect(() => { patrimonyRef.current = externalPatrimony; },  [externalPatrimony]);
  useEffect(() => { onPatrimonyChangeRef.current = onPatrimonyChange; }, [onPatrimonyChange]);

  const patrimony = externalPatrimony || EMPTY_PATRIMONY;

  // ── Debounced stock symbol search ──────────────────────────────────────────
  useEffect(() => {
    if (stockSearchTimerRef.current) clearTimeout(stockSearchTimerRef.current);
    const q = stockSearchQuery.trim();
    if (q.length < 2) {
      setStockApiResults([]);
      setStockApiLoading(false);
      return;
    }
    setStockApiLoading(true);
    stockSearchTimerRef.current = setTimeout(async () => {
      const results = await fetchStockSearch(q, ['Common Stock']);
      setStockApiResults(results);
      setStockApiLoading(false);
    }, 350);
    return () => { if (stockSearchTimerRef.current) clearTimeout(stockSearchTimerRef.current); };
  }, [stockSearchQuery]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Debounced ETF symbol search ────────────────────────────────────────────
  useEffect(() => {
    if (etfSearchTimerRef.current) clearTimeout(etfSearchTimerRef.current);
    const q = etfSearchQuery.trim();
    if (q.length < 2) {
      setEtfApiResults([]);
      setEtfApiLoading(false);
      return;
    }
    setEtfApiLoading(true);
    etfSearchTimerRef.current = setTimeout(async () => {
      const results = await fetchStockSearch(q, ['ETF']);
      setEtfApiResults(results);
      setEtfApiLoading(false);
    }, 350);
    return () => { if (etfSearchTimerRef.current) clearTimeout(etfSearchTimerRef.current); };
  }, [etfSearchQuery]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Live asset prices ──────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    const runRefresh = async () => {
      const current = patrimonyRef.current;
      if (!current) return;

      const stocks  = current.stocks  ?? [];
      const etfs    = current.etfs    ?? [];
      const cryptos = current.crypto  ?? [];
      const now     = new Date().toISOString();

      const staleStocks = HAS_STOCK_KEY
        ? stocks.filter(s => s.ticker && isStale(s.lastUpdated))
        : [];
      const staleEtfs = HAS_STOCK_KEY
        ? etfs.filter(e => e.ticker && isStale(e.lastUpdated))
        : [];
      const staleCoins = cryptos.filter(c => c.coin && isStale(c.lastUpdated));
      const allStaleEquities = [...staleStocks, ...staleEtfs];

      if (allStaleEquities.length === 0 && staleCoins.length === 0) return;

      setRefreshingTickers(new Set([
        ...allStaleEquities.map(s => s.ticker),
        ...staleCoins.map(c => normCoin(c.coin)),
      ]));

      const [stockResults, cryptoPrices] = await Promise.all([
        Promise.allSettled(allStaleEquities.map(s => fetchStockQuote(s.ticker))),
        fetchCryptoTwelveData(staleCoins.map(c => normCoin(c.coin))),
      ]);

      if (cancelled) return;

      const priceUpdates = {};

      allStaleEquities.forEach((s, idx) => {
        const r = stockResults[idx];
        if (r?.status === 'fulfilled' && r.value !== null) {
          priceUpdates[s.ticker] = {
            price:      r.value.price,
            changePct:  r.value.changePct ?? null,
            lastUpdated: now,
          };
        }
      });

      staleCoins.forEach(c => {
        const coinKey = normCoin(c.coin);
        const data    = cryptoPrices[coinKey];
        if (data?.price != null) {
          priceUpdates[coinKey] = {
            price:        data.price,
            changePct24h: data.changePct24h ?? null,
            lastUpdated:  now,
          };
        }
      });


      if (Object.keys(priceUpdates).length === 0) {
        setRefreshingTickers(new Set());
        return;
      }

      setLivePrices(prev => ({ ...prev, ...priceUpdates }));

      const updatedStocks = stocks.map(s => {
        const p = priceUpdates[s.ticker];
        return p ? { ...s, lastPrice: p.price, changePct: p.changePct, lastUpdated: now } : s;
      });
      const updatedEtfs = etfs.map(e => {
        const p = priceUpdates[e.ticker];
        return p ? { ...e, lastPrice: p.price, changePct: p.changePct, lastUpdated: now } : e;
      });
      const updatedCrypto = cryptos.map(c => {
        const p = priceUpdates[normCoin(c.coin)];
        return p ? { ...c, lastPrice: p.price, change24h: p.changePct24h, lastUpdated: now } : c;
      });
      onPatrimonyChangeRef.current?.({ ...current, stocks: updatedStocks, etfs: updatedEtfs, crypto: updatedCrypto });

      setRefreshingTickers(new Set());
    };

    runRefresh();
    const interval = setInterval(runRefresh, CACHE_TTL);
    return () => { cancelled = true; clearInterval(interval); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── 7-day price history for sparklines ────────────────────────────────────
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
        Promise.allSettled(
          equities.map(s => fetchStockHistory(s.ticker).then(prices => ({ ticker: s.ticker, prices })))
        ),
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

  // Wrapper local — usa a função partilhada de budgetUtils com as transações da prop.
  const computeAccountBalanceLocal = (acc) => computeAccountBalance(acc, transactions);

  const getPatrimonyTypeValue = (key) => {
    const items = patrimony[key] || [];
    if (key === 'accounts')   return items.reduce((s, x) => s + computeAccountBalanceLocal(x), 0);
    if (key === 'stocks')     return items.reduce((s, x) => {
      const price = toNum(livePrices[x.ticker]?.price ?? x.lastPrice ?? x.avgPrice);
      return s + toNum(x.qty) * price;
    }, 0);
    if (key === 'etfs')       return items.reduce((s, x) => {
      const price = toNum(livePrices[x.ticker]?.price ?? x.lastPrice ?? x.avgPrice);
      return s + toNum(x.qty) * price;
    }, 0);
    if (key === 'bonds')      return items.reduce((s, x) => s + toNum(x.value), 0);
    if (key === 'realestate') return items.reduce((s, x) => s + toNum(x.value), 0);
    if (key === 'vehicles')   return items.reduce((s, x) => s + toNum(x.value), 0);
    if (key === 'crypto')     return items.reduce((s, x) => {
      const price = toNum(livePrices[normCoin(x.coin)]?.price ?? x.lastPrice ?? x.price);
      return s + toNum(x.qty) * price;
    }, 0);
    return 0;
  };

  const totalPatrimony = PATRIMONY_TYPES.reduce((s, t) => s + getPatrimonyTypeValue(t.key), 0);

  const handlePatrimonyDelete = (typeKey, id, name) => {
    setConfirmDeleteAsset({ typeKey, id, name: name || 'este activo' });
  };

  const handlePatrimonyDeleteConfirmed = () => {
    if (!confirmDeleteAsset) return;
    const { typeKey, id } = confirmDeleteAsset;
    const updated = { ...patrimony, [typeKey]: (patrimony[typeKey] || []).filter(x => x.id !== id) };
    onPatrimonyChange && onPatrimonyChange(updated);
    setConfirmDeleteAsset(null);
  };

  const clearAssetForms = () => {
    setStockSearchQuery('');
    setStockConfirmed(false);
    setStockApiResults([]);
    setStockApiLoading(false);
    setEtfSearchQuery('');
    setEtfConfirmed(false);
    setEtfApiResults([]);
    setEtfApiLoading(false);
    setCryptoSearchQuery('');
    setCryptoConfirmed(false);
  };

  const handleStockSelect = (result) => {
    setPatrimonyField('ticker', result.symbol);
    setPatrimonyField('name',   result.name);
    setStockSearchQuery('');
    setStockConfirmed(true);
  };

  const handleEtfSelect = (result) => {
    setPatrimonyField('ticker', result.symbol);
    setPatrimonyField('name',   result.name);
    setEtfSearchQuery('');
    setEtfConfirmed(true);
  };

  const handleCryptoSelect = (result) => {
    setPatrimonyField('coin', result.symbol);
    setPatrimonyField('name', result.name);
    setCryptoSearchQuery('');
    setCryptoConfirmed(true);
  };

  const handlePatrimonyEdit = (typeKey, item) => {
    resetPatrimonyForm(item);
    setPatrimonyFormType(typeKey);
    setEditingAssetId(item.id);
    if (typeKey === 'stocks' && item.ticker) setStockConfirmed(true);
    if (typeKey === 'etfs'   && item.ticker) setEtfConfirmed(true);
    if (typeKey === 'crypto' && item.coin)   setCryptoConfirmed(true);
    setShowPatrimonyModal(true);
  };

  const handlePatrimonySubmit = () => {
    if (!patrimonyFormType) return;
    const clean = { ...patrimonyForm };
    if (editingAssetId) {
      // Detectar rename de conta e propagar às transações ligadas
      if (patrimonyFormType === 'accounts' && onAccountRename) {
        const oldItem = (patrimony?.accounts || []).find(a => a.id === editingAssetId);
        if (oldItem && oldItem.name && clean.name && oldItem.name !== clean.name) {
          onAccountRename(editingAssetId, clean.name);
        }
      }
      const updated = {
        ...patrimony,
        [patrimonyFormType]: (patrimony[patrimonyFormType] || []).map(x =>
          x.id === editingAssetId ? { ...clean, id: editingAssetId } : x
        ),
      };
      onPatrimonyChange && onPatrimonyChange(updated);
    } else {
      const id   = Date.now().toString();
      const item = { id, insertedAt: new Date().toISOString(), ...clean };
      const updated = { ...patrimony, [patrimonyFormType]: [...(patrimony[patrimonyFormType] || []), item] };
      onPatrimonyChange && onPatrimonyChange(updated);
    }
    resetPatrimonyForm({});
    setPatrimonyFormType(null);
    setEditingAssetId(null);
    setShowPatrimonyModal(false);
    clearAssetForms();
  };

  const fmtStockPrice  = (p) => { const n = parseFloat(p) || 0; return n.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: n < 1 ? 4 : 2 }); };
  const fmtCryptoPrice = (p) => { const n = parseFloat(p) || 0; return n.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: n < 0.001 ? 8 : n < 0.1 ? 6 : n < 1 ? 4 : 2 }); };
  const fmtFiat        = (v) => parseFloat(v || 0).toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const renderPatrimonyItemValue = (typeKey, item) => {
    if (typeKey === 'accounts')   return `${fmtFiat(computeAccountBalanceLocal(item))}€`;
    if (typeKey === 'stocks') {
      const price = parseFloat(item.lastPrice ?? item.avgPrice) || null;
      if (!price) return `${item.qty || 0} ações · cotação pendente`;
      const total = (parseFloat(item.qty) || 0) * price;
      return `${item.qty}×${fmtStockPrice(price)}€ = ${fmtFiat(total)}€`;
    }
    if (typeKey === 'etfs') {
      const price = parseFloat(item.lastPrice ?? item.avgPrice) || null;
      if (!price) return `${item.qty || 0} unidades · cotação pendente`;
      const total = (parseFloat(item.qty) || 0) * price;
      return `${item.qty}×${fmtStockPrice(price)}€ = ${fmtFiat(total)}€`;
    }
    if (typeKey === 'bonds')      return `${fmtFiat(item.value)}€`;
    if (typeKey === 'realestate') return `${fmtFiat(item.value)}€`;
    if (typeKey === 'vehicles')   return `${fmtFiat(item.value)}€`;
    if (typeKey === 'crypto') {
      const price = parseFloat(item.lastPrice ?? item.price) || null;
      if (!price) return `${item.qty || 0} moedas · cotação pendente`;
      const total = (parseFloat(item.qty || 0) * price);
      return `${item.qty}×${fmtCryptoPrice(price)}€ = ${fmtFiat(total)}€`;
    }
    return '';
  };

  const renderPatrimonyItemLabel = (typeKey, item) => {
    if (typeKey === 'accounts')   return `${item.name}${item.bank ? ' · ' + item.bank : ''}`;
    if (typeKey === 'stocks')     return item.ticker;
    if (typeKey === 'etfs')       return item.ticker;
    if (typeKey === 'bonds')      return `${item.series || 'Série'}${item.date ? ' · ' + item.date : ''}`;
    if (typeKey === 'realestate') return item.description;
    if (typeKey === 'vehicles')   return item.description;
    if (typeKey === 'crypto')     return item.coin;
    return '';
  };

  const renderPatrimonyForm = () => {
    const f   = patrimonyForm;
    const set = (k, v) => setPatrimonyField(k, v);
    const cls = 'patrimony-input';

    switch (patrimonyFormType) {

      case 'accounts':
        return (<>
          <input className={cls} placeholder="Nome da conta"    value={f.name    || ''} onChange={e => set('name',    e.target.value)} />
          <input className={cls} placeholder="Banco (opcional)" value={f.bank    || ''} onChange={e => set('bank',    e.target.value)} />
          <input className={cls} type="number" inputMode="decimal" placeholder="Saldo inicial (€)" value={f.balance || ''} onChange={e => set('balance', e.target.value)} />
        </>);

      case 'stocks': {
        const localMatches = stockSearchQuery.trim().length >= 1
          ? searchAssets(stockSearchQuery.trim(), ['stock'])
          : [];
        const apiOnly = stockApiResults.filter(r => !localMatches.some(l => l.symbol === r.symbol));
        const suggestions = [...localMatches, ...apiOnly].slice(0, 8);
        const showDropdown = stockSearchQuery.trim().length >= 1 && (suggestions.length > 0 || stockApiLoading);

        return (
          <div className="pat-asset-form">
            {!stockConfirmed ? (
              <div className="pat-search-wrap">
                <span className="pat-search-icon">⊕</span>
                <input
                  className={cls}
                  style={{ paddingLeft: '2.4rem' }}
                  placeholder="Procurar empresa ou ticker…"
                  value={stockSearchQuery}
                  onChange={e => setStockSearchQuery(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      if (suggestions.length > 0) {
                        handleStockSelect(suggestions[0]);
                      } else if (stockSearchQuery.trim()) {
                        setPatrimonyField('ticker', stockSearchQuery.trim().toUpperCase());
                        setPatrimonyField('name', '');
                        setStockSearchQuery('');
                        setStockConfirmed(true);
                      }
                    }
                    if (e.key === 'Escape') setStockSearchQuery('');
                  }}
                  onBlur={() => setTimeout(() => setStockSearchQuery(''), 200)}
                  autoComplete="off"
                  autoFocus
                />
                {showDropdown && (
                  <div className="pat-search-dropdown">
                    {suggestions.map(r => (
                      <div key={r.symbol} className="pat-search-result"
                        onMouseDown={e => { e.preventDefault(); handleStockSelect(r); }}>
                        <span className="pat-search-sym">{r.symbol}</span>
                        <span className="pat-search-name">{r.name}</span>
                        {r.type === 'etf'
                          ? <span className="pat-search-exch">ETF</span>
                          : r.exchange
                            ? <span className="pat-search-exch">{r.exchange}</span>
                            : null}
                      </div>
                    ))}
                    {stockApiLoading && (
                      <div className="pat-search-loading">A procurar…</div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <>
                <div className="pat-stock-chip">
                  <div className="pat-stock-chip-body">
                    <span className="pat-stock-chip-ticker">{f.ticker}</span>
                    {f.name && <span className="pat-stock-chip-name">{f.name}</span>}
                  </div>
                  <button type="button" className="pat-stock-chip-clear"
                    onClick={() => { set('ticker',''); set('name',''); set('qty',''); set('broker',''); set('purchasePrice',''); setStockConfirmed(false); }}>×</button>
                </div>
                <input className={cls} type="number" inputMode="decimal"
                  placeholder="Quantidade de ações" value={f.qty || ''}
                  onChange={e => set('qty', e.target.value)} autoFocus />
                <input className={cls} type="number" inputMode="decimal"
                  placeholder="Preço de compra por ação (€)" value={f.purchasePrice || ''}
                  onChange={e => set('purchasePrice', e.target.value)} />
                <input className={cls}
                  placeholder="Broker — ex: XTB, Degiro (opcional)" value={f.broker || ''}
                  onChange={e => set('broker', e.target.value)} autoComplete="off" />
              </>
            )}
          </div>
        );
      }

      case 'etfs': {
        const localEtfMatches = etfSearchQuery.trim().length >= 1
          ? searchAssets(etfSearchQuery.trim(), ['etf'])
          : [];
        const etfApiOnly = etfApiResults.filter(r => !localEtfMatches.some(l => l.symbol === r.symbol));
        const etfSuggestions = [...localEtfMatches, ...etfApiOnly].slice(0, 8);
        const showEtfDropdown = etfSearchQuery.trim().length >= 1 && (etfSuggestions.length > 0 || etfApiLoading);

        return (
          <div className="pat-asset-form">
            {!etfConfirmed ? (
              <div className="pat-search-wrap">
                <span className="pat-search-icon">⊕</span>
                <input
                  className={cls}
                  style={{ paddingLeft: '2.4rem' }}
                  placeholder="Procurar ETF ou ticker…"
                  value={etfSearchQuery}
                  onChange={e => setEtfSearchQuery(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      if (etfSuggestions.length > 0) {
                        handleEtfSelect(etfSuggestions[0]);
                      } else if (etfSearchQuery.trim()) {
                        setPatrimonyField('ticker', etfSearchQuery.trim().toUpperCase());
                        setPatrimonyField('name', '');
                        setEtfSearchQuery('');
                        setEtfConfirmed(true);
                      }
                    }
                    if (e.key === 'Escape') setEtfSearchQuery('');
                  }}
                  onBlur={() => setTimeout(() => setEtfSearchQuery(''), 200)}
                  autoComplete="off"
                  autoFocus
                />
                {showEtfDropdown && (
                  <div className="pat-search-dropdown">
                    {etfSuggestions.map(r => (
                      <div key={r.symbol} className="pat-search-result"
                        onMouseDown={e => { e.preventDefault(); handleEtfSelect(r); }}>
                        <span className="pat-search-sym">{r.symbol}</span>
                        <span className="pat-search-name">{r.name}</span>
                        {r.exchange
                          ? <span className="pat-search-exch">{r.exchange}</span>
                          : null}
                      </div>
                    ))}
                    {etfApiLoading && (
                      <div className="pat-search-loading">A procurar…</div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <>
                <div className="pat-stock-chip">
                  <div className="pat-stock-chip-body">
                    <span className="pat-stock-chip-ticker">{patrimonyForm.ticker}</span>
                    {patrimonyForm.name && <span className="pat-stock-chip-name">{patrimonyForm.name}</span>}
                  </div>
                  <button type="button" className="pat-stock-chip-clear"
                    onClick={() => { setPatrimonyField('ticker',''); setPatrimonyField('name',''); setPatrimonyField('qty',''); setPatrimonyField('broker',''); setPatrimonyField('purchasePrice',''); setEtfConfirmed(false); }}>×</button>
                </div>
                <input className={cls} type="number" inputMode="decimal"
                  placeholder="Quantidade de unidades" value={patrimonyForm.qty || ''}
                  onChange={e => setPatrimonyField('qty', e.target.value)} autoFocus />
                <input className={cls} type="number" inputMode="decimal"
                  placeholder="Preço de compra por unidade (€)" value={patrimonyForm.purchasePrice || ''}
                  onChange={e => setPatrimonyField('purchasePrice', e.target.value)} />
                <input className={cls}
                  placeholder="Broker/Plataforma (opcional)" value={patrimonyForm.broker || ''}
                  onChange={e => setPatrimonyField('broker', e.target.value)} autoComplete="off" />
              </>
            )}
          </div>
        );
      }

      case 'bonds':
        return (<>
          <input className={cls} placeholder="Série (ex: E)"       value={f.series || ''} onChange={e => set('series', e.target.value)} />
          <input className={cls} type="number" inputMode="decimal" placeholder="Valor actual (€)" value={f.value  || ''} onChange={e => set('value',  e.target.value)} />
          <input className={cls} type="date" value={f.date || ''} onChange={e => set('date', e.target.value)} />
        </>);

      case 'realestate':
        return (<>
          <input className={cls} placeholder="Descrição (ex: Apartamento Lisboa)" value={f.description || ''} onChange={e => set('description', e.target.value)} />
          <input className={cls} type="number" inputMode="decimal" placeholder="Valor estimado (€)" value={f.value || ''} onChange={e => set('value', e.target.value)} />
        </>);

      case 'vehicles':
        return (<>
          <input className={cls} placeholder="Descrição (ex: BMW X3 2020)" value={f.description || ''} onChange={e => set('description', e.target.value)} />
          <input className={cls} type="number" inputMode="decimal" placeholder="Valor estimado (€)" value={f.value || ''} onChange={e => set('value', e.target.value)} />
        </>);

      case 'crypto': {
        const suggestions = cryptoSearchQuery.trim().length >= 1
          ? searchAssets(cryptoSearchQuery.trim(), ['crypto'])
          : [];

        return (
          <div className="pat-asset-form">
            {!cryptoConfirmed ? (
              <div className="pat-search-wrap">
                <span className="pat-search-icon">⊕</span>
                <input
                  className={cls}
                  style={{ paddingLeft: '2.4rem' }}
                  placeholder="Procurar moeda ou símbolo…"
                  value={cryptoSearchQuery}
                  onChange={e => setCryptoSearchQuery(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      if (suggestions.length > 0) {
                        handleCryptoSelect(suggestions[0]);
                      } else if (cryptoSearchQuery.trim()) {
                        setPatrimonyField('coin', cryptoSearchQuery.trim().toUpperCase());
                        setPatrimonyField('name', '');
                        setCryptoSearchQuery('');
                        setCryptoConfirmed(true);
                      }
                    }
                    if (e.key === 'Escape') setCryptoSearchQuery('');
                  }}
                  onBlur={() => setTimeout(() => setCryptoSearchQuery(''), 200)}
                  autoComplete="off"
                  autoCapitalize="characters"
                  autoFocus
                />
                {suggestions.length > 0 && (
                  <div className="pat-search-dropdown">
                    {suggestions.map(r => (
                      <div key={r.symbol} className="pat-search-result"
                        onMouseDown={e => { e.preventDefault(); handleCryptoSelect(r); }}>
                        <span className="pat-search-sym">{r.symbol}</span>
                        <span className="pat-search-name">{r.name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <>
                <div className="pat-stock-chip">
                  <div className="pat-stock-chip-body">
                    <span className="pat-stock-chip-ticker">{f.coin}</span>
                    {f.name && <span className="pat-stock-chip-name">{f.name}</span>}
                  </div>
                  <button type="button" className="pat-stock-chip-clear"
                    onClick={() => { set('coin',''); set('name',''); set('qty',''); set('exchange',''); set('purchasePrice',''); setCryptoConfirmed(false); }}>×</button>
                </div>
                <input className={cls} type="number" inputMode="decimal"
                  placeholder="Quantidade" value={f.qty || ''}
                  onChange={e => set('qty', e.target.value)} autoFocus />
                <input className={cls} type="number" inputMode="decimal"
                  placeholder="Preço de compra por moeda (€)" value={f.purchasePrice || ''}
                  onChange={e => set('purchasePrice', e.target.value)} />
                <input className={cls}
                  placeholder="Exchange — ex: Binance, Coinbase (opcional)" value={f.exchange || ''}
                  onChange={e => set('exchange', e.target.value)} autoComplete="off" />
              </>
            )}
          </div>
        );
      }

      default: return null;
    }
  };

  // ── Patrimony JSX ──────────────────────────────────────────────────────────
  const fmt = (v) => toNum(v).toLocaleString('pt-PT', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  const typeValues = PATRIMONY_TYPES.map(t => ({ ...t, value: getPatrimonyTypeValue(t.key) }));

  const pctOf = (key) => totalPatrimony > 0 ? getPatrimonyTypeValue(key) / totalPatrimony : 0;
  const pctEquity = pctOf('stocks') + pctOf('etfs');
  const insightMsg =
    totalPatrimony === 0     ? 'Adiciona os teus ativos para começar a acompanhar o teu património.' :
    pctOf('accounts') > 0.6  ? 'Grande parte do património está em liquidez. Considera diversificar.' :
    pctOf('realestate') > 0.6? 'Património concentrado em imóveis — ativo ilíquido mas estável.' :
    pctOf('crypto') > 0.25   ? 'Exposição significativa a criptoativos. Alto risco, alto potencial.' :
    pctOf('etfs') > 0.4      ? 'Portfólio orientado a ETFs — diversificação passiva e eficiente.' :
    pctEquity > 0.4          ? 'Portfólio com forte componente em ações e ETFs. Boa diversificação de crescimento.' :
                               'Portfólio distribuído por múltiplos tipos de ativos.';

  const assetAlerts = [
    ...(patrimony.stocks ?? [])
      .map(s => ({ sym: s.ticker, pct: livePrices[s.ticker]?.changePct  ?? (s.changePct  != null ? parseFloat(s.changePct)  : null), label: 'hoje' }))
      .filter(x => x.pct != null && Math.abs(x.pct) >= 5),
    ...(patrimony.etfs ?? [])
      .map(e => ({ sym: e.ticker, pct: livePrices[e.ticker]?.changePct  ?? (e.changePct  != null ? parseFloat(e.changePct)  : null), label: 'hoje' }))
      .filter(x => x.pct != null && Math.abs(x.pct) >= 5),
    ...(patrimony.crypto ?? [])
      .map(c => ({ sym: normCoin(c.coin), pct: livePrices[normCoin(c.coin)]?.changePct24h ?? (c.change24h != null ? parseFloat(c.change24h) : null), label: '24h' }))
      .filter(x => x.pct != null && Math.abs(x.pct) >= 5),
  ];

  const allLiveVals = [
    ...(patrimony.stocks ?? []).map(s =>
      toNum(livePrices[s.ticker]?.price      ?? s.lastPrice ?? s.avgPrice) * toNum(s.qty)),
    ...(patrimony.etfs ?? []).map(e =>
      toNum(livePrices[e.ticker]?.price      ?? e.lastPrice ?? e.avgPrice) * toNum(e.qty)),
    ...(patrimony.crypto ?? []).map(c =>
      toNum(livePrices[normCoin(c.coin)]?.price ?? c.lastPrice ?? c.price) * toNum(c.qty)),
  ];
  const maxSingleImpact = totalPatrimony > 0
    ? Math.max(...allLiveVals.map(v => (v / totalPatrimony) * 100), 0.01)
    : 0.01;

  // ── Wealth Intelligence ────────────────────────────────────────────────────
  const last6Months = Array.from({ length: 6 }, (_, i) => shiftMonth(currentMonth, -(5 - i)));
  const monthlySavings = last6Months.map(m => {
    const txns = filterByFinancialMonth(transactions, m, financialMonthStartDay);
    const inc  = txns.filter(t => t.type === 'income') .reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);
    const exp  = txns.filter(t => t.type === 'expense').reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);
    return inc - exp;
  });
  const avg6        = toNum(monthlySavings.reduce((s, v) => s + toNum(v), 0) / 6);
  const avg3        = toNum(monthlySavings.slice(3).reduce((s, v) => s + toNum(v), 0) / 3);
  const forecast12  = toNum(totalPatrimony) + avg6 * 12;
  const monthlyRate = totalPatrimony > 0 ? (avg6 / toNum(totalPatrimony)) * 100 : 0;
  const trendDiff   = avg3 - avg6;
  const trendStatus = Math.abs(trendDiff) < 50 ? 'neutral' : trendDiff > 0 ? 'above' : 'below';
  const hasIntelData = monthlySavings.some(v => v !== 0);

  // ── Asset card renderer ────────────────────────────────────────────────────
  const assetCardFor = (item, assetKey) => {
    const isStock      = assetKey === 'stocks' || assetKey === 'etfs';
    const sym          = isStock ? item.ticker : normCoin(item.coin);
    const isRefreshing = refreshingTickers.has(sym);

    const live        = livePrices[sym];
    const marketPrice = toNum(live?.price ?? (isStock
      ? (item.lastPrice ?? item.avgPrice)
      : (item.lastPrice ?? item.price)));
    const marketVal   = toNum(item.qty) * marketPrice;
    const age         = formatAge(live?.lastUpdated ?? item.lastUpdated);
    const _rawChg     = live
      ? (isStock ? live.changePct : live.changePct24h)
      : (isStock ? item.changePct : item.change24h);
    const chg         = _rawChg != null && Number.isFinite(Number(_rawChg))
      ? Number(_rawChg)
      : null;
    const hasPrice    = marketPrice > 0;
    const sparkPrices  = assetHistory[sym];
    const sparkUp      = sparkPrices?.length >= 2
      ? sparkPrices[sparkPrices.length - 1] >= sparkPrices[0]
      : chg != null ? chg >= 0 : null;
    const sparkColor   = sparkUp === true ? 'var(--cosmos-income)' : sparkUp === false ? 'var(--cosmos-expense)' : 'var(--cosmos-text-3)';
    const impact       = totalPatrimony > 0 ? (marketVal / totalPatrimony) * 100 : 0;
    const barWidth     = maxSingleImpact > 0 ? Math.min((impact / maxSingleImpact) * 100, 100) : 0;
    const qty          = parseFloat(item.qty) || 0;
    const qtyLabel     = assetKey === 'etfs' ? 'unidades' : isStock ? 'ações' : 'moedas';
    const priceLabel   = assetKey === 'etfs' ? 'unidade'  : isStock ? 'ação'  : 'moeda';

    // ── P&L desde inserção ──────────────────────────────────────────────────
    const purchasePrice = parseFloat(item.purchasePrice) || 0;
    const hasPnl        = purchasePrice > 0 && hasPrice && qty > 0;
    const pnlAbs        = hasPnl ? (marketPrice - purchasePrice) * qty : 0;
    const pnlPct        = hasPnl ? ((marketPrice - purchasePrice) / purchasePrice) * 100 : 0;
    const pnlPositive   = pnlAbs >= 0;
    const insertedDate  = item.insertedAt
      ? new Date(item.insertedAt).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' })
      : null;

    return (
      <SwipeRevealCard
        key={item.id}
        className="pat-asset-card"
        onEdit={() => handlePatrimonyEdit(assetKey, item)}
        onDelete={() => handlePatrimonyDelete(assetKey, item.id)}
        onClick={() => handlePatrimonyEdit(assetKey, item)}
      >
        <div className="pat-asset-top">
          <div className="pat-asset-left">
            <div className="pat-stock-name-row">
              <span className="pat-cat-item-name">{sym}</span>
              {chg != null && (
                <span className={`pat-change-badge ${chg >= 0 ? 'pos' : 'neg'}`}>
                  {chg >= 0 ? '+' : ''}{chg.toFixed(2)}%
                </span>
              )}
            </div>
            {item.name && <span className="pat-asset-fullname">{item.name}</span>}
            <span className="pat-stock-sub">
              {isRefreshing ? (
                <span className="pat-stock-loading">A atualizar…</span>
              ) : hasPrice ? (
                <>{isStock ? fmtStockPrice(marketPrice) : fmtCryptoPrice(marketPrice)}€/{priceLabel} · {age}</>
              ) : (
                <span style={{ color: 'var(--text-tertiary)' }}>A aguardar cotação…</span>
              )}
            </span>
            {(item.broker || item.exchange) && (
              <span className="pat-asset-broker">{item.broker ?? item.exchange}</span>
            )}
          </div>
          <div className="pat-stock-right">
            <span className="pat-cat-item-val">{fmtFiat(marketVal)}€</span>
            <span className="pat-stock-qty">{qty} {qtyLabel}</span>
          </div>
        </div>
        <div className="pat-asset-bottom">
          <div className="pat-sparkline-wrap">
            {sparkPrices
              ? <Sparkline prices={sparkPrices} color={sparkColor} />
              : <div className="pat-sparkline-empty">{HAS_STOCK_KEY || !isStock ? '— sem histórico —' : ''}</div>
            }
          </div>
          {totalPatrimony > 0 && (
            <div className="pat-impact">
              <div className="pat-impact-bar-bg">
                <div className="pat-impact-bar-fill" style={{ width: `${barWidth}%`, background: sparkColor }} />
              </div>
              <span className="pat-impact-pct">{impact.toFixed(1)}%</span>
            </div>
          )}
        </div>
        {hasPnl && (
          <div className="pat-pnl-row">
            <span className="pat-pnl-label">
              desde inserção{insertedDate ? ` · ${insertedDate}` : ''}
            </span>
            <div className="pat-pnl-values">
              <span className={`pat-pnl-abs ${pnlPositive ? 'pos' : 'neg'}`}>
                {pnlPositive ? '+' : ''}{fmtFiat(pnlAbs)}€
              </span>
              <span className={`pat-pnl-pct ${pnlPositive ? 'pos' : 'neg'}`}>
                {pnlPositive ? '+' : ''}{pnlPct.toFixed(2)}%
              </span>
            </div>
          </div>
        )}
      </SwipeRevealCard>
    );
  };

  // ── Modal ──────────────────────────────────────────────────────────────────
  const renderModal = () => {
    if (!showPatrimonyModal) return null;
    const f   = patrimonyForm;
    const closeModal = () => {
      setShowPatrimonyModal(false);
      setPatrimonyFormType(null);
      setEditingAssetId(null);
      resetPatrimonyForm({});
      clearAssetForms();
    };
    const canSubmit = (() => {
      switch (patrimonyFormType) {
        case 'stocks':     return stockConfirmed  && !!f.qty;
        case 'etfs':       return etfConfirmed    && !!f.qty;
        case 'crypto':     return cryptoConfirmed && !!f.qty;
        case 'accounts':   return !!f.name;
        case 'bonds':      return !!f.series && !!f.value;
        case 'realestate': return !!f.description && !!f.value;
        case 'vehicles':   return !!f.description && !!f.value;
        default:           return true;
      }
    })();
    const typeLabel    = PATRIMONY_TYPES.find(t => t.key === patrimonyFormType)?.label ?? '';
    const modalTitle   = editingAssetId
      ? `Editar ${typeLabel}`
      : (patrimonyFormType ? `Adicionar ${typeLabel}` : 'Adicionar Activo');
    const submitLabel  = editingAssetId ? 'Guardar' : 'Adicionar';

    return (
      <Overlay onClose={closeModal}>
        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h4>{modalTitle}</h4>
            <button className="modal-close" onClick={closeModal}>×</button>
          </div>
          {!patrimonyFormType ? (
            <div className="patrimony-type-selector">
              {PATRIMONY_TYPES.map(({ key, label, Icon: PatIcon, color }) => (
                <button key={key} className="patrimony-type-btn" onClick={() => { setPatrimonyFormType(key); resetPatrimonyForm({}); }}>
                  <div className="patrimony-type-btn-icon" style={{ background: `${color}22` }}>
                    <PatIcon size={20} color={color} strokeWidth={2} />
                  </div>
                  <span>{label}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="patrimony-form">
              {renderPatrimonyForm()}
              <div className="patrimony-form-actions">
                {!editingAssetId && (
                  <button className="btn-patrimony-back" onClick={() => { setPatrimonyFormType(null); resetPatrimonyForm({}); }}>← Voltar</button>
                )}
                <button
                  className="btn-add-patrimony"
                  onClick={handlePatrimonySubmit}
                  disabled={!canSubmit}
                  style={!canSubmit ? { opacity: 0.45, cursor: 'not-allowed' } : undefined}
                >{submitLabel}</button>
              </div>
            </div>
          )}
        </div>
      </Overlay>
    );
  };

  return (
    <>
      {/* Hero card */}
      <div className="pat-hero">
        <div className="pat-hero-label">Património Total</div>
        <div className="pat-hero-amount">{fmt(totalPatrimony)}<span className="pat-hero-eur">€</span></div>
        {totalPatrimony > 0 && (
          <div className="pat-hero-chips">
            {typeValues.filter(t => t.value > 0).map(t => (
              <div key={t.key} className="pat-hero-chip">
                <span style={{ color: t.color, fontSize: '0.8rem' }}>{t.icon}</span>
                <span className="pat-hero-chip-val">{(pctOf(t.key) * 100).toFixed(0)}%</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Wealth Intelligence ── */}
      {hasIntelData && (
        <div className="pat-intel">
          <div className="pat-intel-forecast" style={avg6 >= 0
            ? { borderColor: 'rgba(74,222,128,0.18)', boxShadow: '0 4px 20px rgba(74,222,128,0.08)' }
            : { borderColor: 'rgba(248,113,113,0.18)', boxShadow: '0 4px 20px rgba(248,113,113,0.08)' }}>
            <div className="pat-intel-forecast-label">Previsão em 12 meses</div>
            <div className="pat-intel-forecast-amount" style={{ color: avg6 >= 0 ? 'var(--cosmos-income)' : 'var(--cosmos-expense)' }}>
              {fmt(Math.round(forecast12))}<span style={{ fontSize: '1.1rem', opacity: 0.65, marginLeft: 2 }}>€</span>
            </div>
            <div className="pat-intel-forecast-sub">
              {avg6 >= 0
                ? `+${fmt(Math.round(avg6 * 12))}€ ao ritmo atual de poupança`
                : `−${fmt(Math.round(Math.abs(avg6 * 12)))}€ — gastos superiores ao rendimento`}
            </div>
          </div>

          <div className="pat-intel-chips">
            <div className="pat-intel-chip">
              <span className="pat-intel-chip-val" style={{ color: avg6 >= 0 ? 'var(--cosmos-income)' : 'var(--cosmos-expense)' }}>
                {avg6 >= 0 ? '+' : ''}{fmt(Math.round(avg6))}€
              </span>
              <span className="pat-intel-chip-label">poupança / mês</span>
            </div>
            <div className="pat-intel-chip">
              <span className="pat-intel-chip-val" style={{ color: monthlyRate >= 0 ? 'var(--cosmos-income)' : 'var(--cosmos-expense)' }}>
                {monthlyRate >= 0 ? '+' : ''}{monthlyRate.toFixed(2)}%
              </span>
              <span className="pat-intel-chip-label">crescimento / mês</span>
            </div>
          </div>

          <div className="pat-intel-trend">
            <span className="pat-intel-trend-dot" style={{
              background: trendStatus === 'above' ? 'var(--cosmos-income)' : trendStatus === 'below' ? 'var(--cosmos-expense)' : 'var(--cosmos-text-3)'
            }} />
            <span className="pat-intel-trend-msg">
              {trendStatus === 'above'
                ? `Acima do teu padrão habitual · +${fmt(Math.round(trendDiff))}€/mês vs últimos 6m`
                : trendStatus === 'below'
                ? `Abaixo do teu ritmo habitual · ${fmt(Math.round(trendDiff))}€/mês vs últimos 6m`
                : 'Poupança estável nos últimos meses'}
            </span>
          </div>
        </div>
      )}

      {/* Micro insight — composition */}
      <div className="pat-insight">
        <span className="pat-insight-icon">◉</span>
        <span className="pat-insight-msg">{insightMsg}</span>
      </div>

      {/* Allocation distribution */}
      {totalPatrimony > 0 && (
        <div className="pat-alloc">
          <div className="pat-alloc-title">Distribuição</div>
          {typeValues
            .filter(t => t.value > 0)
            .sort((a, b) => b.value - a.value)
            .map(t => {
              const pct = (t.value / totalPatrimony) * 100;
              return (
                <div key={t.key} className="pat-alloc-row">
                  <div className="pat-alloc-info">
                    <span className="pat-alloc-name">
                      <span style={{ color: t.color, marginRight: 5 }}>{t.icon}</span>
                      {t.label}
                    </span>
                    <span className="pat-alloc-right">
                      <span className="pat-alloc-val">{fmt(t.value)}€</span>
                      <span className="pat-alloc-pct">{pct.toFixed(0)}%</span>
                    </span>
                  </div>
                  <div className="pat-alloc-bar-bg">
                    <div className="pat-alloc-bar-fill" style={{ width: `${pct}%`, background: t.color }} />
                  </div>
                </div>
              );
            })}
        </div>
      )}

      {/* ── Alerts panel ── */}
      {assetAlerts.length > 0 && (
        <div className="pat-alerts-panel">
          <div className="pat-alerts-title">◎ Movimentos significativos</div>
          {assetAlerts.map(({ sym, pct, label }) => (
            <div key={sym} className={`pat-alert-row ${pct >= 0 ? 'pos' : 'neg'}`}>
              <span className="pat-alert-sym">{sym}</span>
              <span className="pat-alert-msg">
                {pct >= 0 ? '↑' : '↓'} {Math.abs(pct).toFixed(2)}% {label}
              </span>
              <span className={`pat-alert-badge ${pct >= 0 ? 'pos' : 'neg'}`}>
                {pct >=  5 ? 'SUBIDA FORTE' : 'QUEDA FORTE'}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Category cards */}
      <div className="pat-cards">
        {sortPatrimonyTypes(patrimony, PATRIMONY_TYPES).map(({ key, label, Icon: PatIcon, color }) => {
          const items     = patrimony[key] || [];
          const sorted    = sortItemsByType(items, key);
          const typeTotal = getPatrimonyTypeValue(key);
          return (
            <div key={key} className="pat-cat-card">
              <div className="pat-cat-header">
                <div className="pat-cat-icon-wrap" style={{ background: `${color}22` }}>
                  <PatIcon size={18} color={color} strokeWidth={2} />
                </div>
                <div className="pat-cat-info">
                  <span className="pat-cat-name">{label}</span>
                  <span className="pat-cat-count">{items.length} {items.length === 1 ? 'ativo' : 'ativos'}</span>
                </div>
                <span className="pat-cat-total" style={typeTotal > 0 ? { color } : {}}>
                  {typeTotal > 0 ? `${fmt(typeTotal)}€` : '—'}
                </span>
              </div>
              {items.length > 0 && (
                <div className="pat-cat-items">
                  {key === 'etfs' ? sorted.map(item => assetCardFor(item, 'etfs'))
                  : key === 'accounts' ? sorted.map(item => {
                    const currentBal = computeAccountBalanceLocal(item);
                    const isMain     = item.id === mainAccountId;
                    return (
                      <SwipeRevealCard
                        key={item.id}
                        className={`pat-cat-item pat-account-item${isMain ? ' pat-account-item--main' : ''}`}
                        onEdit={() => handlePatrimonyEdit('accounts', item)}
                        onDelete={() => handlePatrimonyDelete('accounts', item.id)}
                      >
                        <div className="pat-account-left">
                          <div className="pat-account-name-row">
                            <span className="pat-cat-item-name">{item.name}{item.bank ? ` · ${item.bank}` : ''}</span>
                            {isMain && <span className="pat-account-badge-main">Principal</span>}
                          </div>
                          <div className="pat-account-bal-row">
                            <span className="pat-account-current-bal">{currentBal.toFixed(2)}€</span>
                            {parseFloat(item.balance || 0) !== currentBal && (
                              <span className="pat-account-initial-bal">base {parseFloat(item.balance || 0).toFixed(2)}€</span>
                            )}
                          </div>
                        </div>
                        {onMainAccountChange && (
                          <button
                            className={`pat-account-btn-main${isMain ? ' active' : ''}`}
                            onClick={() => onMainAccountChange(isMain ? null : item.id)}
                            title={isMain ? 'Remover como Principal' : 'Definir como Principal'}
                          >{isMain ? '★' : '☆'}</button>
                        )}
                      </SwipeRevealCard>
                    );
                  }) : key === 'crypto' ? (() => {
                    const byExchange = {};
                    sorted.forEach(item => {
                      const ex = item.exchange || 'Sem exchange';
                      if (!byExchange[ex]) byExchange[ex] = [];
                      byExchange[ex].push(item);
                    });
                    const multiGroup = Object.keys(byExchange).length > 1;
                    return Object.entries(byExchange).flatMap(([ex, groupItems]) => [
                      ...(multiGroup ? [
                        <div key={`hdr-${ex}`} className="pat-exchange-header">
                          <span className="pat-exchange-name">{ex}</span>
                          <span className="pat-exchange-count">{groupItems.length}</span>
                        </div>
                      ] : []),
                      ...groupItems.map(item => assetCardFor(item, 'crypto')),
                    ]);
                  })() : sorted.map(item => {
                    if (key === 'stocks') return assetCardFor(item, 'stocks');
                    return (
                      <SwipeRevealCard
                        key={item.id}
                        className="pat-cat-item"
                        onEdit={() => handlePatrimonyEdit(key, item)}
                        onDelete={() => handlePatrimonyDelete(key, item.id)}
                      >
                        <span className="pat-cat-item-name">{renderPatrimonyItemLabel(key, item)}</span>
                        <span className="pat-cat-item-val">{renderPatrimonyItemValue(key, item)}</span>
                      </SwipeRevealCard>
                    );
                  })}
                </div>
              )}
              {items.length === 0 && <div className="pat-cat-empty">Sem registos · toca + para adicionar</div>}
            </div>
          );
        })}
      </div>

      {/* FAB */}
      <button className="m-fab" onClick={() => setShowPatrimonyModal(true)}>+</button>

      {renderModal()}
      {confirmDeleteAsset && (
        <Overlay onClose={() => setConfirmDeleteAsset(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h4>Remover activo?</h4>
              <button className="modal-close" onClick={() => setConfirmDeleteAsset(null)}>×</button>
            </div>
            <div className="modal-body" style={{ padding: '0 0 8px' }}>
              <p style={{ marginBottom: 16, color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                <strong>{confirmDeleteAsset.name}</strong> será removido do teu património.
              </p>
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  style={{ flex: 1, padding: '10px', borderRadius: '10px', border: '1px solid var(--separator)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.875rem' }}
                  onClick={() => setConfirmDeleteAsset(null)}
                >Cancelar</button>
                <button
                  style={{ flex: 1, padding: '10px', borderRadius: '10px', border: 'none', background: 'var(--cosmos-expense)', color: '#fff', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.875rem', fontWeight: 600 }}
                  onClick={handlePatrimonyDeleteConfirmed}
                >Remover</button>
              </div>
            </div>
          </div>
        </Overlay>
      )}
    </>
  );
};

export default PatrimonyView;
