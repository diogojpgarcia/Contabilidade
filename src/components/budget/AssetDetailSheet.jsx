import React, { useState } from 'react';
import CosmosSheet from '../cosmos/CosmosSheet';

/* ─── Gráfico de linha completo ──────────────────────────────────────────────
   SVG responsivo com área sombreada, linha, ponto final e eixo de datas.    */
const DetailChart = ({ prices, color, labels }) => {
  if (!prices || prices.length < 2) {
    return (
      <div className="asd-chart-empty">Sem dados de histórico</div>
    );
  }

  const W = 340, H = 130, PAD_L = 4, PAD_R = 4, PAD_T = 12, PAD_B = 28;
  const min   = Math.min(...prices);
  const max   = Math.max(...prices);
  const range = max === min ? (max * 0.02 || 1) : max - min;

  const pts = prices.map((p, i) => {
    const x = PAD_L + (i / (prices.length - 1)) * (W - PAD_L - PAD_R);
    const y = PAD_T + ((max - p) / range) * (H - PAD_T - PAD_B);
    return [+x.toFixed(1), +y.toFixed(1)];
  });

  const linePts = pts.map(([x, y]) => `${x},${y}`).join(' ');
  const areaPts = [
    `${pts[0][0]},${H - PAD_B}`,
    ...pts.map(([x, y]) => `${x},${y}`),
    `${pts[pts.length - 1][0]},${H - PAD_B}`,
  ].join(' ');

  const [lx, ly] = pts[pts.length - 1];

  // Eixo X: mostrar apenas primeiro, meio e último label
  const axisIdxs = [0, Math.floor((prices.length - 1) / 2), prices.length - 1];

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className="asd-chart-svg"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="asd-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={color} stopOpacity="0.22" />
          <stop offset="100%" stopColor={color} stopOpacity="0.01" />
        </linearGradient>
      </defs>
      {/* Área */}
      <polygon points={areaPts} fill="url(#asd-grad)" />
      {/* Linha */}
      <polyline
        points={linePts}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Ponto final */}
      <circle cx={lx} cy={ly} r="3.5" fill={color} />
      <circle cx={lx} cy={ly} r="6" fill={color} opacity="0.18" />
      {/* Labels eixo X */}
      {labels && axisIdxs.map(idx => (
        <text
          key={idx}
          x={pts[idx][0]}
          y={H - 6}
          textAnchor={idx === 0 ? 'start' : idx === prices.length - 1 ? 'end' : 'middle'}
          fontSize="8"
          fill="currentColor"
          opacity="0.45"
          className="asd-axis-label"
        >
          {labels[idx] ?? ''}
        </text>
      ))}
    </svg>
  );
};

/* ─── AssetDetailSheet ───────────────────────────────────────────────────────
   Props:
     open          : boolean
     onClose       : () => void
     item          : asset object (stock / etf / crypto)
     assetKey      : 'stocks' | 'etfs' | 'crypto'
     marketPrice   : número (cotação atual)
     history       : array de preços (mais antigo → mais recente)
     onEdit        : () => void  — abre o modal de edição
*/
export default function AssetDetailSheet({
  open,
  onClose,
  item,
  assetKey,
  marketPrice,
  history,
  onEdit,
}) {
  if (!item) return null;

  const isStock  = assetKey === 'stocks' || assetKey === 'etfs';
  const sym      = isStock ? item.ticker : (item.coin ?? '');
  const qty      = parseFloat(item.qty) || 0;
  const purchase = parseFloat(item.purchasePrice) || 0;
  const hasPrice = marketPrice > 0;
  const hasPnl   = purchase > 0 && hasPrice && qty > 0;

  const marketVal  = qty * marketPrice;
  const costBasis  = qty * purchase;
  const pnlAbs     = hasPnl ? marketVal - costBasis : 0;
  const pnlPct     = hasPnl ? ((marketPrice - purchase) / purchase) * 100 : 0;
  const pnlPos     = pnlAbs >= 0;

  const color = hasPnl
    ? (pnlPos ? 'var(--cosmos-income)' : 'var(--cosmos-expense)')
    : 'var(--cosmos-accent)';

  const insertedDate = item.insertedAt
    ? new Date(item.insertedAt).toLocaleDateString('pt-PT', {
        day: '2-digit', month: 'short', year: 'numeric',
      })
    : null;

  // Gerar labels de data aproximados para o eixo do gráfico (7 dias)
  const chartLabels = history?.length
    ? history.map((_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (history.length - 1 - i));
        return d.toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' });
      })
    : null;

  const fmt      = (v) => parseFloat(v || 0).toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtPrice = (p) => {
    const n = parseFloat(p) || 0;
    return n.toLocaleString('pt-PT', {
      minimumFractionDigits: 2,
      maximumFractionDigits: n < 0.001 ? 8 : n < 0.1 ? 6 : n < 1 ? 4 : 2,
    });
  };

  const qtyLabel = assetKey === 'etfs' ? 'unidades' : isStock ? 'ações' : 'moedas';

  return (
    <CosmosSheet
      open={open}
      onClose={onClose}
      title={`${sym}${item.name ? ' · ' + item.name : ''}`}
      divider={false}
    >
      <div className="asd-root">

        {/* Preço atual + variação */}
        <div className="asd-price-row">
          <span className="asd-price">{fmtPrice(marketPrice)}€</span>
          {item.changePct != null && (
            <span className={`asd-change ${parseFloat(item.changePct) >= 0 ? 'pos' : 'neg'}`}>
              {parseFloat(item.changePct) >= 0 ? '+' : ''}{parseFloat(item.changePct).toFixed(2)}%
              <span className="asd-change-period"> hoje</span>
            </span>
          )}
          {item.change24h != null && (
            <span className={`asd-change ${parseFloat(item.change24h) >= 0 ? 'pos' : 'neg'}`}>
              {parseFloat(item.change24h) >= 0 ? '+' : ''}{parseFloat(item.change24h).toFixed(2)}%
              <span className="asd-change-period"> 24h</span>
            </span>
          )}
        </div>

        {/* Gráfico */}
        <div className="asd-chart-wrap">
          <DetailChart prices={history} color={color} labels={chartLabels} />
        </div>

        {/* P&L desde inserção */}
        {hasPnl ? (
          <div className={`asd-pnl-card ${pnlPos ? 'pos' : 'neg'}`}>
            <div className="asd-pnl-header">
              <span className="asd-pnl-title">Desde inserção{insertedDate ? ` · ${insertedDate}` : ''}</span>
              <span className={`asd-pnl-badge ${pnlPos ? 'pos' : 'neg'}`}>
                {pnlPos ? '+' : ''}{pnlPct.toFixed(2)}%
              </span>
            </div>
            <div className="asd-pnl-body">
              <div className="asd-pnl-col">
                <span className="asd-pnl-label">Custo</span>
                <span className="asd-pnl-val">{fmt(costBasis)}€</span>
                <span className="asd-pnl-sub">{fmtPrice(purchase)}€ / {isStock ? 'ação' : 'moeda'}</span>
              </div>
              <div className="asd-pnl-arrow">{pnlPos ? '→' : '→'}</div>
              <div className="asd-pnl-col right">
                <span className="asd-pnl-label">Valor atual</span>
                <span className="asd-pnl-val" style={{ color }}>{fmt(marketVal)}€</span>
                <span className={`asd-pnl-gain ${pnlPos ? 'pos' : 'neg'}`}>
                  {pnlPos ? '+' : ''}{fmt(pnlAbs)}€
                </span>
              </div>
            </div>
          </div>
        ) : !purchase && hasPrice ? (
          <div className="asd-pnl-hint">
            Adiciona o preço de compra para ver o teu ganho/perda.
          </div>
        ) : null}

        {/* Stats rápidas */}
        <div className="asd-stats">
          <div className="asd-stat">
            <span className="asd-stat-label">Quantidade</span>
            <span className="asd-stat-val">{qty} {qtyLabel}</span>
          </div>
          <div className="asd-stat">
            <span className="asd-stat-label">Valor total</span>
            <span className="asd-stat-val">{hasPrice ? `${fmt(marketVal)}€` : '—'}</span>
          </div>
          {(item.broker || item.exchange) && (
            <div className="asd-stat">
              <span className="asd-stat-label">{isStock ? 'Broker' : 'Exchange'}</span>
              <span className="asd-stat-val">{item.broker ?? item.exchange}</span>
            </div>
          )}
          {insertedDate && (
            <div className="asd-stat">
              <span className="asd-stat-label">Adicionado em</span>
              <span className="asd-stat-val">{insertedDate}</span>
            </div>
          )}
        </div>

        {/* Botão editar */}
        <button className="asd-edit-btn" onClick={() => { onClose(); setTimeout(onEdit, 180); }}>
          Editar ativo
        </button>

      </div>
    </CosmosSheet>
  );
}
