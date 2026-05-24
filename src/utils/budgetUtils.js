import { PATRIMONY_META } from './categoryIcons';

/**
 * Calcula o saldo actual de uma conta a partir do saldo inicial e das
 * transações ligadas. Fonte única de verdade — usada em useTransactions e
 * PatrimonyView para garantir resultados sempre idênticos.
 */
export const computeAccountBalance = (account, transactions) => {
  const initial = parseFloat(account.balance ?? 0);
  if (isNaN(initial)) return 0;
  return (transactions || []).reduce((sum, tx) => {
    if (tx.account_id !== account.id) return sum;
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

/* ── Asset/Patrimony Sorting Utilities ────────────────────────────────────── */

// Compute value of a patrimony item (type-specific)
export const getItemValue = (item, typeKey) => {
  if (typeKey === 'accounts') return parseFloat(item.currentBalance ?? item.balance) || 0;
  if (typeKey === 'stocks')   return (parseFloat(item.qty) || 0) * (parseFloat(item.avgPrice) || 0);
  if (typeKey === 'crypto')   return (parseFloat(item.qty) || 0) * (parseFloat(item.price) || 0);
  if (typeKey === 'bonds')    return parseFloat(item.value) || 0;
  if (typeKey === 'vehicles') return parseFloat(item.value) || 0;
  if (typeKey === 'realestate') return parseFloat(item.value) || 0;
  return 0;
};

// Sort items within a patrimony type by relevance
export const sortItemsByType = (items, typeKey) => {
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
export const sortPatrimonyTypes = (patrimony, types) => {
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

export const PATRIMONY_TYPES = [
  { key: 'accounts',   label: 'Contas Bancárias', ...PATRIMONY_META.accounts   },
  { key: 'stocks',     label: 'Ações',             ...PATRIMONY_META.stocks     },
  { key: 'bonds',      label: 'Cert. Aforro',      ...PATRIMONY_META.bonds      },
  { key: 'realestate', label: 'Imóveis',            ...PATRIMONY_META.realestate },
  { key: 'vehicles',   label: 'Veículos',           ...PATRIMONY_META.vehicles   },
  { key: 'crypto',     label: 'Crypto',             ...PATRIMONY_META.crypto     },
];

export const EMPTY_PATRIMONY = { accounts: [], stocks: [], bonds: [], realestate: [], vehicles: [], crypto: [] };

/**
 * Safe numeric conversion used throughout all financial calculations.
 * Returns 0 for NaN, ±Infinity, null, undefined, "", or any non-finite value.
 *   toNum(undefined) → 0
 *   toNum(null)      → 0
 *   toNum(NaN)       → 0   ← the critical case ?? misses
 *   toNum("3.14")    → 3.14
 *   toNum(0)         → 0
 */
export const toNum = (v) => { const x = Number(v); return Number.isFinite(x) ? x : 0; };

/**
 * Normalises a crypto coin symbol to its base ticker.
 * Strips any exchange-pair suffix so both old ("BTC/USD") and
 * new ("BTC") stored values map to the same livePrices key.
 *   normCoin("BTC/USD")  → "BTC"
 *   normCoin("ETH/USDT") → "ETH"
 *   normCoin("BTC")      → "BTC"
 *   normCoin(undefined)  → ""
 */
export const normCoin = (sym) => sym?.split('/')[0]?.toUpperCase() ?? '';

/* 4-level budget status ─────────────────────────────────────────────────── */
export const STATUS = (pct) => {
  if (pct >= 100) return { key: 'over',   label: 'Ultrapassado',    color: '#ef4444', grad: 'linear-gradient(90deg,#991b1b,#ef4444)', glow: 'rgba(239,68,68,0.35)'   };
  if (pct >= 90)  return { key: 'danger', label: 'Quase no limite', color: '#f97316', grad: 'linear-gradient(90deg,#c2410c,#fb923c)', glow: 'rgba(249,115,22,0.28)'  };
  if (pct >= 70)  return { key: 'warn',   label: 'Atenção',         color: '#F59E0B', grad: 'linear-gradient(90deg,#b45309,#fbbf24)', glow: 'rgba(245,158,11,0.25)'  };
  return           { key: 'safe',   label: 'Seguro',            color: '#22c55e', grad: 'linear-gradient(90deg,#15803d,#4ade80)', glow: 'rgba(34,197,94,0.22)'   };
};
