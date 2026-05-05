import React, { useState, useEffect, useRef, useMemo } from 'react';
import { dbService } from '../../lib/supabase';
import Overlay from '../Overlay';
import { useForm } from '../../hooks/useForm';
import { Card, Bubble } from '../ui';
import { shiftMonth, formatMonthLabel, getPrediction } from '../../utils/insights';
import { fetchStockQuote, fetchCryptoTwelveData, fetchStockHistory, fetchCryptoHistoryBatch, fetchStockSearch, getPrice, isStale, formatAge, HAS_STOCK_KEY, CACHE_TTL, HISTORY_TTL } from '../../utils/assetPrice';

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
import './BudgetTab.css';

const CATEGORY_ICONS = {
  'Alimentação':'⚑','Habitação':'⌂','Transporte':'⚐','Saúde':'✚','Lazer':'◉',
  'Educação':'⊞','Roupa':'◫','Tecnologia':'◧','Subscrições':'◉','Outros':'◌'
};

const PATRIMONY_TYPES = [
  { key: 'accounts',   label: 'Contas Bancárias', icon: '◈', color: '#D97706' },
  { key: 'stocks',     label: 'Ações',             icon: '◭', color: '#059669' },
  { key: 'bonds',      label: 'Cert. Aforro',      icon: '◆', color: '#7C3AED' },
  { key: 'realestate', label: 'Imóveis',            icon: '⌂', color: '#DC2626' },
  { key: 'vehicles',   label: 'Veículos',           icon: '⚐', color: '#0891B2' },
  { key: 'crypto',     label: 'Crypto',             icon: '◉', color: '#F59E0B' },
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

const CAT_COLORS = {
  'Alimentação':'#F59E0B','Habitação':'#3B82F6','Transporte':'#8B5CF6',
  'Saúde':'#10B981','Lazer':'#EC4899','Educação':'#06B6D4',
  'Roupa':'#F97316','Tecnologia':'#6366F1','Subscrições':'#84CC16','Outros':'#6B7280',
};

const getCategoryIcon = (category) => {
  const label = typeof category === 'string' ? category : category?.label;
  return CATEGORY_ICONS[label] || '◌';
};

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

const BudgetCategoryCard = ({ cat, limit, spent, percent, delta, predicted, animated, isEditing, onEditToggle, onLimitChange, onSave }) => {
  const [hovered, setHovered] = useState(false);
  const catColor   = CAT_COLORS[cat.label] || '#6B7280';
  const st         = STATUS(percent);
  const willExceed = predicted !== null && limit > 0 && predicted > limit;

  return (
    <div
      className="m-bcc"
      style={hovered ? { transform: 'scale(1.02)', boxShadow: `0 6px 24px ${st.glow}` } : undefined}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* top row */}
      <div className="m-bcc-row">
        <Bubble color={catColor} icon={getCategoryIcon(cat.label)} size={40} radius="12px" />
        <div className="m-bcc-info">
          <div className="m-bcc-name-row">
            <span className="m-bcc-name">{cat.label}</span>
            {limit > 0 && (
              <span className="m-bcc-badge" style={{ color: st.color, background: st.glow }}>
                {st.label}
              </span>
            )}
          </div>
          <div className="m-bcc-meta-row">
            <span className="m-bcc-spent" style={limit > 0 && percent >= 70 ? { color: st.color } : {}}>
              {spent.toFixed(0)}€{limit > 0 ? ` / ${limit.toFixed(0)}€` : ''}
            </span>
            {delta > 0.5  && <span className="m-bcc-delta up">↑ +{delta.toFixed(0)}€</span>}
            {delta < -0.5 && <span className="m-bcc-delta down">↓ −{Math.abs(delta).toFixed(0)}€</span>}
          </div>
        </div>
        {/* percentage + edit button */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2, marginLeft: 6, flexShrink: 0 }}>
          {limit > 0 && (
            <span style={{ fontSize: '1rem', fontWeight: 700, color: st.color, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
              {percent.toFixed(0)}%
            </span>
          )}
          {/* ✎ (U+270E) renders reliably on Android system fonts */}
          <button className="m-bcc-edit" onClick={onEditToggle} aria-label="Editar limite">✎</button>
        </div>
      </div>

      {/* inline limit editor */}
      {isEditing && (
        <div className="m-bcc-edit-row">
          <input
            type="number"
            inputMode="decimal"
            className="m-bcc-input"
            value={limit || ''}
            onChange={(e) => onLimitChange(cat.id, e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { onSave(); e.target.blur(); } }}
            onBlur={onSave}
            placeholder="Limite €/mês"
            autoFocus
          />
          <button className="m-bcc-save" onClick={onSave}>✓</button>
        </div>
      )}

      {/* gradient progress bar */}
      {limit > 0 && (
        <div className="m-bcc-bar-bg">
          <div
            className="m-bcc-bar-fill"
            style={{
              width:      animated ? `${Math.min(percent, 100)}%` : '0%',
              background: st.grad,
              boxShadow:  animated ? `0 0 10px ${st.glow}` : 'none',
            }}
          />
        </div>
      )}

      {/* end-of-month prediction */}
      {predicted !== null && limit > 0 && (
        <div className={`m-bcc-prediction${willExceed ? ' exceed' : ''}`}>
          <span>Previsto: {predicted}€</span>
          {willExceed && <span className="m-bcc-prediction-warn">Vai ultrapassar</span>}
        </div>
      )}
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

/* ─── Internal stock list (no API needed) ───────────────────────────────────
   ~50 popular stocks + UCITS ETFs. Filtered locally while the user types.   */
const STOCK_LIST = [
  // US mega-cap
  { symbol: 'AAPL',  name: 'Apple Inc.' },
  { symbol: 'MSFT',  name: 'Microsoft Corporation' },
  { symbol: 'GOOGL', name: 'Alphabet Inc.' },
  { symbol: 'AMZN',  name: 'Amazon.com Inc.' },
  { symbol: 'NVDA',  name: 'NVIDIA Corporation' },
  { symbol: 'META',  name: 'Meta Platforms Inc.' },
  { symbol: 'TSLA',  name: 'Tesla Inc.' },
  { symbol: 'BRK/B', name: 'Berkshire Hathaway B' },
  { symbol: 'JPM',   name: 'JPMorgan Chase & Co.' },
  { symbol: 'V',     name: 'Visa Inc.' },
  { symbol: 'MA',    name: 'Mastercard Inc.' },
  { symbol: 'UNH',   name: 'UnitedHealth Group' },
  { symbol: 'JNJ',   name: 'Johnson & Johnson' },
  { symbol: 'XOM',   name: 'Exxon Mobil Corp.' },
  { symbol: 'PG',    name: 'Procter & Gamble Co.' },
  { symbol: 'HD',    name: 'Home Depot Inc.' },
  { symbol: 'COST',  name: 'Costco Wholesale Corp.' },
  { symbol: 'ADBE',  name: 'Adobe Inc.' },
  { symbol: 'CRM',   name: 'Salesforce Inc.' },
  { symbol: 'NFLX',  name: 'Netflix Inc.' },
  { symbol: 'AMD',   name: 'Advanced Micro Devices' },
  { symbol: 'INTC',  name: 'Intel Corporation' },
  { symbol: 'DIS',   name: 'Walt Disney Co.' },
  { symbol: 'PYPL',  name: 'PayPal Holdings Inc.' },
  { symbol: 'COIN',  name: 'Coinbase Global Inc.' },
  // European
  { symbol: 'ASML',  name: 'ASML Holding N.V.' },
  { symbol: 'SAP',   name: 'SAP SE' },
  { symbol: 'NVO',   name: 'Novo Nordisk A/S' },
  { symbol: 'EDP',   name: 'EDP — Energias de Portugal' },
  { symbol: 'GALP',  name: 'Galp Energia SGPS' },
  { symbol: 'BCP',   name: 'Millennium BCP' },
  { symbol: 'JMT',   name: 'Jerónimo Martins SGPS' },
  { symbol: 'SON',   name: 'Sonae SGPS' },
  { symbol: 'NOS',   name: 'NOS SGPS' },
  { symbol: 'EGL',   name: 'Greenvolt — Energias Renováveis' },
  // US ETFs
  { symbol: 'SPY',   name: 'S&P 500 ETF (SPDR)' },
  { symbol: 'QQQ',   name: 'Nasdaq-100 ETF (Invesco)' },
  { symbol: 'VOO',   name: 'Vanguard S&P 500 ETF' },
  { symbol: 'VTI',   name: 'Vanguard Total Market ETF' },
  { symbol: 'GLD',   name: 'SPDR Gold Shares ETF' },
  { symbol: 'TLT',   name: 'iShares 20+ Year Treasury ETF' },
  { symbol: 'VGT',   name: 'Vanguard Info Technology ETF' },
  { symbol: 'ARKK',  name: 'ARK Innovation ETF' },
  // UCITS ETFs (popular in PT/EU)
  { symbol: 'VWCE',  name: 'Vanguard FTSE All-World UCITS ETF' },
  { symbol: 'IWDA',  name: 'iShares Core MSCI World UCITS ETF' },
  { symbol: 'CSPX',  name: 'iShares Core S&P 500 UCITS ETF' },
  { symbol: 'VUSA',  name: 'Vanguard S&P 500 UCITS ETF' },
  { symbol: 'XDWD',  name: 'Xtrackers MSCI World Swap UCITS ETF' },
  { symbol: 'SXR8',  name: 'iShares Core S&P 500 (Acc) EUR' },
  { symbol: 'EUNL',  name: 'iShares Core MSCI World UCITS (EUR)' },
  { symbol: 'EXSA',  name: 'iShares Core EURO STOXX 50 UCITS ETF' },
];

/* ─── Internal crypto list (no API needed) ──────────────────────────────────
   ~50 popular coins. Filtered locally while the user types.                  */
const CRYPTO_LIST = [
  // Layer 1
  { symbol: 'BTC',    name: 'Bitcoin' },
  { symbol: 'ETH',    name: 'Ethereum' },
  { symbol: 'BNB',    name: 'BNB (Binance)' },
  { symbol: 'SOL',    name: 'Solana' },
  { symbol: 'ADA',    name: 'Cardano' },
  { symbol: 'AVAX',   name: 'Avalanche' },
  { symbol: 'DOT',    name: 'Polkadot' },
  { symbol: 'NEAR',   name: 'NEAR Protocol' },
  { symbol: 'ICP',    name: 'Internet Computer' },
  { symbol: 'APT',    name: 'Aptos' },
  { symbol: 'SUI',    name: 'Sui' },
  { symbol: 'ALGO',   name: 'Algorand' },
  { symbol: 'VET',    name: 'VeChain' },
  { symbol: 'TRX',    name: 'TRON' },
  { symbol: 'TON',    name: 'Toncoin' },
  { symbol: 'XLM',    name: 'Stellar' },
  { symbol: 'XRP',    name: 'XRP (Ripple)' },
  { symbol: 'LTC',    name: 'Litecoin' },
  { symbol: 'BCH',    name: 'Bitcoin Cash' },
  { symbol: 'ETC',    name: 'Ethereum Classic' },
  { symbol: 'XMR',    name: 'Monero' },
  // Layer 2 & DeFi
  { symbol: 'MATIC',  name: 'Polygon' },
  { symbol: 'OP',     name: 'Optimism' },
  { symbol: 'ARB',    name: 'Arbitrum' },
  { symbol: 'LINK',   name: 'Chainlink' },
  { symbol: 'UNI',    name: 'Uniswap' },
  { symbol: 'AAVE',   name: 'Aave' },
  { symbol: 'MKR',    name: 'Maker' },
  { symbol: 'CRV',    name: 'Curve DAO' },
  { symbol: 'SNX',    name: 'Synthetix' },
  { symbol: 'LDO',    name: 'Lido DAO' },
  { symbol: 'RUNE',   name: 'THORChain' },
  { symbol: 'GRT',    name: 'The Graph' },
  { symbol: 'JUP',    name: 'Jupiter' },
  { symbol: 'ATOM',   name: 'Cosmos' },
  // AI / Infra
  { symbol: 'RNDR',   name: 'Render Network' },
  { symbol: 'FET',    name: 'Fetch.ai' },
  { symbol: 'INJ',    name: 'Injective' },
  { symbol: 'FIL',    name: 'Filecoin' },
  // Meme & culture
  { symbol: 'DOGE',   name: 'Dogecoin' },
  { symbol: 'SHIB',   name: 'Shiba Inu' },
  { symbol: 'PEPE',   name: 'Pepe' },
  { symbol: 'WIF',    name: 'Dogwifhat' },
  { symbol: 'BONK',   name: 'Bonk' },
  // Gaming / Metaverse
  { symbol: 'SAND',   name: 'The Sandbox' },
  { symbol: 'MANA',   name: 'Decentraland' },
  { symbol: 'APE',    name: 'ApeCoin' },
];

const BudgetTab = ({ user, transactions, currentMonth, categories, budgets: externalBudgets = {}, onBudgetsChange, patrimony: externalPatrimony, onPatrimonyChange, theme = 'default' }) => {
  // ── useForm-backed drafts (onChange → local only; save on blur / button) ──
  const { draft: budgets, setField: setBudgetField, reset: resetBudgets, save: saveBudgetsForm } = useForm(externalBudgets);
  const { draft: newGoal,      setField: setGoalField,      reset: resetGoal                               } = useForm(EMPTY_GOAL);
  const { draft: patrimonyForm, setField: setPatrimonyField, reset: resetPatrimonyForm                     } = useForm({});

  const [activeView,          setActiveView]          = useState('budgets');
  const [goals,               setGoals]               = useState([]);
  const [editingGoalId,       setEditingGoalId]       = useState(null);
  const [showPatrimonyModal,  setShowPatrimonyModal]  = useState(false);
  const [patrimonyFormType,   setPatrimonyFormType]   = useState(null);
  const [editingCategoryId,   setEditingCategoryId]   = useState(null);
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
      setRefreshingTickers(new Set([
        ...staleStocks.map(s => s.ticker),
        ...staleCoins.map(c => c.coin),
      ]));

      // Fetch stocks + crypto in parallel
      // Crypto: Twelve Data BTC/USD when key present, CoinGecko fallback otherwise
      const [stockResults, cryptoPrices] = await Promise.all([
        Promise.allSettled(staleStocks.map(s => fetchStockQuote(s.ticker))),
        fetchCryptoTwelveData(staleCoins.map(c => c.coin)),
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

      staleCoins.forEach(c => {
        const data = cryptoPrices[c.coin];
        if (data?.price != null) {
          priceUpdates[c.coin] = {
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
        const p = priceUpdates[c.coin];
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
        fetchCryptoHistoryBatch(cryptos.map(c => c.coin)),
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
      .filter(t => t.type === 'expense' && t.category === categoryName && t.date && t.date.startsWith(month))
      .reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);
  };

  const getSpentByCategory = (categoryId) => getSpentForMonth(categoryId, selectedMonth);

  const sortedItems = useMemo(() => {
    const prevMonth = shiftMonth(selectedMonth, -1);
    return categories.expense
      .map(cat => {
        const limit     = budgets[cat.id] || 0;
        const spent     = getSpentForMonth(cat.id, selectedMonth);
        const prevSpent = getSpentForMonth(cat.id, prevMonth);
        const percent   = limit > 0 ? (spent / limit) * 100 : 0;
        const delta     = spent - prevSpent;
        const predicted = getPrediction(spent, selectedMonth);
        return { cat, limit, spent, percent, delta, predicted };
      })
      .sort((a, b) => b.percent - a.percent);
  }, [categories.expense, budgets, transactions, selectedMonth]);

  const getPatrimonyTypeValue = (key) => {
    const items = patrimony[key] || [];
    if (key === 'accounts')   return items.reduce((s, x) => s + toNum(x.balance), 0);
    if (key === 'stocks')     return items.reduce((s, x) => {
      const price = toNum(livePrices[x.ticker]?.price ?? x.lastPrice ?? x.avgPrice);
      return s + toNum(x.qty) * price;
    }, 0);
    if (key === 'bonds')      return items.reduce((s, x) => s + toNum(x.value), 0);
    if (key === 'realestate') return items.reduce((s, x) => s + toNum(x.value), 0);
    if (key === 'vehicles')   return items.reduce((s, x) => s + toNum(x.value), 0);
    if (key === 'crypto')     return items.reduce((s, x) => {
      const price = toNum(livePrices[x.coin]?.price ?? x.lastPrice ?? x.price);
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

  const renderPatrimonyItemValue = (typeKey, item) => {
    if (typeKey === 'accounts')   return `${parseFloat(item.balance || 0).toFixed(2)}€`;
    if (typeKey === 'stocks') {
      const price = parseFloat(item.lastPrice ?? item.avgPrice) || null;
      if (!price) return `${item.qty || 0} ações · cotação pendente`;
      const total = (parseFloat(item.qty) || 0) * price;
      return `${item.qty}×${price.toFixed(2)}€ = ${total.toFixed(2)}€`;
    }
    if (typeKey === 'bonds')      return `${parseFloat(item.value || 0).toFixed(2)}€`;
    if (typeKey === 'realestate') return `${parseFloat(item.value || 0).toFixed(2)}€`;
    if (typeKey === 'vehicles')   return `${parseFloat(item.value || 0).toFixed(2)}€`;
    if (typeKey === 'crypto') {
      const price = parseFloat(item.lastPrice ?? item.price) || null;
      if (!price) return `${item.qty || 0} moedas · cotação pendente`;
      return `${item.qty}×${price.toFixed(2)}€ = ${(parseFloat(item.qty || 0) * price).toFixed(2)}€`;
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
          <input className={cls} type="number" inputMode="decimal" placeholder="Saldo (€)" value={f.balance || ''} onChange={e => set('balance', e.target.value)} />
        </>);

      /* ── Stocks ──────────────────────────────────────────────────────────── */
      case 'stocks': {
        const q = stockSearchQuery.trim().toUpperCase();
        // Local matches — instant, no network needed
        const localMatches = q.length >= 1
          ? STOCK_LIST.filter(s =>
              s.symbol.includes(q) ||
              s.name.toLowerCase().includes(stockSearchQuery.trim().toLowerCase())
            )
          : [];
        // API-only results: symbols not already covered by local list
        const apiOnly = stockApiResults.filter(r => !localMatches.some(l => l.symbol === r.symbol));
        // Merged list: local first (faster), then API extras — max 8
        const suggestions = [...localMatches, ...apiOnly].slice(0, 8);
        const showDropdown = q.length >= 1 && (suggestions.length > 0 || stockApiLoading);

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
                        {r.exchange && <span className="pat-search-exch">{r.exchange}</span>}
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
        const q           = cryptoSearchQuery.trim().toUpperCase();
        const suggestions = q.length >= 1
          ? CRYPTO_LIST.filter(c =>
              c.symbol.includes(q) ||
              c.name.toLowerCase().includes(cryptoSearchQuery.trim().toLowerCase())
            ).slice(0, 7)
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
                  {PATRIMONY_TYPES.map(({ key, label, icon, color }) => (
                    <button key={key} className="patrimony-type-btn" onClick={() => { setPatrimonyFormType(key); resetPatrimonyForm({}); }}>
                      <span style={{ color, fontSize: '1.5rem' }}>{icon}</span>
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
      <div className="m-budget-page">
        {/* View toggle */}
        <div className="m-toggle">
          <button className={`m-toggle-btn ${activeView === 'budgets'   ? 'active' : ''}`} onClick={() => setActiveView('budgets')}>Orçamentos</button>
          <button className={`m-toggle-btn ${activeView === 'goals'     ? 'active' : ''}`} onClick={() => setActiveView('goals')}>Objetivos</button>
          <button className={`m-toggle-btn ${activeView === 'patrimony' ? 'active' : ''}`} onClick={() => setActiveView('patrimony')}>Património</button>
        </div>

        {/* Month navigation */}
        {activeView === 'budgets' && (
          <div className="m-month-nav">
            <button className="m-month-nav-btn" onClick={() => setSelectedMonth(shiftMonth(selectedMonth, -1))}>‹</button>
            <div className="m-month-nav-center">
              <span className="m-month-nav-label">{formatMonthLabel(selectedMonth)}</span>
              {selectedMonth !== currentMonth && (
                <button className="m-month-nav-today" onClick={() => setSelectedMonth(currentMonth)}>Este mês</button>
              )}
            </div>
            <button className="m-month-nav-btn" onClick={() => setSelectedMonth(shiftMonth(selectedMonth, 1))}>›</button>
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
                  <span className="m-bmc-label">Orçamento mensal</span>
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

            {/* Category cards */}
            <div className="m-bcc-list">
              {sortedItems.map(({ cat, limit, spent, percent, delta, predicted }) => (
                <BudgetCategoryCard
                  key={`${cat.id}-${Math.round(percent)}`}
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
                />
              ))}
            </div>
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
          // Prefer livePrices change data (updated this session) over persisted values
          const assetAlerts = [
            ...(patrimony.stocks ?? [])
              .map(s => ({ sym: s.ticker, pct: livePrices[s.ticker]?.changePct  ?? (s.changePct  != null ? parseFloat(s.changePct)  : null), label: 'hoje' }))
              .filter(x => x.pct != null && Math.abs(x.pct) >= 5),
            ...(patrimony.crypto ?? [])
              .map(c => ({ sym: c.coin,   pct: livePrices[c.coin]?.changePct24h ?? (c.change24h  != null ? parseFloat(c.change24h)  : null), label: '24h'  }))
              .filter(x => x.pct != null && Math.abs(x.pct) >= 5),
          ];

          // ── Impact bar scale: normalize by largest single-asset impact ────
          const allLiveVals = [
            ...(patrimony.stocks ?? []).map(s =>
              toNum(livePrices[s.ticker]?.price ?? s.lastPrice ?? s.avgPrice) * toNum(s.qty)),
            ...(patrimony.crypto ?? []).map(c =>
              toNum(livePrices[c.coin]?.price  ?? c.lastPrice ?? c.price)    * toNum(c.qty)),
          ];
          const maxSingleImpact = totalPatrimony > 0
            ? Math.max(...allLiveVals.map(v => (v / totalPatrimony) * 100), 0.01)
            : 0.01;

          // ── Wealth Intelligence ─────────────────────────────────────────────
          // Derive monthly net savings from transactions (no snapshot history needed)
          const last6Months = Array.from({ length: 6 }, (_, i) => shiftMonth(currentMonth, -(5 - i)));
          const monthlySavings = last6Months.map(m => {
            const txns = transactions.filter(t => t.date && t.date.startsWith(m));
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
            const sym          = isStock ? item.ticker : item.coin;
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
              <div key={item.id} className="pat-asset-card">
                {/* clickable body → opens edit modal */}
                <div
                  className="pat-asset-body"
                  onClick={() => handlePatrimonyEdit(assetKey, item)}
                  style={{ cursor: 'pointer' }}
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
                          <>{marketPrice.toFixed(2)}€/{priceLabel} · {age}</>
                        ) : (
                          <span style={{ color: 'var(--text-tertiary)' }}>A aguardar cotação…</span>
                        )}
                      </span>
                      {(item.broker || item.exchange) && (
                        <span className="pat-asset-broker">{item.broker ?? item.exchange}</span>
                      )}
                    </div>
                    <div className="pat-stock-right">
                      <span className="pat-cat-item-val">{marketVal.toFixed(2)}€</span>
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
                </div>
                {/* action buttons — stop propagation so card click doesn't fire */}
                <div className="pat-asset-actions">
                  <button
                    className="pat-asset-edit"
                    onClick={e => { e.stopPropagation(); handlePatrimonyEdit(assetKey, item); }}
                    title="Editar"
                    aria-label="Editar ativo"
                  >✎</button>
                  <button
                    className="m-asset-item-del pat-asset-del"
                    onClick={e => { e.stopPropagation(); handlePatrimonyDelete(assetKey, item.id); }}
                    title="Remover"
                  >×</button>
                </div>
              </div>
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
                {PATRIMONY_TYPES.map(({ key, label, icon, color }) => {
                  const items     = patrimony[key] || [];
                  const typeTotal = getPatrimonyTypeValue(key);
                  return (
                    <div key={key} className="pat-cat-card">
                      <div className="pat-cat-header">
                        <div className="pat-cat-icon-wrap" style={{ background: `${color}22` }}>
                          <span style={{ color, fontSize: '1rem' }}>{icon}</span>
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
                          {key === 'crypto' ? (() => {
                            /* ── Crypto: group by exchange ── */
                            const byExchange = {};
                            items.forEach(item => {
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
                          })() : items.map(item => {
                            /* ── Stocks: asset card ── */
                            if (key === 'stocks') return assetCardFor(item, 'stocks');
                            /* ── Generic row for all other asset types ── */
                            return (
                              <div key={item.id} className="pat-cat-item">
                                <span className="pat-cat-item-name">{renderPatrimonyItemLabel(key, item)}</span>
                                <span className="pat-cat-item-val">{renderPatrimonyItemValue(key, item)}</span>
                                <button className="m-asset-item-del" onClick={() => handlePatrimonyDelete(key, item.id)}>×</button>
                              </div>
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
    <div className="budget-tab">
      <div className="budget-header">
        <h2>Orçamento</h2>
        <p>Gestão financeira</p>
      </div>

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
          <h3>Limites Mensais</h3>
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
                    <span className="category-icon">{getCategoryIcon(cat.label)}</span>
                    <span className="category-name">{cat.label}</span>
                    {percent >= 100 && <span className="budget-alert over">Excedido</span>}
                    {percent >= 80 && percent < 100 && <span className="budget-alert warn">Atenção</span>}
                  </div>
                  <div className="budget-input-row">
                    <input type="number" inputMode="decimal" className="budget-input" value={limit || ''} onChange={(e) => handleLimitChange(cat.id, e.target.value)} onKeyPress={(e) => { if (e.key === 'Enter') { saveBudgetToDb(); e.target.blur(); } }} placeholder="0" step="10" min="0" />
                    <span className="budget-currency">€/mês</span>
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
            <div className="patrimony-total-amount">{totalPatrimony.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€</div>
          </div>
          <div className="patrimony-types-list">
            {PATRIMONY_TYPES.map(({ key, label, icon, color }) => {
              const items = patrimony[key] || [];
              const typeTotal = getPatrimonyTypeValue(key);
              return (
                <div key={key} className="patrimony-type-card">
                  <div className="patrimony-type-header">
                    <div className="patrimony-type-left">
                      <span className="patrimony-type-icon" style={{ color }}>{icon}</span>
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
