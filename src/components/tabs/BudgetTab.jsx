import React, { useState, useEffect, useRef, useMemo } from 'react';
import { dbService } from '../../lib/supabase';
import Overlay from '../Overlay';
import { useForm } from '../../hooks/useForm';
import { Card, Bubble } from '../ui';
import { shiftMonth, formatMonthLabel, getPrediction } from '../../utils/insights';
import { isInFinancialMonth, filterByFinancialMonth, shiftFinancialMonth, getFinancialMonthRange } from '../../utils/financialMonth';
import { fetchStockQuote, fetchCryptoTwelveData, fetchStockHistory, fetchCryptoHistoryBatch, fetchStockSearch, getPrice, isStale, formatAge, HAS_STOCK_KEY, CACHE_TTL, HISTORY_TTL } from '../../utils/assetPrice';
import { searchAssets } from '../../utils/searchAssets';

/* ─── Sparkline SVG ─────────────────────────────────────────────────────────
   Pure SVG mini line chart from an array of prices (oldest→newest).
   Defined outside BudgetTab so its reference is stable across renders.     */
const Sparkline = ({ prices, color = '#22c55e', width = 68, height = 26 }) => {
  if (!prices || prices.length < 2) return null;
  const min   = Math.min(...prices);
  const max   = Math.max(...prices);
  const range = max === min ? (max * 0.02 || 1) : max - min;
  const pad   = 2;
  const pts   = prices.map((p, i) => {
    const x = pad + (i / (prices.length - 1)) * (width  - pad * 2);
    const y = (height - pad) - ((p - min) / range) * (height - pad * 2);
    return [+x.toFixed(1), +y.toFixed(1)];
  });
  const line = pts.map(([x, y]) => `${x},${y}`).join(' ');
  const area = [
    `${pts[0][0]},${height}`,
    ...pts.map(([x, y]) => `${x},${y}`),
    `${pts[pts.length - 1][0]},${height}`,
  ].join(' ');
  const [lx, ly] = pts[pts.length - 1];
  return (
    <svg width={width} height={height} className="pat-sparkline-svg">
      <polygon  points={area} fill={color} opacity="0.1" />
      <polyline points={line} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={lx} cy={ly} r="2.2" fill={color} />
    </svg>
  );
};
import PageHeader from '../PageHeader';
import SwipeRevealCard from '../SwipeRevealCard';
import RecurringView from '../budget/RecurringView';
import { getTotalMonthlyCommitted } from '../../utils/recurringPayments';
import { getCategoryMeta, PATRIMONY_META } from '../../utils/categoryIcons';
import './BudgetTab.css';

/* ── Asset/Patrimony Sorting Utilities ────────────────────────────────────── */

// Compute value of a patrimony item (type-specific)
const getItemValue = (item, typeKey) => {
  if (typeKey === 'accounts') return parseFloat(item.currentBalance ?? item.balance) || 0;
  if (typeKey === 'stocks')   return (parseFloat(item.qty) || 0) * (parseFloat(item.avgPrice) || 0);
  if (typeKey === 'crypto')   return (parseFloat(item.qty) || 0) * (parseFloat(item.price) || 0);
  if (typeKey === 'bonds')    return parseFloat(item.value) || 0;
  if (typeKey === 'vehicles') return parseFloat(item.value) || 0;
  if (typeKey === 'realestate') return parseFloat(item.value) || 0;
  return 0;
};

// Sort items within a patrimony type by relevance
const sortItemsByType = (items, typeKey) => {
  const copy = [...items];
  if (typeKey === 'accounts') {
    return copy.sort((a, b) => {
      const balB = getItemValue(b, typeKey);
      const balA = getItemValue(a, typeKey);
      if (balB !== balA) return balB - balA;
      return (a.name || '').localeCompare(b.name || '');
    });
  }
  if (typeKey === 'stocks' || typeKey === 'crypto') {
    return copy.sort((a, b) => {
      const valB = getItemValue(b, typeKey);
      const valA = getItemValue(a, typeKey);
      if (valB !== valA) return valB - valA;
      const nameA = (a.ticker || a.coin || '').toUpperCase();
      const nameB = (b.ticker || b.coin || '').toUpperCase();
      return nameA.localeCompare(nameB);
    });
  }
  // bonds, vehicles, realestate: sort alphabetically by name
  return copy.sort((a, b) => {
    const nameA = (a.name || '').toLowerCase();
    const nameB = (b.name || '').toLowerCase();
    return nameA.localeCompare(nameB);
  });
};

// Dynamically reorder patrimony types: active (with items) first, then empty
const sortPatrimonyTypes = (patrimony, types) => {
  const typeValues = types.map(t => {
    const items = patrimony[t.key] || [];
    const hasItems = items.length > 0;
    const totalValue = items.reduce((s, x) => s + getItemValue(x, t.key), 0);
    return { ...t, hasItems, totalValue };
  });

  // Active types first (by total value descending), then inactive (alphabetical)
  return typeValues.sort((a, b) => {
    if (a.hasItems !== b.hasItems) return a.hasItems ? -1 : 1;
    if (a.hasItems) return b.totalValue - a.totalValue;
    return (a.label || '').localeCompare(b.label || '');
  });
};

const PATRIMONY_TYPES = [
  { key: 'accounts',   label: 'Contas Bancárias', ...PATRIMONY_META.accounts   },
  { key: 'stocks',     label: 'Ações',             ...PATRIMONY_META.stocks     },
  { key: 'bonds',      label: 'Cert. Aforro',      ...PATRIMONY_META.bonds      },
  { key: 'realestate', label: 'Imóveis',            ...PATRIMONY_META.realestate },
  { key: 'vehicles',   label: 'Veículos',           ...PATRIMONY_META.vehicles   },
  { key: 'crypto',     label: 'Crypto',             ...PATRIMONY_META.crypto     },
];

const EMPTY_PATRIMONY = { accounts: [], stocks: [], bonds: [], realestate: [], vehicles: [], crypto: [] };
const EMPTY_GOAL      = { name: '', amount: '', targetDate: '', currentSavings: '' };

/**
 * Safe numeric conversion used throughout all financial calculations.
 * Returns 0 for NaN, ±Infinity, null, undefined, "", or any non-finite value.
 * Unlike `parseFloat(v) || 0`, this correctly handles the case where `??`
 * would silently pass through a NaN stored in livePrices or localStorage.
 *   toNum(undefined) → 0
 *   toNum(null)      → 0
 *   toNum(NaN)       → 0   ← the critical case ?? misses
 *   toNum("3.14")    → 3.14
 *   toNum(0)         → 0
 */
const toNum = (v) => { const x = Number(v); return Number.isFinite(x) ? x : 0; };

/**
 * Normalises a crypto coin symbol to its base ticker.
 * Strips any exchange-pair suffix so both old ("BTC/USD") and
 * new ("BTC") stored values map to the same livePrices key.
 *   normCoin("BTC/USD")  → "BTC"
 *   normCoin("ETH/USDT") → "ETH"
 *   normCoin("BTC")      → "BTC"
 *   normCoin(undefined)  → ""
 */
const normCoin = (sym) => sym?.split('/')[0]?.toUpperCase() ?? '';


/* 4-level budget status ─────────────────────────────────────────────────── */
const STATUS = (pct) => {
  if (pct >= 100) return { key: 'over',   label: 'Ultrapassado',    color: '#ef4444', grad: 'linear-gradient(90deg,#991b1b,#ef4444)', glow: 'rgba(239,68,68,0.35)'   };
  if (pct >= 90)  return { key: 'danger', label: 'Quase no limite', color: '#f97316', grad: 'linear-gradient(90deg,#c2410c,#fb923c)', glow: 'rgba(249,115,22,0.28)'  };
  if (pct >= 70)  return { key: 'warn',   label: 'Atenção',         color: '#F59E0B', grad: 'linear-gradient(90deg,#b45309,#fbbf24)', glow: 'rgba(245,158,11,0.25)'  };
  return           { key: 'safe',   label: 'Seguro',            color: '#22c55e', grad: 'linear-gradient(90deg,#15803d,#4ade80)', glow: 'rgba(34,197,94,0.22)'   };
};

const CountUp = ({ value, decimals = 0 }) => {
  const [display, setDisplay] = useState(0);
  const fromRef = useRef(0);
  const rafRef  = useRef(null);
  useEffect(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    const from = fromRef.current;
    const start = Date.now();
    const tick = () => {
      const p = Math.min((Date.now() - start) / 700, 1);
      const eased = 1 - (1 - p) ** 3;
      const curr = from + (value - from) * eased;
      setDisplay(curr);
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
      else fromRef.current = value;
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [value]);
  return <>{display.toFixed(decimals)}</>;
};

/* SwipeRevealCard is now imported from ../SwipeRevealCard */

const BudgetCategoryCard = ({ cat, limit, spent, percent, delta, animated, isEditing, onEditToggle, onLimitChange, onSave, onOpenHistory }) => {
  const { Icon: CatIcon, color: catColor } = getCategoryMeta(cat.label);
  const st = STATUS(percent);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!isEditing) return;
    const t = setTimeout(() => inputRef.current?.focus(), 200);
    return () => clearTimeout(t);
  }, [isEditing]);

  return (
    <div
      className="m-gcc"
      style={{ borderTopColor: limit > 0 ? st.color : 'rgba(255,255,255,0.08)' }}
      onClick={onOpenHistory}
    >
      <div className="m-gcc-top">
        <div className="m-gcc-ico" style={{ background: catColor + '1A' }}>
          <CatIcon size={16} color={catColor} strokeWidth={1.75} />
        </div>
        <div className="m-gcc-right">
          {limit > 0 && <div className="m-gcc-pct" style={{ color: st.color }}>{percent.toFixed(0)}%</div>}
          {delta > 0.5  && <div className="m-gcc-delta up">+{delta.toFixed(0)}€ ↑</div>}
          {delta < -0.5 && <div className="m-gcc-delta down">−{Math.abs(delta).toFixed(0)}€ ↓</div>}
        </div>
      </div>
      <div className="m-gcc-name">{cat.label}</div>
      <div className="m-gcc-amounts">
        {spent.toFixed(0)}€{limit > 0 ? <span> /{limit.toFixed(0)}€</span> : null}
      </div>
      {limit > 0 && (
        <div className="m-gcc-bar-bg">
          <div
            className="m-gcc-bar-fill"
            style={{
              width: animated ? `${Math.min(percent, 100)}%` : '0%',
              background: st.grad,
              boxShadow: animated ? `0 0 8px ${st.glow}` : 'none',
            }}
          />
        </div>
      )}
      {isEditing && (
        <div className="m-gcc-edit-row" onClick={e => e.stopPropagation()}>
          <input
            ref={inputRef}
            type="number"
            inputMode="decimal"
            className="m-gcc-input"
            value={limit || ''}
            onChange={e => onLimitChange(cat.id, e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { onSave(); e.target.blur(); } }}
            onBlur={onSave}
            placeholder="Limite €/mês"
          />
          <button className="m-gcc-save-btn" onClick={e => { e.stopPropagation(); onSave(); }}>✓</button>
        </div>
      )}
      <button
        className="m-gcc-edit-btn"
        onClick={e => { e.stopPropagation(); onEditToggle(); }}
        aria-label="Editar limite"
      >✎</button>
    </div>
  );
};

/**
 * Isolated input so the goal-savings field has its own draft.
 * onChange → local draft only.  onBlur → parent save (touches DB).
 */
const GoalSavingsInput = ({ goal, onSave, className }) => {
  const { draft, setField } = useForm({ currentSavings: goal.currentSavings ?? 0 });
  return (
    <input
      type="number"
      className={className}
      value={draft.currentSavings || ''}
      onChange={(e) => setField('currentSavings', e.target.value)}
      onBlur={() => onSave(goal.id, parseFloat(draft.currentSavings) || 0)}
      step="10"
      min="0"
      placeholder="0"
    />
  );
};

// STOCK_LIST and CRYPTO_LIST have been moved to src/data/assetsList.js.
// Search is now handled by searchAssets() from src/utils/searchAssets.js.

const CategoryHistorySheet = ({ catId, categories, txByCategory, budgets, sortedItems, animated: budgetAnimated, isVisible, onClose }) => {
  const [txVisible, setTxVisible] = useState([]);

  const catData = catId ? sortedItems.find(i => i.cat.id === catId) : null;
  const txs = catId ? (txByCategory[catId] || []) : [];
  const { Icon: CatIcon, color: catColor } = catData ? getCategoryMeta(catData.cat.label) : { Icon: () => null, color: '#475569' };
  const st = catData ? STATUS(catData.percent) : STATUS(0);

  useEffect(() => {
    if (!isVisible) { setTxVisible([]); return; }
    setTxVisible([]);
    txs.forEach((_, i) => {
      setTimeout(() => setTxVisible(prev => [...prev, i]), 180 + i * 55);
    });
  }, [isVisible, catId]);

  if (!catId) return null;

  const remaining = catData ? catData.limit - catData.spent : 0;
  const isOver = catData && catData.percent >= 100;

  return (
    <>
      <div
        className={`m-sheet-backdrop${isVisible ? ' open' : ''}`}
        onClick={onClose}
      />
      <div className={`m-sheet${isVisible ? ' open' : ''}`}>
        <div className="m-sheet-handle" />
        <div className="m-sheet-header">
          <div className="m-sheet-ico" style={{ background: catColor + '1A' }}>
            <CatIcon size={18} color={catColor} strokeWidth={1.75} />
          </div>
          <div className="m-sheet-hdr-info">
            <div className="m-sheet-title">{catData?.cat.label || ''}</div>
            <div className="m-sheet-subtitle">{txs.length} transações este mês</div>
          </div>
          <button className="m-sheet-close" onClick={onClose}>✕</button>
        </div>

        <div className="m-sheet-stats">
          <div className="m-sheet-stat">
            <div className="m-sheet-stat-lbl">Gasto</div>
            <div className="m-sheet-stat-val" style={{ color: isOver ? '#F87171' : '#E2E8F0' }}>
              {catData ? catData.spent.toFixed(0) : 0}€
            </div>
          </div>
          <div className="m-sheet-stat">
            <div className="m-sheet-stat-lbl">Orçamento</div>
            <div className="m-sheet-stat-val" style={{ color: '#00DDFF' }}>
              {catData && catData.limit > 0 ? catData.limit.toFixed(0) : '—'}€
            </div>
          </div>
          <div className="m-sheet-stat">
            <div className="m-sheet-stat-lbl">Restante</div>
            <div className="m-sheet-stat-val" style={{ color: remaining >= 0 ? '#4ADE80' : '#F87171' }}>
              {catData && catData.limit > 0 ? `${remaining >= 0 ? '' : '−'}${Math.abs(remaining).toFixed(0)}€` : '—'}
            </div>
          </div>
        </div>

        {catData && catData.limit > 0 && (
          <div className="m-sheet-prog-wrap">
            <div className="m-sheet-prog-row">
              <span className="m-sheet-prog-lbl">{catData.percent.toFixed(0)}% do orçamento</span>
              {catData.delta > 0.5  && <span className="m-sheet-delta up">+{catData.delta.toFixed(0)}€ ↑</span>}
              {catData.delta < -0.5 && <span className="m-sheet-delta down">−{Math.abs(catData.delta).toFixed(0)}€ ↓</span>}
            </div>
            <div className="m-sheet-prog-track">
              <div
                className="m-sheet-prog-fill"
                style={{
                  width: isVisible ? `${Math.min(catData.percent, 100)}%` : '0%',
                  background: st.grad,
                  boxShadow: isVisible ? `0 0 8px ${st.glow}` : 'none',
                  transition: 'width 0.8s cubic-bezier(0.4,0,0.2,1) 0.1s',
                }}
              />
            </div>
          </div>
        )}

        <div className="m-sheet-txs-label">Histórico do mês</div>
        <div className="m-sheet-txs-list">
          {txs.length === 0 ? (
            <div className="m-sheet-txs-empty">Sem transações neste mês</div>
          ) : (
            txs.map((tx, i) => (
              <div
                key={tx.id || i}
                className="m-sheet-tx-row"
                style={{
                  opacity: txVisible.includes(i) ? 1 : 0,
                  transform: txVisible.includes(i) ? 'translateY(0)' : 'translateY(10px)',
                  transition: 'opacity 0.25s ease, transform 0.25s ease',
                }}
              >
                <div className="m-sheet-tx-dot" style={{ background: catColor }} />
                <div className="m-sheet-tx-info">
                  <div className="m-sheet-tx-name">{tx.description || tx.title || tx.category}</div>
                  {tx.account_name && <div className="m-sheet-tx-acc">{tx.account_name}</div>}
                </div>
                <div className="m-sheet-tx-right">
                  <div className="m-sheet-tx-amount">−{parseFloat(tx.amount || 0).toFixed(2)}€</div>
                  <div className="m-sheet-tx-date">
                    {tx.date ? new Date(tx.date + 'T00:00:00').toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' }) : ''}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
};

const BudgetTab = ({ user, transactions, currentMonth, categories, budgets: externalBudgets = {}, onBudgetsChange, patrimony: externalPatrimony, onPatrimonyChange, mainAccountId, onMainAccountChange, theme = 'default', financialMonthStartDay = 1, pendingNav, onNavConsumed, recurringPayments = [], onRecurringPaymentsChange, confirmedRecurring = {}, onConfirmRecurring }) => {
  // ── useForm-backed drafts (onChange → local only; save on blur / button) ──
  const { draft: budgets, setField: setBudgetField, reset: resetBudgets, save: saveBudgetsForm } = useForm(externalBudgets);
  const { draft: newGoal,      setField: setGoalField,      reset: resetGoal                               } = useForm(EMPTY_GOAL);
  const { draft: patrimonyForm, setField: setPatrimonyField, reset: resetPatrimonyForm                     } = useForm({});

  const [activeView,          setActiveView]          = useState('budgets');

  // Scroll outer container to top whenever the inner view changes
  const budgetTabRef = useRef(null);
  useEffect(() => {
    const outer = budgetTabRef.current?.closest('.main-content-new');
    if (outer) outer.scrollTop = 0;
  }, [activeView]);
  const [goals,               setGoals]               = useState([]);
  const [editingGoalId,       setEditingGoalId]       = useState(null);
  const [showPatrimonyModal,  setShowPatrimonyModal]  = useState(false);
  const [patrimonyFormType,   setPatrimonyFormType]   = useState(null);
  const [editingCategoryId,   setEditingCategoryId]   = useState(null);
  const [showInactive,        setShowInactive]        = useState(false);
  const [expandedCategoryId,  setExpandedCategoryId]  = useState(null);
  const [navExpandedId,       setNavExpandedId]       = useState(null);
  const [sheetCategoryId,     setSheetCategoryId]     = useState(null);
  const [sheetVisible,        setSheetVisible]        = useState(false);

  const openCategorySheet = (catId) => {
    setSheetCategoryId(catId);
    setTimeout(() => setSheetVisible(true), 10);
  };
  const closeCategorySheet = () => {
    setSheetVisible(false);
    setTimeout(() => setSheetCategoryId(null), 350);
  };

  useEffect(() => {
    if (!pendingNav) return;
    if (pendingNav.view) {
      setActiveView(pendingNav.view);
    } else if (pendingNav.categoryLabel) {
      setActiveView('budgets');
      const cat = categories.expense.find(c => c.label === pendingNav.categoryLabel);
      if (cat) openCategorySheet(cat.id);
    }
    onNavConsumed?.();
  }, [pendingNav]);
  const [animated,            setAnimated]            = useState(false);
  const [selectedMonth,       setSelectedMonth]       = useState(currentMonth);
  const [refreshingTickers,   setRefreshingTickers]   = useState(new Set());
  const [assetHistory,        setAssetHistory]        = useState({});  // { ticker/coin → number[] }
  const [stockSearchQuery,    setStockSearchQuery]    = useState('');   // live filter text
  const [stockConfirmed,      setStockConfirmed]      = useState(false); // true only after explicit click/Enter
  const [cryptoSearchQuery,   setCryptoSearchQuery]   = useState('');   // live filter text for crypto
  const [cryptoConfirmed,     setCryptoConfirmed]     = useState(false); // true only after explicit click/Enter
  const [editingAssetId,      setEditingAssetId]      = useState(null);  // null = add, string = editing existing
  const [stockApiResults,    setStockApiResults]    = useState([]);     // results from Twelve Data /symbol_search
  const [stockApiLoading,    setStockApiLoading]    = useState(false);  // true while debounced fetch is in-flight
  // Local price cache — keyed by ticker/coin symbol.
  // Writing here always triggers a re-render inside BudgetTab without
  // depending on the App callback → DB save → prop update chain.
  // Shape: { [sym]: { price: number, changePct?: number, changePct24h?: number, lastUpdated: string } }
  const [livePrices,         setLivePrices]         = useState({});

  // Refs so the stock-price effect can read latest values without re-triggering
  const patrimonyRef         = useRef(externalPatrimony);
  const onPatrimonyChangeRef = useRef(onPatrimonyChange);
  const stockSearchTimerRef  = useRef(null);
  useEffect(() => { patrimonyRef.current = externalPatrimony; },  [externalPatrimony]);
  useEffect(() => { onPatrimonyChangeRef.current = onPatrimonyChange; }, [onPatrimonyChange]);

  useEffect(() => { setSelectedMonth(currentMonth); }, [currentMonth]);

  // ── Debounced stock symbol search (Twelve Data /symbol_search) ─────────────
  // Fires 350 ms after the user stops typing; deduplicates against STOCK_LIST.
  // When no API key is set, fetchStockSearch returns [] and local list is used.
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
      const results = await fetchStockSearch(q);
      setStockApiResults(results);
      setStockApiLoading(false);
    }, 350);
    return () => { if (stockSearchTimerRef.current) clearTimeout(stockSearchTimerRef.current); };
  }, [stockSearchQuery]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync local draft whenever App-level budgets change (initial load or external update)
  useEffect(() => { resetBudgets(externalBudgets); }, [externalBudgets]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (activeView !== 'budgets') return;
    setAnimated(false);
    const t = setTimeout(() => setAnimated(true), 80);
    return () => clearTimeout(t);
  }, [activeView, transactions, selectedMonth]);

  // ── Live asset prices: stocks + crypto via Twelve Data (5 min refresh) ─────
  // Runs immediately when patrimony view opens, then every CACHE_TTL (5 min).
  // Only fetches assets whose lastUpdated is stale (> CACHE_TTL).
  // All failures are silent — stored lastPrice is kept as fallback.
  useEffect(() => {
    if (activeView !== 'patrimony') return;

    let cancelled = false;

    const runRefresh = async () => {
      const current = patrimonyRef.current;
      if (!current) return;

      const stocks  = current.stocks  ?? [];
      const cryptos = current.crypto  ?? [];
      const now     = new Date().toISOString();

      const staleStocks = HAS_STOCK_KEY
        ? stocks.filter(s => s.ticker && isStale(s.lastUpdated))
        : [];
      const staleCoins = cryptos.filter(c => c.coin && isStale(c.lastUpdated));

      if (staleStocks.length === 0 && staleCoins.length === 0) return;

      // Mark all stale assets as "refreshing"
      // normCoin: ensures "BTC/USD" and "BTC" both key to "BTC"
      setRefreshingTickers(new Set([
        ...staleStocks.map(s => s.ticker),
        ...staleCoins.map(c => normCoin(c.coin)),
      ]));

      // Fetch stocks + crypto in parallel
      // Crypto: pass normalised base symbols; fetchCryptoTwelveData appends /USD internally
      const [stockResults, cryptoPrices] = await Promise.all([
        Promise.allSettled(staleStocks.map(s => fetchStockQuote(s.ticker))),
        fetchCryptoTwelveData(staleCoins.map(c => normCoin(c.coin))),
      ]);

      if (cancelled) return;

      // Build a flat map of all successful price results
      // { [sym]: { price, changePct?, changePct24h?, lastUpdated } }
      const priceUpdates = {};

      staleStocks.forEach((s, idx) => {
        const r = stockResults[idx];
        if (r?.status === 'fulfilled' && r.value !== null) {
          priceUpdates[s.ticker] = {
            price:      r.value.price,
            changePct:  r.value.changePct ?? null,
            lastUpdated: now,
          };
        }
      });

      // Key by normalised base symbol so livePrices lookups are consistent
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

      console.log('[BudgetTab] PRICES STATE:', priceUpdates);

      if (Object.keys(priceUpdates).length === 0) {
        setRefreshingTickers(new Set());
        return;
      }

      // ① Update local React state FIRST — guaranteed re-render on all devices
      setLivePrices(prev => ({ ...prev, ...priceUpdates }));

      // ② Persist back to parent (DB save) — secondary, failures are silent
      const updatedStocks = stocks.map(s => {
        const p = priceUpdates[s.ticker];
        return p ? { ...s, lastPrice: p.price, changePct: p.changePct, lastUpdated: now } : s;
      });
      const updatedCrypto = cryptos.map(c => {
        const p = priceUpdates[normCoin(c.coin)];
        return p ? { ...c, lastPrice: p.price, change24h: p.changePct24h, lastUpdated: now } : c;
      });
      onPatrimonyChangeRef.current?.({ ...current, stocks: updatedStocks, crypto: updatedCrypto });

      setRefreshingTickers(new Set());
    };

    runRefresh();
    const interval = setInterval(runRefresh, CACHE_TTL);
    return () => { cancelled = true; clearInterval(interval); };
  }, [activeView]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── 7-day price history for sparklines (stocks + crypto) ─────────────────
  // Fetches once on patrimony view open, then refreshes every 5 min.
  // Results stored in assetHistory keyed by ticker / coin symbol.
  useEffect(() => {
    if (activeView !== 'patrimony') return;
    let cancelled = false;

    const fetchHistories = async () => {
      const current = patrimonyRef.current;
      if (!current) return;
      const stocks  = (current.stocks  ?? []).filter(s => s.ticker);
      const cryptos = (current.crypto  ?? []).filter(c => c.coin);
      if (stocks.length === 0 && cryptos.length === 0) return;

      const [stockResults, cryptoHistories] = await Promise.all([
        Promise.allSettled(
          stocks.map(s => fetchStockHistory(s.ticker).then(prices => ({ ticker: s.ticker, prices })))
        ),
        // normCoin: CoinGecko also expects base symbols ("BTC" not "BTC/USD")
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
  }, [activeView]); // eslint-disable-line react-hooks/exhaustive-deps

  const patrimony = externalPatrimony || EMPTY_PATRIMONY;

  // initialBalance (account.balance) + all linked transaction effects = live current balance
  const computeAccountBalance = (acc) => {
    const initial = parseFloat(acc.balance ?? 0);
    if (isNaN(initial)) return 0;
    return (transactions || []).reduce((sum, tx) => {
      if (tx.account_id !== acc.id) return sum;
      const amt = parseFloat(tx.amount) || 0;
      if (tx.type === 'income')  return sum + amt;
      if (tx.type === 'expense') return sum - amt;
      if (tx.type === 'transfer') {
        const isOut = /^Transferência para/i.test(tx.description || '');
        return isOut ? sum - amt : sum + amt;
      }
      return sum;
    }, initial);
  };

  useEffect(() => { loadData(); }, [user]);

  const loadData = async () => {
    try {
      const settings = await dbService.getUserSettings(user.id);
      // budgets are owned by App.jsx — only goals are loaded here
      if (settings?.goals) setGoals(settings.goals);
    } catch (error) { console.error('Error loading data:', error); }
  };

  const saveBudgetToDb = () => {
    saveBudgetsForm((current) => {
      onBudgetsChange && onBudgetsChange(current);
    });
  };

  const saveGoals = async (updatedGoals) => {
    try {
      await dbService.updateUserSettings(user.id, { goals: updatedGoals });
      setGoals(updatedGoals);
    } catch (error) { console.error('Error saving goals:', error); alert('Erro ao guardar objetivos'); }
  };

  const handleAddGoal = () => {
    if (!newGoal.name || !newGoal.amount) { alert('Preenche nome e valor'); return; }
    const goal = {
      id: Date.now().toString(),
      ...newGoal,
      amount: parseFloat(newGoal.amount),
      currentSavings: parseFloat(newGoal.currentSavings) || 0,
    };
    saveGoals([...goals, goal]);
    resetGoal(EMPTY_GOAL);
  };

  // Called only from GoalSavingsInput.onBlur — never from onChange.
  const handleUpdateGoalSavings = (goalId, value) => {
    saveGoals(goals.map(g => g.id === goalId ? { ...g, currentSavings: parseFloat(value) || 0 } : g));
  };

  const handleDeleteGoal = async (goalId) => {
    if (!confirm('Apagar este objetivo?')) return;
    saveGoals(goals.filter(g => g.id !== goalId));
  };

  // onChange → local draft only.  DB save happens via saveBudgetToDb button / Enter.
  const handleLimitChange = (categoryId, value) => {
    setBudgetField(categoryId, parseFloat(value) || 0);
  };

  const getSpentForMonth = (categoryId, month) => {
    const categoryName = categories.expense.find(c => c.id === categoryId)?.label;
    return transactions
      .filter(t => t.type === 'expense' && t.category === categoryName && t.date && isInFinancialMonth(t.date, month, financialMonthStartDay))
      .reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);
  };

  const getSpentByCategory = (categoryId) => getSpentForMonth(categoryId, selectedMonth);

  const sortedItems = useMemo(() => {
    const prevMonth = shiftFinancialMonth(selectedMonth, -1);
    return categories.expense
      .map(cat => {
        const limit     = budgets[cat.id] || 0;
        const spent     = getSpentForMonth(cat.id, selectedMonth);
        const prevSpent = getSpentForMonth(cat.id, prevMonth);
        const percent   = limit > 0 ? (spent / limit) * 100 : 0;
        const delta     = spent - prevSpent;
        const predicted = getPrediction(spent, selectedMonth, financialMonthStartDay);
        return { cat, limit, spent, percent, delta, predicted };
      })
      .sort((a, b) => b.percent - a.percent);
  }, [categories.expense, budgets, transactions, selectedMonth]);

  const activeItems   = sortedItems.filter(i => i.limit > 0 || i.spent > 0);
  const inactiveItems = sortedItems.filter(i => i.limit === 0 && i.spent === 0);

  const txByCategory = useMemo(() => {
    const map = {};
    for (const cat of categories.expense) {
      const categoryName = cat.label;
      map[cat.id] = transactions
        .filter(t => t.type === 'expense' && t.category === categoryName && t.date && isInFinancialMonth(t.date, selectedMonth, financialMonthStartDay))
        .sort((a, b) => new Date(b.date) - new Date(a.date));
    }
    return map;
  }, [transactions, categories.expense, selectedMonth, financialMonthStartDay]);

  const getPatrimonyTypeValue = (key) => {
    const items = patrimony[key] || [];
    if (key === 'accounts')   return items.reduce((s, x) => s + computeAccountBalance(x), 0);
    if (key === 'stocks')     return items.reduce((s, x) => {
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

  const handlePatrimonyDelete = (typeKey, id) => {
    if (!confirm('Remover este activo?')) return;
    const updated = { ...patrimony, [typeKey]: (patrimony[typeKey] || []).filter(x => x.id !== id) };
    onPatrimonyChange && onPatrimonyChange(updated);
  };

  // Reset all asset-form search state (called on modal close / submit)
  const clearAssetForms = () => {
    setStockSearchQuery('');
    setStockConfirmed(false);
    setStockApiResults([]);
    setStockApiLoading(false);
    setCryptoSearchQuery('');
    setCryptoConfirmed(false);
  };

  // Select a stock from the local-filter dropdown
  const handleStockSelect = (result) => {
    setPatrimonyField('ticker', result.symbol);
    setPatrimonyField('name',   result.name);
    setStockSearchQuery('');
    setStockConfirmed(true);
  };

  // Select a coin from the local-filter dropdown
  const handleCryptoSelect = (result) => {
    setPatrimonyField('coin', result.symbol);
    setPatrimonyField('name', result.name);
    setCryptoSearchQuery('');
    setCryptoConfirmed(true);
  };

  // Open edit modal pre-filled with an existing asset
  const handlePatrimonyEdit = (typeKey, item) => {
    resetPatrimonyForm(item);
    setPatrimonyFormType(typeKey);
    setEditingAssetId(item.id);
    if (typeKey === 'stocks' && item.ticker) setStockConfirmed(true);
    if (typeKey === 'crypto' && item.coin)   setCryptoConfirmed(true);
    setShowPatrimonyModal(true);
  };

  // Shared add / update handler
  const handlePatrimonySubmit = () => {
    if (!patrimonyFormType) return;
    // Preserve all real fields (incl. live price / lastUpdated); id already in form when editing
    const clean = { ...patrimonyForm };
    if (editingAssetId) {
      // Update existing item in-place
      const updated = {
        ...patrimony,
        [patrimonyFormType]: (patrimony[patrimonyFormType] || []).map(x =>
          x.id === editingAssetId ? { ...clean, id: editingAssetId } : x
        ),
      };
      onPatrimonyChange && onPatrimonyChange(updated);
    } else {
      // Add new item
      const id   = Date.now().toString();
      const item = { id, ...clean };
      const updated = { ...patrimony, [patrimonyFormType]: [...(patrimony[patrimonyFormType] || []), item] };
      onPatrimonyChange && onPatrimonyChange(updated);
    }
    resetPatrimonyForm({});
    setPatrimonyFormType(null);
    setEditingAssetId(null);
    setShowPatrimonyModal(false);
    clearAssetForms();
  };

  // Adaptive price formatting: stocks get 2–4 decimals, crypto gets 2–8
  const fmtStockPrice  = (p) => { const n = parseFloat(p) || 0; return n.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: n < 1 ? 4 : 2 }); };
  const fmtCryptoPrice = (p) => { const n = parseFloat(p) || 0; return n.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: n < 0.001 ? 8 : n < 0.1 ? 6 : n < 1 ? 4 : 2 }); };
  const fmtFiat        = (v) => parseFloat(v || 0).toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const renderPatrimonyItemValue = (typeKey, item) => {
    if (typeKey === 'accounts')   return `${fmtFiat(computeAccountBalance(item))}€`;
    if (typeKey === 'stocks') {
      const price = parseFloat(item.lastPrice ?? item.avgPrice) || null;
      if (!price) return `${item.qty || 0} ações · cotação pendente`;
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
    if (typeKey === 'bonds')      return `${item.series || 'Série'}${item.date ? ' · ' + item.date : ''}`;
    if (typeKey === 'realestate') return item.description;
    if (typeKey === 'vehicles')   return item.description;
    if (typeKey === 'crypto')     return item.coin;
    return '';
  };

  const renderPatrimonyForm = () => {
    console.log('[AssetForm] render', patrimonyFormType);
    const f   = patrimonyForm;
    const set = (k, v) => setPatrimonyField(k, v);
    const cls = 'patrimony-input';

    switch (patrimonyFormType) {

      /* ── Accounts ── */
      case 'accounts':
        return (<>
          <input className={cls} placeholder="Nome da conta"    value={f.name    || ''} onChange={e => set('name',    e.target.value)} />
          <input className={cls} placeholder="Banco (opcional)" value={f.bank    || ''} onChange={e => set('bank',    e.target.value)} />
          <input className={cls} type="number" inputMode="decimal" placeholder="Saldo inicial (€)" value={f.balance || ''} onChange={e => set('balance', e.target.value)} />
        </>);

      /* ── Stocks ──────────────────────────────────────────────────────────── */
      case 'stocks': {
        // Local matches — instant, ranked by relevance (exact > prefix > substring)
        const localMatches = stockSearchQuery.trim().length >= 1
          ? searchAssets(stockSearchQuery.trim(), ['stock', 'etf'])
          : [];
        // API-only results: symbols not already covered by local list
        const apiOnly = stockApiResults.filter(r => !localMatches.some(l => l.symbol === r.symbol));
        // Merged list: local first (faster), then API extras — max 8
        const suggestions = [...localMatches, ...apiOnly].slice(0, 8);
        const showDropdown = stockSearchQuery.trim().length >= 1 && (suggestions.length > 0 || stockApiLoading);

        return (
          <div className="pat-asset-form">
            {!stockConfirmed ? (
              /* Step 1: search */
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
                        {/* type badge: ETF label for local results; exchange for API results */}
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
              /* Step 2: confirmed */
              <>
                <div className="pat-stock-chip">
                  <div className="pat-stock-chip-body">
                    <span className="pat-stock-chip-ticker">{f.ticker}</span>
                    {f.name && <span className="pat-stock-chip-name">{f.name}</span>}
                  </div>
                  <button type="button" className="pat-stock-chip-clear"
                    onClick={() => { set('ticker',''); set('name',''); set('qty',''); set('broker',''); setStockConfirmed(false); }}>×</button>
                </div>
                <input className={cls} type="number" inputMode="decimal"
                  placeholder="Quantidade de ações" value={f.qty || ''}
                  onChange={e => set('qty', e.target.value)} autoFocus />
                <input className={cls}
                  placeholder="Broker — ex: XTB, Degiro (opcional)" value={f.broker || ''}
                  onChange={e => set('broker', e.target.value)} autoComplete="off" />
              </>
            )}
          </div>
        );
      }

      /* ── Bonds ── */
      case 'bonds':
        return (<>
          <input className={cls} placeholder="Série (ex: E)"       value={f.series || ''} onChange={e => set('series', e.target.value)} />
          <input className={cls} type="number" inputMode="decimal" placeholder="Valor actual (€)" value={f.value  || ''} onChange={e => set('value',  e.target.value)} />
          <input className={cls} type="date" value={f.date || ''} onChange={e => set('date', e.target.value)} />
        </>);

      /* ── Real estate ── */
      case 'realestate':
        return (<>
          <input className={cls} placeholder="Descrição (ex: Apartamento Lisboa)" value={f.description || ''} onChange={e => set('description', e.target.value)} />
          <input className={cls} type="number" inputMode="decimal" placeholder="Valor estimado (€)" value={f.value || ''} onChange={e => set('value', e.target.value)} />
        </>);

      /* ── Vehicles ── */
      case 'vehicles':
        return (<>
          <input className={cls} placeholder="Descrição (ex: BMW X3 2020)" value={f.description || ''} onChange={e => set('description', e.target.value)} />
          <input className={cls} type="number" inputMode="decimal" placeholder="Valor estimado (€)" value={f.value || ''} onChange={e => set('value', e.target.value)} />
        </>);

      /* ── Crypto ──────────────────────────────────────────────────────────── */
      case 'crypto': {
        const suggestions = cryptoSearchQuery.trim().length >= 1
          ? searchAssets(cryptoSearchQuery.trim(), ['crypto'])
          : [];

        return (
          <div className="pat-asset-form">
            {!cryptoConfirmed ? (
              /* Step 1: search */
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
              /* Step 2: confirmed */
              <>
                <div className="pat-stock-chip">
                  <div className="pat-stock-chip-body">
                    <span className="pat-stock-chip-ticker">{f.coin}</span>
                    {f.name && <span className="pat-stock-chip-name">{f.name}</span>}
                  </div>
                  <button type="button" className="pat-stock-chip-clear"
                    onClick={() => { set('coin',''); set('name',''); set('qty',''); set('exchange',''); setCryptoConfirmed(false); }}>×</button>
                </div>
                <input className={cls} type="number" inputMode="decimal"
                  placeholder="Quantidade" value={f.qty || ''}
                  onChange={e => set('qty', e.target.value)} autoFocus />
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

  /* ── shared modals — called as {renderModals()}, NOT as <Modals />.
     Defining a component inside a component gives it a new type every render
     → React unmounts+remounts the subtree → inputs lose focus.            */
  const renderModals = () => {
    return (
    <>
      {editingGoalId && (
        <Overlay onClose={() => { setEditingGoalId(null); resetGoal(EMPTY_GOAL); }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h4>Novo Objetivo</h4>
              <button className="modal-close" onClick={() => { setEditingGoalId(null); resetGoal(EMPTY_GOAL); }}>×</button>
            </div>
            <div className="goal-form">
              <input type="text"   className="goal-input" placeholder="Nome do objetivo"
                value={newGoal.name}       onChange={(e) => setGoalField('name',       e.target.value)} />
              <input type="number" className="goal-input" placeholder="Valor (€)"
                value={newGoal.amount || ''} onChange={(e) => setGoalField('amount',     e.target.value)} />
              <div className="date-input-wrapper">
                <input type="date" className="goal-input date-input"
                  value={newGoal.targetDate} onChange={(e) => setGoalField('targetDate', e.target.value)} />
                <span className="calendar-icon">◷</span>
              </div>
              <button className="btn-add-goal" onClick={() => { handleAddGoal(); setEditingGoalId(null); }}>Adicionar</button>
            </div>
          </div>
        </Overlay>
      )}

      {showPatrimonyModal && (() => {
        const f   = patrimonyForm;
        const closeModal = () => {
          setShowPatrimonyModal(false);
          setPatrimonyFormType(null);
          setEditingAssetId(null);
          resetPatrimonyForm({});
          clearAssetForms();
        };
        // Per-type submit guard — only enable when required fields are filled
        const canSubmit = (() => {
          switch (patrimonyFormType) {
            case 'stocks':     return stockConfirmed  && !!f.qty;
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
      })()}

    </>
    );
  };

  /* ── MODERN / FINTECH BRANCH ──────────────────────────────────────────── */
  if (theme === 'modern' || theme === 'fintech') {
    const totalBudget = Object.values(budgets).reduce((s, v) => s + (v || 0), 0);
    const totalSpent  = categories.expense.reduce((s, cat) => s + getSpentByCategory(cat.id), 0);
    const isTotalOver = totalBudget > 0 && totalSpent > totalBudget;

    return (
      <div className="m-budget-page" ref={budgetTabRef}>
        <PageHeader title="Orçamento" />
        {/* View toggle */}
        <div className="m-toggle m-toggle--4">
          <button className={`m-toggle-btn ${activeView === 'budgets'    ? 'active' : ''}`} onClick={() => setActiveView('budgets')}>Orçamento</button>
          <button className={`m-toggle-btn ${activeView === 'recurring'  ? 'active' : ''}`} onClick={() => setActiveView('recurring')}>Recorrentes</button>
          <button className={`m-toggle-btn ${activeView === 'goals'      ? 'active' : ''}`} onClick={() => setActiveView('goals')}>Objetivos</button>
          <button className={`m-toggle-btn ${activeView === 'patrimony'  ? 'active' : ''}`} onClick={() => setActiveView('patrimony')}>Património</button>
        </div>

        {/* Month navigation */}
        {activeView === 'budgets' && (
          <div className="m-month-nav">
            <button className="m-month-nav-btn" onClick={() => setSelectedMonth(shiftFinancialMonth(selectedMonth, -1))}>‹</button>
            <div className="m-month-nav-center">
              <span className="m-month-nav-label">{formatMonthLabel(selectedMonth, financialMonthStartDay)}</span>
              {selectedMonth !== currentMonth && (
                <button className="m-month-nav-today" onClick={() => setSelectedMonth(currentMonth)}>Este mês</button>
              )}
            </div>
            <button className="m-month-nav-btn" onClick={() => setSelectedMonth(shiftFinancialMonth(selectedMonth, 1))}>›</button>
          </div>
        )}

        {/* ── BUDGETS ── */}
        {activeView === 'budgets' && (
          <>
            {/* Main summary card */}
            {(() => {
              const remaining = totalBudget - totalSpent;
              const totalPct  = totalBudget > 0 ? Math.min((totalSpent / totalBudget) * 100, 100) : 0;
              const barColor  = STATUS(totalPct).grad;
              return (
                <div className="m-bmc">
                  <span className="m-bmc-label">
                    {(() => {
                      if (financialMonthStartDay === 1) return 'Orçamento mensal';
                      const { start, end } = getFinancialMonthRange(selectedMonth, financialMonthStartDay);
                      const fmt = (s) => new Date(s + 'T00:00:00').toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' });
                      return `${fmt(start)} → ${fmt(end)}`;
                    })()}
                  </span>
                  <div className="m-bmc-big">
                    <span className="m-bmc-amount" style={{ color: isTotalOver ? '#dc2626' : undefined }}>
                      <CountUp value={totalBudget > 0 ? Math.abs(remaining) : totalSpent} />€
                    </span>
                    <span className="m-bmc-sub">{isTotalOver ? 'excedido' : totalBudget > 0 ? 'disponível' : 'gasto'}</span>
                  </div>
                  <div className="m-bmc-row">
                    <div className="m-bmc-col">
                      <span className="m-bmc-col-val"><CountUp value={totalBudget} />€</span>
                      <span className="m-bmc-col-label">Orçamento</span>
                    </div>
                    <div className="m-bmc-sep" />
                    <div className="m-bmc-col">
                      <span className="m-bmc-col-val" style={{ color: isTotalOver ? '#dc2626' : undefined }}>
                        <CountUp value={totalSpent} />€
                      </span>
                      <span className="m-bmc-col-label">Gasto</span>
                    </div>
                  </div>
                  {totalBudget > 0 && (
                    <div className="m-bmc-bar-bg">
                      <div className="m-bmc-bar-fill" style={{ width: animated ? `${totalPct}%` : '0%', background: barColor, boxShadow: animated ? `0 0 12px ${STATUS(totalPct).glow}` : 'none' }} />
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Recurring committed strip */}
            {recurringPayments.length > 0 && (() => {
              const committed = getTotalMonthlyCommitted(recurringPayments);
              const activeCount = recurringPayments.filter(r => r.active !== false).length;
              return (
                <div className="rp-committed-strip" onClick={() => setActiveView('recurring')}>
                  <span className="rp-committed-ico">↻</span>
                  <div className="rp-committed-body">
                    <div className="rp-committed-label">Comprometido (recorrentes)</div>
                    <div className="rp-committed-val">{committed.toFixed(2)}€ / mês</div>
                  </div>
                  <div className="rp-committed-count">{activeCount} ativos</div>
                </div>
              );
            })()}

            {/* Category grid */}
            <div className="m-gcc-grid">

              {/* Active categories — always visible */}
              {activeItems.map(({ cat, limit, spent, percent, delta, predicted }) => (
                <BudgetCategoryCard
                  key={cat.id}
                  cat={cat}
                  limit={limit}
                  spent={spent}
                  percent={percent}
                  delta={delta}
                  predicted={predicted}
                  animated={animated}
                  isEditing={editingCategoryId === cat.id}
                  onEditToggle={() => setEditingCategoryId(editingCategoryId === cat.id ? null : cat.id)}
                  onLimitChange={handleLimitChange}
                  onSave={() => { saveBudgetToDb(); setEditingCategoryId(null); }}
                  onOpenHistory={() => openCategorySheet(cat.id)}
                />
              ))}

              {/* Inactive categories — collapsed by default */}
              {inactiveItems.length > 0 && (
                <>
                  <div
                    className="m-gcc-inactive-toggle"
                    onClick={() => setShowInactive(v => !v)}
                  >
                    <span className="m-gcc-inactive-label">
                      {showInactive ? '−' : '＋'} {inactiveItems.length} categorias sem atividade
                    </span>
                    <span className={`m-gcc-inactive-chev${showInactive ? ' open' : ''}`}>›</span>
                  </div>

                  {showInactive && inactiveItems.map(({ cat, limit, spent, percent, delta, predicted }) => (
                    <BudgetCategoryCard
                      key={cat.id}
                      cat={cat}
                      limit={limit}
                      spent={spent}
                      percent={percent}
                      delta={delta}
                      predicted={predicted}
                      animated={animated}
                      isEditing={editingCategoryId === cat.id}
                      onEditToggle={() => setEditingCategoryId(editingCategoryId === cat.id ? null : cat.id)}
                      onLimitChange={handleLimitChange}
                      onSave={() => { saveBudgetToDb(); setEditingCategoryId(null); }}
                      onOpenHistory={() => openCategorySheet(cat.id)}
                    />
                  ))}
                </>
              )}

            </div>

            <CategoryHistorySheet
              catId={sheetCategoryId}
              categories={categories}
              txByCategory={txByCategory}
              budgets={budgets}
              sortedItems={sortedItems}
              animated={animated}
              isVisible={sheetVisible}
              onClose={closeCategorySheet}
            />
          </>
        )}

        {/* ── GOALS ── */}
        {activeView === 'goals' && (
          <div className="m-list">
            {goals.length === 0 ? (
              <div className="m-empty">Sem objetivos criados</div>
            ) : (
              goals.map(goal => {
                const progress  = goal.amount > 0 ? Math.min((goal.currentSavings / goal.amount) * 100, 100) : 0;
                const remaining = goal.amount - (goal.currentSavings || 0);
                return (
                  <div key={goal.id} className="m-goal-row">
                    <div className="m-goal-top">
                      <span className="m-goal-name">{goal.name}</span>
                      <button className="m-goal-del" onClick={() => handleDeleteGoal(goal.id)}>🗑</button>
                    </div>
                    <div className="m-goal-bar-bg">
                      <div className="m-goal-bar-fill" style={{ width: `${progress}%` }} />
                    </div>
                    <div className="m-goal-meta">
                      <span><strong>{(goal.currentSavings || 0).toFixed(0)}€</strong> / {goal.amount.toFixed(0)}€</span>
                      <span>{progress.toFixed(0)}%{remaining > 0 ? ` · faltam ${remaining.toFixed(0)}€` : ' ✓'}</span>
                    </div>
                    <div className="m-goal-input-row">
                      <span className="m-goal-input-label">Poupado</span>
                      <GoalSavingsInput
                        key={goal.id}
                        goal={goal}
                        onSave={handleUpdateGoalSavings}
                        className="m-goal-savings-input"
                      />
                      <span className="m-budget-unit">€</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ── RECURRING PAYMENTS ── */}
        {activeView === 'recurring' && (
          <RecurringView
            user={user}
            recurringPayments={recurringPayments}
            onRecurringPaymentsChange={onRecurringPaymentsChange}
            confirmedRecurring={confirmedRecurring}
            onConfirmRecurring={onConfirmRecurring}
            categories={categories}
            patrimony={externalPatrimony}
          />
        )}

        {/* ── PATRIMONY ── */}
        {activeView === 'patrimony' && (() => {
          // toNum guards against NaN reaching toLocaleString (would render "NaN" on screen)
          const fmt = (v) => toNum(v).toLocaleString('pt-PT', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
          const typeValues = PATRIMONY_TYPES.map(t => ({ ...t, value: getPatrimonyTypeValue(t.key) }));

          // Allocation percentages for insight + bars
          const pctOf = (key) => totalPatrimony > 0 ? getPatrimonyTypeValue(key) / totalPatrimony : 0;
          const insightMsg =
            totalPatrimony === 0     ? 'Adiciona os teus ativos para começar a acompanhar o teu património.' :
            pctOf('accounts') > 0.6  ? 'Grande parte do património está em liquidez. Considera diversificar.' :
            pctOf('realestate') > 0.6? 'Património concentrado em imóveis — ativo ilíquido mas estável.' :
            pctOf('crypto') > 0.25   ? 'Exposição significativa a criptoativos. Alto risco, alto potencial.' :
            pctOf('stocks') > 0.4    ? 'Portfólio com forte componente em ações. Boa diversificação de crescimento.' :
                                       'Portfólio distribuído por múltiplos tipos de ativos.';

          // ── Asset alerts (|change| ≥ 5%) ──────────────────────────────────
          // Prefer livePrices change data; normCoin handles legacy "BTC/USD" storage
          const assetAlerts = [
            ...(patrimony.stocks ?? [])
              .map(s => ({ sym: s.ticker, pct: livePrices[s.ticker]?.changePct  ?? (s.changePct  != null ? parseFloat(s.changePct)  : null), label: 'hoje' }))
              .filter(x => x.pct != null && Math.abs(x.pct) >= 5),
            ...(patrimony.crypto ?? [])
              .map(c => ({ sym: normCoin(c.coin), pct: livePrices[normCoin(c.coin)]?.changePct24h ?? (c.change24h != null ? parseFloat(c.change24h) : null), label: '24h' }))
              .filter(x => x.pct != null && Math.abs(x.pct) >= 5),
          ];

          // ── Impact bar scale: normalize by largest single-asset impact ────
          const allLiveVals = [
            ...(patrimony.stocks ?? []).map(s =>
              toNum(livePrices[s.ticker]?.price      ?? s.lastPrice ?? s.avgPrice) * toNum(s.qty)),
            ...(patrimony.crypto ?? []).map(c =>
              toNum(livePrices[normCoin(c.coin)]?.price ?? c.lastPrice ?? c.price) * toNum(c.qty)),
          ];
          const maxSingleImpact = totalPatrimony > 0
            ? Math.max(...allLiveVals.map(v => (v / totalPatrimony) * 100), 0.01)
            : 0.01;

          // ── Wealth Intelligence ─────────────────────────────────────────────
          // Derive monthly net savings from transactions (no snapshot history needed)
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
          const maxAbs = Math.max(...monthlySavings.map(Math.abs), 1);

          // ── Asset card renderer — shared by stocks + crypto ──────────────
          const assetCardFor = (item, assetKey) => {
            const isStock      = assetKey === 'stocks';
            // normCoin: "BTC/USD" (legacy) and "BTC" (new) both resolve to "BTC"
            const sym          = isStock ? item.ticker : normCoin(item.coin);
            const isRefreshing = refreshingTickers.has(sym);

            // livePrices (in-session fetches) take precedence over persisted item values
            const live        = livePrices[sym];
            const marketPrice = toNum(live?.price ?? (isStock
              ? (item.lastPrice ?? item.avgPrice)
              : (item.lastPrice ?? item.price)));
            const marketVal   = toNum(item.qty) * marketPrice;
            const age         = formatAge(live?.lastUpdated ?? item.lastUpdated);
            // changePct: prefer live data; treat NaN as "no data" (null → badge hidden)
            const _rawChg     = live
              ? (isStock ? live.changePct : live.changePct24h)
              : (isStock ? item.changePct : item.change24h);
            const chg         = _rawChg != null && Number.isFinite(Number(_rawChg))
              ? Number(_rawChg)
              : null;
            // hasPrice: marketPrice is always finite (toNum), so just check > 0
            const hasPrice    = marketPrice > 0;
            const sparkPrices  = assetHistory[sym];
            const sparkUp      = sparkPrices?.length >= 2
              ? sparkPrices[sparkPrices.length - 1] >= sparkPrices[0]
              : chg != null ? chg >= 0 : null;
            const sparkColor   = sparkUp === true ? '#22c55e' : sparkUp === false ? '#ef4444' : '#6b7280';
            const impact       = totalPatrimony > 0 ? (marketVal / totalPatrimony) * 100 : 0;
            const barWidth     = maxSingleImpact > 0 ? Math.min((impact / maxSingleImpact) * 100, 100) : 0;
            const qty          = parseFloat(item.qty) || 0;
            const qtyLabel     = isStock ? 'ações' : 'moedas';
            const priceLabel   = isStock ? 'ação'  : 'moeda';
            return (
              <SwipeRevealCard
                key={item.id}
                className="pat-asset-card"
                onEdit={() => handlePatrimonyEdit(assetKey, item)}
                onDelete={() => handlePatrimonyDelete(assetKey, item.id)}
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
              </SwipeRevealCard>
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
                  {/* Forecast card */}
                  <div className="pat-intel-forecast" style={avg6 >= 0
                    ? { borderColor: 'rgba(74,222,128,0.18)', boxShadow: '0 4px 20px rgba(74,222,128,0.08)' }
                    : { borderColor: 'rgba(248,113,113,0.18)', boxShadow: '0 4px 20px rgba(248,113,113,0.08)' }}>
                    <div className="pat-intel-forecast-label">Previsão em 12 meses</div>
                    <div className="pat-intel-forecast-amount" style={{ color: avg6 >= 0 ? '#4ade80' : '#f87171' }}>
                      {fmt(Math.round(forecast12))}<span style={{ fontSize: '1.1rem', opacity: 0.65, marginLeft: 2 }}>€</span>
                    </div>
                    <div className="pat-intel-forecast-sub">
                      {avg6 >= 0
                        ? `+${fmt(Math.round(avg6 * 12))}€ ao ritmo atual de poupança`
                        : `−${fmt(Math.round(Math.abs(avg6 * 12)))}€ — gastos superiores ao rendimento`}
                    </div>
                  </div>

                  {/* Growth chips */}
                  <div className="pat-intel-chips">
                    <div className="pat-intel-chip">
                      <span className="pat-intel-chip-val" style={{ color: avg6 >= 0 ? '#4ade80' : '#f87171' }}>
                        {avg6 >= 0 ? '+' : ''}{fmt(Math.round(avg6))}€
                      </span>
                      <span className="pat-intel-chip-label">poupança / mês</span>
                    </div>
                    <div className="pat-intel-chip">
                      <span className="pat-intel-chip-val" style={{ color: monthlyRate >= 0 ? '#4ade80' : '#f87171' }}>
                        {monthlyRate >= 0 ? '+' : ''}{monthlyRate.toFixed(2)}%
                      </span>
                      <span className="pat-intel-chip-label">crescimento / mês</span>
                    </div>
                  </div>

                  {/* Trend comparison */}
                  <div className="pat-intel-trend">
                    <span className="pat-intel-trend-dot" style={{
                      background: trendStatus === 'above' ? '#4ade80' : trendStatus === 'below' ? '#f87171' : '#71717a'
                    }} />
                    <span className="pat-intel-trend-msg">
                      {trendStatus === 'above'
                        ? `Acima do teu padrão habitual · +${fmt(Math.round(trendDiff))}€/mês vs últimos 6m`
                        : trendStatus === 'below'
                        ? `Abaixo do teu ritmo habitual · ${fmt(Math.round(trendDiff))}€/mês vs últimos 6m`
                        : 'Poupança estável nos últimos meses'}
                    </span>
                  </div>

                  {/* Sparkline — last 6 months net savings */}
                  <div className="pat-intel-chart">
                    <span className="pat-intel-chart-title">Poupança mensal</span>
                    <div className="pat-intel-bars">
                      {monthlySavings.map((v, i) => {
                        const h = Math.max((Math.abs(v) / maxAbs) * 40, 3);
                        return (
                          <div key={i} className="pat-intel-bar-col">
                            <div className="pat-intel-bar-wrap">
                              <div className="pat-intel-bar" style={{
                                height: h,
                                background: v >= 0 ? '#4ade80' : '#f87171',
                                boxShadow: v >= 0 ? '0 0 6px rgba(74,222,128,0.4)' : '0 0 6px rgba(248,113,113,0.4)',
                              }} />
                            </div>
                            <span className="pat-intel-bar-label">{last6Months[i].slice(5)}</span>
                          </div>
                        );
                      })}
                    </div>
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
                          {key === 'accounts' ? sorted.map(item => {
                            /* ── Account card with live balance + Principal badge ── */
                            const currentBal = computeAccountBalance(item);
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
                            /* ── Crypto: group by exchange ── */
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
                            /* ── Stocks: asset card ── */
                            if (key === 'stocks') return assetCardFor(item, 'stocks');
                            /* ── Generic row for all other asset types ── */
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
            </>
          );
        })()}

        {/* FAB */}
        {(activeView === 'goals' || activeView === 'patrimony') && (
          <button
            className="m-fab"
            onClick={() => { if (activeView === 'goals') setEditingGoalId('new'); else setShowPatrimonyModal(true); }}
          >+</button>
        )}

        {renderModals()}
      </div>
    );
  }

  /* ── DEFAULT BRANCH ──────────────────────────────────────────────────── */
  return (
    <div className="budget-tab" ref={budgetTabRef}>
      <PageHeader title="Orçamento" subtitle="Gestão financeira" />

      <div className="view-toggle view-toggle-3">
        <button className={`toggle-btn ${activeView === 'budgets' ? 'active' : ''}`} onClick={() => setActiveView('budgets')}>
          <span className="sf-icon">◈</span><span>Orçamentos</span>
        </button>
        <button className={`toggle-btn ${activeView === 'goals' ? 'active' : ''}`} onClick={() => setActiveView('goals')}>
          <span className="sf-icon">◆</span><span>Objetivos</span>
        </button>
        <button className={`toggle-btn ${activeView === 'patrimony' ? 'active' : ''}`} onClick={() => setActiveView('patrimony')}>
          <span className="sf-icon">◭</span><span>Património</span>
        </button>
      </div>

      {activeView === 'budgets' && (
        <div className="budgets-section">
          <h3>
            {financialMonthStartDay === 1 ? 'Limites Mensais' : (() => {
              const { start, end } = getFinancialMonthRange(selectedMonth, financialMonthStartDay);
              const fmt = (s) => new Date(s + 'T00:00:00').toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' });
              return `${fmt(start)} → ${fmt(end)}`;
            })()}
          </h3>
          {(() => {
            const totalBudget = Object.values(budgets).reduce((sum, val) => sum + (val || 0), 0);
            const totalSpent = categories.expense.reduce((sum, cat) => sum + getSpentByCategory(cat.id), 0);
            const totalPercentage = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;
            return (
              <div className="budget-total-card">
                <div className="total-row"><span className="total-label">Orçamento Total</span><span className="total-amount">{totalBudget.toFixed(2)}€</span></div>
                <div className="total-row"><span className="total-label">Gasto Total</span><span className={`total-amount ${totalSpent > totalBudget ? 'over' : ''}`}>{totalSpent.toFixed(2)}€</span></div>
                <div className="total-progress-bar"><div className={`total-progress-fill ${totalSpent > totalBudget ? 'over' : ''}`} style={{ width: `${Math.min(totalPercentage, 100)}%` }} /></div>
                <div className="total-percentage">{totalPercentage.toFixed(0)}% utilizado</div>
              </div>
            );
          })()}
          <div className="categories-budgets">
            {categories.expense
              .map(cat => {
                const limit = budgets[cat.id] || 0;
                const spent = getSpentByCategory(cat.id);
                const hasLimit = limit > 0;
                const percent = hasLimit ? (spent / limit) * 100 : 0;
                const barWidth = Math.min(percent, 100);
                const colorClass = percent > 100 ? 'over' : percent >= 70 ? 'warn' : '';
                return { cat, limit, spent, hasLimit, percent, barWidth, colorClass };
              })
              .sort((a, b) => b.percent - a.percent)
              .map(({ cat, limit, spent, hasLimit, percent, barWidth, colorClass }) => (
                <div key={cat.id} className="budget-category">
                  <div className="category-header">
                    {(() => { const { Icon: CI, color: cc } = getCategoryMeta(cat.label); return <div className="category-icon-bubble" style={{ background: `${cc}22` }}><CI size={14} color={cc} strokeWidth={2} /></div>; })()}
                    <span className="category-name">{cat.label}</span>
                    {percent >= 100 && <span className="budget-alert over">Excedido</span>}
                    {percent >= 80 && percent < 100 && <span className="budget-alert warn">Atenção</span>}
                  </div>
                  <div className="budget-input-row">
                    <input type="number" inputMode="decimal" className="budget-input" value={limit || ''} onChange={(e) => handleLimitChange(cat.id, e.target.value)} onKeyPress={(e) => { if (e.key === 'Enter') { saveBudgetToDb(); e.target.blur(); } }} placeholder="0" step="10" min="0" />
                    <span className="budget-currency">{financialMonthStartDay === 1 ? '€/mês' : '€/per.'}</span>
                    <button className="budget-save-btn" onClick={saveBudgetToDb} title="Guardar">✓</button>
                  </div>
                  {hasLimit && (
                    <div className="budget-progress-container">
                      <div className="budget-bar"><div className={`budget-fill ${colorClass}`} style={{ width: `${barWidth}%` }} /></div>
                      <div className="budget-stats">
                        <span className={`spent ${colorClass}`}>{spent.toFixed(2)}€</span>
                        <span className="separator">/</span>
                        <span className="limit">{limit.toFixed(2)}€</span>
                        <span className={`percentage ${colorClass}`}>({percent.toFixed(0)}%)</span>
                      </div>
                    </div>
                  )}
                </div>
              ))
            }
          </div>
        </div>
      )}

      {activeView === 'goals' && (
        <div className="goals-section">
          <h3>Meus Objetivos</h3>
          {goals.length === 0 ? (
            <div className="empty-state"><span className="sf-icon-large">◆</span><p>Sem objetivos criados</p></div>
          ) : (
            <div className="goals-list">
              {goals.map(goal => {
                const progress = goal.amount > 0 ? (goal.currentSavings / goal.amount) * 100 : 0;
                const remaining = goal.amount - goal.currentSavings;
                let daysRemaining = null;
                if (goal.targetDate) {
                  daysRemaining = Math.ceil((new Date(goal.targetDate) - new Date()) / (1000 * 60 * 60 * 24));
                }
                return (
                  <div key={goal.id} className="goal-card">
                    <div className="goal-header-row">
                      <h4>{goal.name}</h4>
                      <button className="btn-delete-goal" onClick={() => handleDeleteGoal(goal.id)} title="Apagar">🗑️</button>
                    </div>
                    <div className="goal-meta">
                      <div className="meta-item"><span className="meta-label">Meta</span><span className="meta-value">{goal.amount.toFixed(0)}€</span></div>
                      {goal.targetDate && (
                        <div className="meta-item"><span className="meta-label">Data</span><span className="meta-value">{new Date(goal.targetDate).toLocaleDateString('pt-PT', { day: 'numeric', month: 'short', year: 'numeric' })}</span></div>
                      )}
                    </div>
                    <div className="goal-progress">
                      <div className="progress-bar-container"><div className="progress-bar-fill" style={{ width: `${Math.min(progress, 100)}%` }} /></div>
                      <div className="progress-text"><span>{goal.currentSavings.toFixed(0)}€</span><span className="progress-percent">{progress.toFixed(0)}%</span></div>
                    </div>
                    {daysRemaining !== null && daysRemaining > 0 && (
                      <div className="goal-days"><span className="sf-icon">☀︎</span><span>{daysRemaining} dias restantes</span></div>
                    )}
                    <div className="savings-input-row">
                      <label>Poupado</label>
                      <div className="input-group">
                        <GoalSavingsInput
                          key={goal.id}
                          goal={goal}
                          onSave={handleUpdateGoalSavings}
                        />
                        <span>€</span>
                      </div>
                    </div>
                    {remaining > 0 && <div className="goal-remaining">Faltam <strong>{remaining.toFixed(0)}€</strong></div>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeView === 'patrimony' && (
        <div className="patrimony-section">
          <div className="patrimony-total-card">
            <div className="patrimony-total-label">Património Total</div>
            <div className="patrimony-total-amount">{(totalPatrimony || 0).toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€</div>
          </div>
          <div className="patrimony-types-list">
            {PATRIMONY_TYPES.map(({ key, label, Icon: PatIcon, color }) => {
              const items = patrimony[key] || [];
              const typeTotal = getPatrimonyTypeValue(key);
              return (
                <div key={key} className="patrimony-type-card">
                  <div className="patrimony-type-header">
                    <div className="patrimony-type-left">
                      <span className="patrimony-type-icon" style={{ color }}><PatIcon size={16} color={color} strokeWidth={2} /></span>
                      <span className="patrimony-type-label">{label}</span>
                    </div>
                    <span className="patrimony-type-total">{typeTotal.toFixed(2)}€</span>
                  </div>
                  {items.length > 0 && (
                    <div className="patrimony-items-list">
                      {items.map(item => (
                        <div key={item.id} className="patrimony-item">
                          <div className="patrimony-item-info">
                            <span className="patrimony-item-name">{renderPatrimonyItemLabel(key, item)}</span>
                            <span className="patrimony-item-value">{renderPatrimonyItemValue(key, item)}</span>
                          </div>
                          <button className="patrimony-item-delete" onClick={() => handlePatrimonyDelete(key, item.id)}>×</button>
                        </div>
                      ))}
                    </div>
                  )}
                  {items.length === 0 && <div className="patrimony-empty-type">Sem registos</div>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {(activeView === 'goals' || activeView === 'patrimony') && (
        <button
          className="floating-add-btn"
          onClick={() => { if (activeView === 'goals') setEditingGoalId('new'); else setShowPatrimonyModal(true); }}
          title="Adicionar"
        >
          +
        </button>
      )}

      {renderModals()}
    </div>
  );
};

export default BudgetTab;
