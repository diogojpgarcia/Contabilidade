import React, { useState } from 'react';
import { usePatrimonyPrices } from '../../hooks/usePatrimonyPrices';
import SwipeRevealCard from '../SwipeRevealCard';
import Overlay from '../Overlay';
import { formatAge, HAS_STOCK_KEY } from '../../utils/assetPrice';
import { calcSerieERate, calcBondValue, formatBondAge } from '../../utils/certificadoAforro';
import { shiftMonth } from '../../utils/insights';
import { filterByFinancialMonth } from '../../utils/financialMonth';
import {
  PATRIMONY_TYPES, EMPTY_PATRIMONY, toNum, normCoin,
  sortPatrimonyTypes, sortItemsByType,
  computeAccountBalance,
} from '../../utils/budgetUtils';
import Sparkline from './Sparkline';
import AssetDetailSheet from './AssetDetailSheet';
import PatrimonyFormModal from './PatrimonyFormModal';
import './AssetDetailSheet.css';

// ── Vehicle depreciation ──────────────────────────────────────────────────────
const VEHICLE_RESIDUAL = [1, 0.82, 0.70, 0.60, 0.52, 0.45, 0.39, 0.34, 0.30, 0.26, 0.23, 0.20];
export const estimateVehicleMarketValue = (purchaseValue, year, km) => {
  if (!purchaseValue || !year) return null;
  const age = new Date().getFullYear() - parseInt(year, 10);
  if (age < 0) return null;
  const residual = age < VEHICLE_RESIDUAL.length ? VEHICLE_RESIDUAL[age] : 0.18;
  const avgKm = parseInt(km, 10) || 0;
  const expectedKm = Math.max(0, age) * 15000;
  const kmDelta = avgKm - expectedKm;
  const kmPenalty = Math.min(0.15, Math.max(0, kmDelta / 100000) * 0.05);
  return purchaseValue * (residual - kmPenalty);
};
const vehicleStandVirtualUrl = (desc) =>
  `https://www.standvirtual.com/carros?q=${encodeURIComponent((desc || '').trim())}`;
const vehicleAutoScout24Url = (desc) =>
  `https://www.autoscout24.pt/lst?fullTextSearch=${encodeURIComponent((desc || '').trim())}`;

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
  // ── Modal state ───────────────────────────────────────────────────────────
  const [showModal,      setShowModal]      = useState(false);
  const [modalInitType,  setModalInitType]  = useState(null); // pre-selected type or null
  const [editingAsset,   setEditingAsset]   = useState(null); // { typeKey, item } | null
  const [confirmDelete,  setConfirmDelete]  = useState(null); // { typeKey, id, name }
  const [detailAsset,    setDetailAsset]    = useState(null); // { item, assetKey }
  const [showEmptyCats,  setShowEmptyCats]  = useState(false); // barra colapsável das categorias vazias

  // ── Live prices, sparklines, euribor ─────────────────────────────────────
  const { livePrices, assetHistory, refreshingTickers, euribor3M } =
    usePatrimonyPrices(externalPatrimony, onPatrimonyChange);

  const patrimony = externalPatrimony || EMPTY_PATRIMONY;

  // ── Modal open helpers ────────────────────────────────────────────────────
  const openAddModal = () => {
    setEditingAsset(null);
    setModalInitType(null);
    setShowModal(true);
  };

  // Abre o modal de adicionar já com a categoria pré-selecionada (barra colapsável).
  const openAddModalForType = (key) => {
    setEditingAsset(null);
    setModalInitType(key);
    setShowModal(true);
  };

  const openEditModal = (typeKey, item) => {
    setEditingAsset({ typeKey, item });
    setModalInitType(typeKey);
    setShowModal(true);
  };

  // ── Delete helpers ────────────────────────────────────────────────────────
  const handleDelete = (typeKey, id, name) => {
    setConfirmDelete({ typeKey, id, name: name || 'este activo' });
  };

  const handleDeleteConfirmed = () => {
    if (!confirmDelete) return;
    const { typeKey, id } = confirmDelete;
    const updated = { ...patrimony, [typeKey]: (patrimony[typeKey] || []).filter(x => x.id !== id) };
    onPatrimonyChange?.(updated);
    setConfirmDelete(null);
  };

  // ── Value helpers ─────────────────────────────────────────────────────────
  const computeAccountBalanceLocal = (acc) => computeAccountBalance(acc, transactions);

  const getTypeValue = (key) => {
    const items = patrimony[key] || [];
    if (key === 'accounts')   return items.reduce((s, x) => s + computeAccountBalanceLocal(x), 0);
    if (key === 'stocks' || key === 'etfs') return items.reduce((s, x) => {
      const price = toNum(livePrices[x.ticker]?.price ?? x.lastPrice ?? x.avgPrice);
      return s + toNum(x.qty) * price;
    }, 0);
    if (key === 'bonds') return items.reduce((s, x) => {
      const faceValue    = parseFloat(x.faceValue || x.value) || 0;
      const purchaseDate = x.purchaseDate || x.date || null;
      const isSerieE     = x.series?.toUpperCase() === 'E';
      const rate         = isSerieE
        ? (euribor3M !== null ? calcSerieERate(euribor3M) : parseFloat(x.annualRate) || null)
        : (parseFloat(x.annualRate) || null);
      return s + ((purchaseDate && rate !== null) ? calcBondValue(faceValue, purchaseDate, rate) : faceValue);
    }, 0);
    if (key === 'realestate') return items.reduce((s, x) => s + toNum(x.value), 0);
    if (key === 'vehicles')   return items.reduce((s, x) => {
      const est = estimateVehicleMarketValue(toNum(x.value), x.year, x.km);
      return s + (est ?? toNum(x.value));
    }, 0);
    if (key === 'crypto') return items.reduce((s, x) => {
      const price = toNum(livePrices[normCoin(x.coin)]?.price ?? x.lastPrice ?? x.price);
      return s + toNum(x.qty) * price;
    }, 0);
    return 0;
  };

  const totalPatrimony = PATRIMONY_TYPES.reduce((s, t) => s + getTypeValue(t.key), 0);
  const pctOf = (key) => totalPatrimony > 0 ? getTypeValue(key) / totalPatrimony : 0;
  const fmt = (v) => toNum(v).toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtStockPrice  = (p) => { const n = parseFloat(p) || 0; return n.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: n < 1 ? 4 : 2 }); };
  const fmtCryptoPrice = (p) => { const n = parseFloat(p) || 0; return n.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: n < 0.001 ? 8 : n < 0.1 ? 6 : n < 1 ? 4 : 2 }); };
  const fmtFiat        = (v) => parseFloat(v || 0).toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // ── Insight / alerts ──────────────────────────────────────────────────────
  const pctEquity = pctOf('stocks') + pctOf('etfs');
  const insightMsg =
    totalPatrimony === 0      ? 'Adiciona os teus ativos para começar a acompanhar o teu património.' :
    pctOf('accounts') > 0.6   ? 'Grande parte do património está em liquidez. Considera diversificar.' :
    pctOf('realestate') > 0.6 ? 'Património concentrado em imóveis — ativo ilíquido mas estável.' :
    pctOf('crypto') > 0.25    ? 'Exposição significativa a criptoativos. Alto risco, alto potencial.' :
    pctOf('etfs') > 0.4       ? 'Portfólio orientado a ETFs — diversificação passiva e eficiente.' :
    pctEquity > 0.4            ? 'Portfólio com forte componente em ações e ETFs. Boa diversificação de crescimento.' :
                                 'Portfólio distribuído por múltiplos tipos de ativos.';

  const assetAlerts = [
    ...(patrimony.stocks ?? [])
      .map(s => ({ sym: s.ticker, pct: livePrices[s.ticker]?.changePct ?? (s.changePct != null ? parseFloat(s.changePct) : null), label: 'hoje' }))
      .filter(x => x.pct != null && Math.abs(x.pct) >= 5),
    ...(patrimony.etfs ?? [])
      .map(e => ({ sym: e.ticker, pct: livePrices[e.ticker]?.changePct ?? (e.changePct != null ? parseFloat(e.changePct) : null), label: 'hoje' }))
      .filter(x => x.pct != null && Math.abs(x.pct) >= 5),
    ...(patrimony.crypto ?? [])
      .map(c => ({ sym: normCoin(c.coin), pct: livePrices[normCoin(c.coin)]?.changePct24h ?? (c.change24h != null ? parseFloat(c.change24h) : null), label: '24h' }))
      .filter(x => x.pct != null && Math.abs(x.pct) >= 5),
  ];

  // ── Wealth Intelligence ───────────────────────────────────────────────────
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

  // ── Live-asset card renderer ──────────────────────────────────────────────
  const allLiveVals = [
    ...(patrimony.stocks ?? []).map(s => toNum(livePrices[s.ticker]?.price ?? s.lastPrice ?? s.avgPrice) * toNum(s.qty)),
    ...(patrimony.etfs   ?? []).map(e => toNum(livePrices[e.ticker]?.price ?? e.lastPrice ?? e.avgPrice) * toNum(e.qty)),
    ...(patrimony.crypto ?? []).map(c => toNum(livePrices[normCoin(c.coin)]?.price ?? c.lastPrice ?? c.price) * toNum(c.qty)),
  ];
  const maxSingleImpact = totalPatrimony > 0
    ? Math.max(...allLiveVals.map(v => (v / totalPatrimony) * 100), 0.01)
    : 0.01;

  const assetCardFor = (item, assetKey) => {
    const isStock      = assetKey === 'stocks' || assetKey === 'etfs';
    const sym          = isStock ? item.ticker : normCoin(item.coin);
    const isRefreshing = refreshingTickers.has(sym);

    const live        = livePrices[sym];
    const marketPrice = toNum(live?.price ?? (isStock ? (item.lastPrice ?? item.avgPrice) : (item.lastPrice ?? item.price)));
    const marketVal   = toNum(item.qty) * marketPrice;
    const age         = formatAge(live?.lastUpdated ?? item.lastUpdated);
    const _rawChg     = live ? (isStock ? live.changePct : live.changePct24h) : (isStock ? item.changePct : item.change24h);
    const chg         = _rawChg != null && Number.isFinite(Number(_rawChg)) ? Number(_rawChg) : null;
    const hasPrice    = marketPrice > 0;
    const sparkPrices = assetHistory[sym];
    const sparkUp     = sparkPrices?.length >= 2
      ? sparkPrices[sparkPrices.length - 1] >= sparkPrices[0]
      : chg != null ? chg >= 0 : null;
    const sparkColor  = sparkUp === true ? 'var(--cosmos-income)' : sparkUp === false ? 'var(--cosmos-expense)' : 'var(--cosmos-text-3)';
    const impact      = totalPatrimony > 0 ? (marketVal / totalPatrimony) * 100 : 0;
    const barWidth    = maxSingleImpact > 0 ? Math.min((impact / maxSingleImpact) * 100, 100) : 0;
    const qty         = parseFloat(item.qty) || 0;
    const qtyLabel    = assetKey === 'etfs' ? 'unidades' : isStock ? 'ações' : 'moedas';
    const priceLabel  = assetKey === 'etfs' ? 'unidade'  : isStock ? 'ação'  : 'moeda';

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
        onEdit={() => openEditModal(assetKey, item)}
        onDelete={() => handleDelete(assetKey, item.id)}
        onClick={() => setDetailAsset({ item, assetKey })}
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
                <span className="skeleton skeleton-price" style={{ display: 'inline-block', verticalAlign: 'middle' }} />
              ) : hasPrice ? (
                <>{isStock ? fmtStockPrice(marketPrice) : fmtCryptoPrice(marketPrice)}€/{priceLabel} · {age}</>
              ) : (
                <span className="skeleton skeleton-price" style={{ display: 'inline-block', verticalAlign: 'middle' }} />
              )}
            </span>
            {(item.broker || item.exchange) && (
              <span className="pat-asset-broker">{item.broker ?? item.exchange}</span>
            )}
          </div>
          <div className="pat-stock-right">
            {isRefreshing
              ? <span className="skeleton" style={{ display: 'inline-block', width: 64, height: '1.1em', borderRadius: 4 }} />
              : <span className="pat-cat-item-val">{fmtFiat(marketVal)}€</span>
            }
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

  // ── Helpers for non-live items ────────────────────────────────────────────
  const renderItemLabel = (key, item) => {
    if (key === 'accounts')   return `${item.name}${item.bank ? ' · ' + item.bank : ''}`;
    if (key === 'stocks')     return item.ticker;
    if (key === 'etfs')       return item.ticker;
    if (key === 'bonds') {
      const age = formatBondAge(item.purchaseDate || item.date);
      return `Cert. Aforro Série ${item.series || '?'}${age ? ' · ' + age : ''}`;
    }
    if (key === 'realestate') return item.description;
    if (key === 'vehicles')   return item.description;
    if (key === 'crypto')     return item.coin;
    return '';
  };

  const renderItemValue = (key, item) => {
    if (key === 'accounts') return `${fmtFiat(computeAccountBalanceLocal(item))}€`;
    if (key === 'stocks' || key === 'etfs') {
      const price = parseFloat(item.lastPrice ?? item.avgPrice) || null;
      const unit  = key === 'etfs' ? 'unidades' : 'ações';
      if (!price) return `${item.qty || 0} ${unit} · cotação pendente`;
      const total = (parseFloat(item.qty) || 0) * price;
      return `${item.qty}×${fmtStockPrice(price)}€ = ${fmtFiat(total)}€`;
    }
    if (key === 'bonds') {
      const faceValue    = parseFloat(item.faceValue || item.value) || 0;
      const purchaseDate = item.purchaseDate || item.date || null;
      const isSerieE     = item.series?.toUpperCase() === 'E';
      const rate         = isSerieE
        ? (euribor3M !== null ? calcSerieERate(euribor3M) : parseFloat(item.annualRate) || null)
        : (parseFloat(item.annualRate) || null);
      const val = (purchaseDate && rate !== null) ? calcBondValue(faceValue, purchaseDate, rate) : faceValue;
      return `${fmtFiat(val)}€`;
    }
    if (key === 'realestate') return `${fmtFiat(item.value)}€`;
    if (key === 'vehicles')   return `${fmtFiat(item.value)}€`;
    if (key === 'crypto') {
      const price = parseFloat(item.lastPrice ?? item.price) || null;
      if (!price) return `${item.qty || 0} moedas · cotação pendente`;
      return `${item.qty}×${fmtCryptoPrice(price)}€ = ${fmtFiat((parseFloat(item.qty || 0) * price))}€`;
    }
    return '';
  };

  // ── Main render ───────────────────────────────────────────────────────────
  const typeValues = PATRIMONY_TYPES.map(t => ({ ...t, value: getTypeValue(t.key) }));

  // Contas sempre visíveis (mesmo vazias). As restantes categorias sem ativos
  // ficam numa barra colapsável (em vez de cartões vazios com emoji).
  const sortedTypes = sortPatrimonyTypes(patrimony, PATRIMONY_TYPES);
  const shownTypes  = sortedTypes.filter(t => (patrimony[t.key] || []).length > 0 || t.key === 'accounts');
  const emptyTypes  = sortedTypes.filter(t => (patrimony[t.key] || []).length === 0 && t.key !== 'accounts');

  return (
    <>
      {/* ── Hero card ── */}
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

      {/* ── Micro insight ── */}
      <div className="pat-insight">
        <span className="pat-insight-icon">◉</span>
        <span className="pat-insight-msg">{insightMsg}</span>
      </div>

      {/* ── Allocation ── */}
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
                {pct >= 5 ? 'SUBIDA FORTE' : 'QUEDA FORTE'}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* ── Category cards ── */}
      <div className="pat-cards">
        {shownTypes.map(({ key, label, Icon: PatIcon, color }) => {
          const items     = patrimony[key] || [];
          const sorted    = sortItemsByType(items, key);
          const typeTotal = getTypeValue(key);
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
                  {key === 'etfs' || key === 'stocks'
                    ? sorted.map(item => assetCardFor(item, key))
                    : key === 'accounts'
                    ? sorted.map(item => {
                        const currentBal = computeAccountBalanceLocal(item);
                        const isMain     = item.id === mainAccountId;
                        return (
                          <SwipeRevealCard
                            key={item.id}
                            className={`pat-cat-item pat-account-item${isMain ? ' pat-account-item--main' : ''}`}
                            onEdit={() => openEditModal('accounts', item)}
                            onDelete={() => handleDelete('accounts', item.id)}
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
                      })
                    : key === 'crypto'
                    ? (() => {
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
                      })()
                    : key === 'vehicles'
                    ? sorted.map(item => {
                        const purchaseVal = toNum(item.value);
                        const estVal      = estimateVehicleMarketValue(purchaseVal, item.year, item.km);
                        const age         = item.year ? new Date().getFullYear() - parseInt(item.year, 10) : null;
                        const depPct      = (estVal != null && purchaseVal > 0)
                          ? ((estVal - purchaseVal) / purchaseVal * 100)
                          : null;
                        return (
                          <SwipeRevealCard
                            key={item.id}
                            className="pat-cat-item pat-vehicle-item"
                            onEdit={() => openEditModal(key, item)}
                            onDelete={() => handleDelete(key, item.id)}
                          >
                            <div className="pat-vehicle-main">
                              <div className="pat-vehicle-left">
                                <span className="pat-cat-item-name">{item.description}</span>
                                {item.year && (
                                  <span className="pat-vehicle-meta">
                                    {item.year}{item.km ? ` · ${parseInt(item.km,10).toLocaleString('pt-PT')} km` : ''}{age != null ? ` · ${age} ${age === 1 ? 'ano' : 'anos'}` : ''}
                                  </span>
                                )}
                                {estVal != null && (
                                  <span className="pat-vehicle-est">
                                    Est. mercado: <strong>{fmtFiat(estVal)}€</strong>
                                    {depPct != null && (
                                      <span className={`pat-vehicle-dep ${depPct >= 0 ? 'pos' : 'neg'}`}>
                                        {depPct >= 0 ? '+' : ''}{depPct.toFixed(1)}%
                                      </span>
                                    )}
                                  </span>
                                )}
                                <div className="pat-vehicle-links">
                                  <a href={vehicleStandVirtualUrl(item.description)} target="_blank" rel="noopener noreferrer" className="pat-vehicle-link" onClick={e => e.stopPropagation()}>StandVirtual ↗</a>
                                  <a href={vehicleAutoScout24Url(item.description)} target="_blank" rel="noopener noreferrer" className="pat-vehicle-link" onClick={e => e.stopPropagation()}>AutoScout24 ↗</a>
                                </div>
                              </div>
                              <div className="pat-vehicle-right">
                                <span className="pat-cat-item-val">{fmtFiat(estVal ?? purchaseVal)}€</span>
                                {estVal != null && <span className="pat-vehicle-original">compra {fmtFiat(purchaseVal)}€</span>}
                              </div>
                            </div>
                          </SwipeRevealCard>
                        );
                      })
                    : sorted.map(item => (
                        <SwipeRevealCard
                          key={item.id}
                          className="pat-cat-item"
                          onEdit={() => openEditModal(key, item)}
                          onDelete={() => handleDelete(key, item.id)}
                        >
                          <span className="pat-cat-item-name">{renderItemLabel(key, item)}</span>
                          <span className="pat-cat-item-val">{renderItemValue(key, item)}</span>
                        </SwipeRevealCard>
                      ))
                  }
                </div>
              )}

              {items.length === 0 && (
                <button className="pat-cat-empty-inline" onClick={() => openAddModalForType(key)}>
                  + Adicionar {label.toLowerCase()}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Categorias sem ativos (barra colapsável) ── */}
      {emptyTypes.length > 0 && (
        <div className="pat-empty-cats">
          <button className="pat-empty-cats-toggle" onClick={() => setShowEmptyCats(v => !v)}>
            <span>{emptyTypes.length} categoria{emptyTypes.length !== 1 ? 's' : ''} sem ativos</span>
            <span className="pat-empty-cats-chev">{showEmptyCats ? '▾' : '▸'}</span>
          </button>
          {showEmptyCats && (
            <div className="pat-empty-cats-list">
              {emptyTypes.map(({ key, label, Icon: PatIcon, color }) => (
                <button key={key} className="pat-empty-cat-row" onClick={() => openAddModalForType(key)}>
                  <span className="pat-empty-cat-icon" style={{ background: `${color}22` }}>
                    <PatIcon size={16} color={color} strokeWidth={2} />
                  </span>
                  <span className="pat-empty-cat-label">{label}</span>
                  <span className="pat-empty-cat-add">+</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Asset detail sheet ── */}
      {detailAsset && (() => {
        const { item, assetKey } = detailAsset;
        const isStock = assetKey === 'stocks' || assetKey === 'etfs';
        const sym     = isStock ? item.ticker : normCoin(item.coin);
        const mPrice  = toNum(livePrices[sym]?.price ?? (isStock
          ? (item.lastPrice ?? item.avgPrice)
          : (item.lastPrice ?? item.price)));
        return (
          <AssetDetailSheet
            open={!!detailAsset}
            onClose={() => setDetailAsset(null)}
            item={item}
            assetKey={assetKey}
            marketPrice={mPrice}
            history={assetHistory[sym]}
            onEdit={() => openEditModal(assetKey, item)}
          />
        );
      })()}

      {/* ── FAB ── */}
      <button className="m-fab" onClick={openAddModal}>+</button>

      {/* ── Add/Edit modal ── */}
      <PatrimonyFormModal
        open={showModal}
        initialType={modalInitType}
        editingAsset={editingAsset}
        patrimony={patrimony}
        onPatrimonyChange={onPatrimonyChange}
        onAccountRename={onAccountRename}
        euribor3M={euribor3M}
        onClose={() => setShowModal(false)}
        PATRIMONY_TYPES={PATRIMONY_TYPES}
      />

      {/* ── Confirm delete ── */}
      {confirmDelete && (
        <Overlay onClose={() => setConfirmDelete(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h4>Remover activo?</h4>
              <button className="modal-close" onClick={() => setConfirmDelete(null)} aria-label="Fechar">×</button>
            </div>
            <div className="modal-body" style={{ padding: '0 0 8px' }}>
              <p style={{ marginBottom: 16, color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                <strong>{confirmDelete.name}</strong> será removido do teu património.
              </p>
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  style={{ flex: 1, padding: '10px', borderRadius: '10px', border: '1px solid var(--separator)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.875rem' }}
                  onClick={() => setConfirmDelete(null)}
                >Cancelar</button>
                <button
                  style={{ flex: 1, padding: '10px', borderRadius: '10px', border: 'none', background: 'var(--cosmos-expense)', color: '#fff', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.875rem', fontWeight: 600 }}
                  onClick={handleDeleteConfirmed}
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
