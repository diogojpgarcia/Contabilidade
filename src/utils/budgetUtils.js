import { PATRIMONY_META } from './categoryIcons';

/**
 * Calcula o saldo actual de uma conta. Fonte única de verdade — usada em
 * useTransactions e PatrimonyView para garantir resultados sempre idênticos.
 *
 * MODO ÂNCORA: se a conta foi conferida (`reconciledAt` + `reconciledBalance`),
 * o saldo parte do **saldo conferido** (o número real do banco) e soma apenas os
 * movimentos com data POSTERIOR à conferência. Isto torna o saldo fiel ao banco
 * e independente do "saldo inicial" e de o histórico todo estar perfeito — cada
 * "Conferir saldo" re-ancora e auto-corrige. O saldo de criação (`balance`) fica
 * apenas como registo informativo.
 *
 * FALLBACK (conta nunca conferida): comportamento clássico — saldo de criação +
 * ajuste + soma de TODAS as transações ligadas.
 *
 * @param opts.asOf  'YYYY-MM-DD' — se definido, soma apenas movimentos até essa
 *   data (inclusive). Usado pela reconciliação para comparar com o saldo real
 *   numa data. Em modo âncora com asOf anterior à conferência, cai no fallback.
 */
export const computeAccountBalance = (account, transactions, { asOf = null } = {}) => {
  const anchorDate = account.reconciledAt || null;
  // Modo âncora só quando há conferência E a data pedida não é anterior a ela.
  const useAnchor = !!anchorDate && (!asOf || asOf >= anchorDate);
  const base = useAnchor
    ? (parseFloat(account.reconciledBalance ?? 0) || 0)
    : (parseFloat(account.balance ?? 0) || 0) + (parseFloat(account.adjustment ?? 0) || 0);

  return (transactions || []).reduce((sum, tx) => {
    if (tx.account_id !== account.id) return sum;
    // Em modo âncora, só contam movimentos APÓS a data de conferência.
    if (useAnchor && (!tx.date || tx.date <= anchorDate)) return sum;
    if (asOf && tx.date && tx.date > asOf) return sum;
    const amt = parseFloat(tx.amount) || 0;
    if (tx.type === 'income')  return sum + amt;
    if (tx.type === 'expense') return sum - amt;
    if (tx.type === 'transfer') {
      // subcategory 'out'/'in' é a fonte primária (definida desde 2025).
      // Fallback para o padrão de texto para compatibilidade com dados antigos.
      const isOut = tx.subcategory === 'out'
        || (tx.subcategory !== 'in' && /^Transferência para/i.test(tx.description || ''));
      return isOut ? sum - amt : sum + amt;
    }
    return sum;
  }, base);
};

/* ── Asset/Patrimony Sorting Utilities ────────────────────────────────────── */

// Compute value of a patrimony item (type-specific)
export const getItemValue = (item, typeKey) => {
  // currentBalance (injetado) já inclui balance+adjustment+transações; em fallback
  // soma balance+adjustment para nunca ignorar o ajuste manual ao saldo.
  if (typeKey === 'accounts')  return parseFloat(item.currentBalance ?? ((parseFloat(item.balance) || 0) + (parseFloat(item.adjustment) || 0))) || 0;
  if (typeKey === 'stocks')    return (parseFloat(item.qty) || 0) * (parseFloat(item.avgPrice) || 0);
  if (typeKey === 'etfs')      return (parseFloat(item.qty) || 0) * (parseFloat(item.avgPrice) || 0);
  if (typeKey === 'crypto')    return (parseFloat(item.qty) || 0) * (parseFloat(item.price) || 0);
  if (typeKey === 'bonds')     return parseFloat(item.value) || 0;
  if (typeKey === 'vehicles')  return parseFloat(item.value) || 0;
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
  if (typeKey === 'stocks' || typeKey === 'etfs' || typeKey === 'crypto') {
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

  const sorted = typeValues.sort((a, b) => {
    if (a.hasItems !== b.hasItems) return a.hasItems ? -1 : 1;
    if (a.hasItems) return b.totalValue - a.totalValue;
    return (a.label || '').localeCompare(b.label || '');
  });

  // Contas sempre em primeiro (destaque), independente de valor/ordem alfabética.
  const accounts = sorted.filter(t => t.key === 'accounts');
  const rest     = sorted.filter(t => t.key !== 'accounts');
  return [...accounts, ...rest];
};

export const PATRIMONY_TYPES = [
  { key: 'accounts',   label: 'Contas Bancárias', ...PATRIMONY_META.accounts   },
  { key: 'stocks',     label: 'Ações',             ...PATRIMONY_META.stocks     },
  { key: 'etfs',       label: 'ETFs',              ...PATRIMONY_META.etfs       },
  { key: 'bonds',      label: 'Cert. Aforro',      ...PATRIMONY_META.bonds      },
  { key: 'realestate', label: 'Imóveis',            ...PATRIMONY_META.realestate },
  { key: 'vehicles',   label: 'Veículos',           ...PATRIMONY_META.vehicles   },
  { key: 'crypto',     label: 'Crypto',             ...PATRIMONY_META.crypto     },
];

export const EMPTY_PATRIMONY = { accounts: [], stocks: [], etfs: [], bonds: [], realestate: [], vehicles: [], crypto: [] };

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
 * Arredonda a 2 casas decimais (cêntimos). Usar nas FRONTEIRAS de escrita de
 * valores monetários derivados de somas em JS (ex. adjustment, saldo conferido)
 * para impedir que a deriva de vírgula flutuante (0.1+0.2) se acumule na BD.
 *   roundCents(0.1 + 0.2) → 0.3
 */
export const roundCents = (v) => Math.round((Number(v) || 0) * 100) / 100;

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
