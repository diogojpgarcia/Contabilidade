import React, { useState, useEffect, useRef, useCallback } from 'react';
import CosmosSheet from '../cosmos/CosmosSheet';
import { fetchPeriodHistory } from '../../utils/assetPrice';

// ─── Catmull-Rom smooth SVG path ──────────────────────────────────────────────
function catmullRomPath(pts) {
  if (pts.length < 2) return '';
  let d = `M${pts[0][0].toFixed(2)},${pts[0][1].toFixed(2)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    const cp1x = p1[0] + (p2[0] - p0[0]) / 6;
    const cp1y = p1[1] + (p2[1] - p0[1]) / 6;
    const cp2x = p2[0] - (p3[0] - p1[0]) / 6;
    const cp2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C${cp1x.toFixed(2)},${cp1y.toFixed(2)} ${cp2x.toFixed(2)},${cp2y.toFixed(2)} ${p2[0].toFixed(2)},${p2[1].toFixed(2)}`;
  }
  return d;
}

// ─── Map price array → SVG coordinate points ─────────────────────────────────
const W = 358, H = 160, PL = 10, PR = 10, PT = 14, PB = 20;

function toPts(prices) {
  if (!prices || prices.length < 2) return [];
  const mn = Math.min(...prices), mx = Math.max(...prices);
  const rng = mx === mn ? mx * 0.08 || 20 : mx - mn;
  return prices.map((v, i) => [
    PL + (i / (prices.length - 1)) * (W - PL - PR),
    PT + ((mx - v) / rng) * (H - PT - PB),
  ]);
}

const PERIODS = ['1D', '1S', '2S', '1M', '1A'];

const fmtPrice = (n) => {
  if (!n && n !== 0) return '—';
  return n.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: n < 1 ? 6 : 2 });
};
const fmtInt = (n) => Math.round(n).toLocaleString('pt-PT');
const fmtPct = (n) => (n >= 0 ? '+' : '') + n.toFixed(2) + '%';

// ─── Chart component ──────────────────────────────────────────────────────────
const PremiumChart = React.memo(({
  prices, labels, purchasePrice, isPos, scrubIdx, clipW, onScrub, onScrubEnd,
}) => {
  const pts = toPts(prices);
  if (pts.length < 2) return (
    <div className="asd-chart-empty">Sem dados de histórico</div>
  );

  const linePath = catmullRomPath(pts);
  const areaPath = linePath
    + ` L${pts[pts.length - 1][0].toFixed(2)},${H - PB}`
    + ` L${pts[0][0].toFixed(2)},${H - PB} Z`;

  const color = isPos ? '#30d158' : '#ff453a';
  const gradId = isPos ? 'asd-gpos' : 'asd-gneg';

  // Purchase price line
  const mn = Math.min(...prices), mx = Math.max(...prices);
  const rng = mx === mn ? mx * 0.08 || 20 : mx - mn;
  const purchY = purchasePrice && purchasePrice >= mn && purchasePrice <= mx
    ? PT + ((mx - purchasePrice) / rng) * (H - PT - PB)
    : null;

  const scrubPt = scrubIdx !== null && pts[scrubIdx] ? pts[scrubIdx] : null;
  const endPt = pts[pts.length - 1];

  // Split x for dim/active
  const splitX = scrubPt ? scrubPt[0] : clipW;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className="asd-svg"
      style={{ touchAction: 'none' }}
      onMouseDown={e => { const r = e.currentTarget.getBoundingClientRect(); onScrub((e.clientX - r.left) / r.width); }}
      onMouseMove={e => { if (e.buttons) { const r = e.currentTarget.getBoundingClientRect(); onScrub((e.clientX - r.left) / r.width); } }}
      onMouseLeave={onScrubEnd}
      onMouseUp={onScrubEnd}
      onTouchStart={e => { e.preventDefault(); const r = e.currentTarget.getBoundingClientRect(); onScrub((e.touches[0].clientX - r.left) / r.width); }}
      onTouchMove={e => { e.preventDefault(); const r = e.currentTarget.getBoundingClientRect(); onScrub((e.touches[0].clientX - r.left) / r.width); }}
      onTouchEnd={onScrubEnd}
    >
      <defs>
        <linearGradient id="asd-gpos" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#30d158" stopOpacity="0.22" />
          <stop offset="80%" stopColor="#30d158" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="asd-gneg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ff453a" stopOpacity="0.18" />
          <stop offset="80%" stopColor="#ff453a" stopOpacity="0" />
        </linearGradient>
        <clipPath id="asd-clip-a">
          <rect x="0" y="0" width={splitX.toFixed(1)} height={H} />
        </clipPath>
        <clipPath id="asd-clip-d">
          <rect x={splitX.toFixed(1)} y="0" width={W} height={H} />
        </clipPath>
      </defs>

      {/* Area — only on active portion */}
      <path d={areaPath} fill={`url(#${gradId})`} clipPath="url(#asd-clip-a)" />

      {/* Line — active */}
      <path d={linePath} fill="none" stroke={color} strokeWidth="2.2"
        strokeLinecap="round" strokeLinejoin="round" clipPath="url(#asd-clip-a)" />

      {/* Line — dimmed (only when scrubbing) */}
      {scrubPt && (
        <path d={linePath} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="2.2"
          strokeLinecap="round" strokeLinejoin="round" clipPath="url(#asd-clip-d)" />
      )}

      {/* Purchase price dashed line */}
      {purchY !== null && (
        <>
          <line x1={PL} y1={purchY.toFixed(1)} x2={W - PR} y2={purchY.toFixed(1)}
            stroke="rgba(255,190,50,0.5)" strokeWidth="1" strokeDasharray="5,4" />
          <text x={W - PR - 4} y={(purchY - 5).toFixed(1)} textAnchor="end"
            fontSize="9" fill="rgba(255,190,50,0.7)" fontFamily="-apple-system,sans-serif">
            preço compra
          </text>
        </>
      )}

      {/* Cursor vertical line */}
      {scrubPt && (
        <line x1={scrubPt[0].toFixed(1)} x2={scrubPt[0].toFixed(1)} y1={6} y2={H - 6}
          stroke="rgba(255,255,255,0.18)" strokeWidth="1" />
      )}

      {/* End / cursor dot */}
      {(() => {
        const pt = scrubPt || (clipW >= W - PR ? endPt : null);
        if (!pt) return null;
        return (
          <>
            <circle cx={pt[0].toFixed(1)} cy={pt[1].toFixed(1)} r="9"
              fill={color} opacity="0.15" />
            <circle cx={pt[0].toFixed(1)} cy={pt[1].toFixed(1)} r="4.5"
              fill={color} stroke="var(--cosmos-bg, #0c0e13)" strokeWidth="2.5" />
          </>
        );
      })()}
    </svg>
  );
});

// ─── Main component ───────────────────────────────────────────────────────────
export default function AssetDetailSheet({
  open, onClose, item, assetKey, marketPrice, history, onEdit,
}) {
  const [period, setPeriod]   = useState('1S');
  const [periodData, setPeriodData] = useState(null); // { prices, labels }
  const [loading, setLoading] = useState(false);
  const [clipW, setClipW]     = useState(0);
  const [scrubIdx, setScrubIdx] = useState(null);
  const [scrubPrice, setScrubPrice] = useState(null);
  const animRef = useRef(null);
  const prevPeriod = useRef(null);

  if (!item) return null;

  const isStock  = assetKey === 'stocks' || assetKey === 'etfs';
  const type     = isStock ? 'stock' : 'crypto';
  const sym      = isStock ? item.ticker : (item.coin ?? '');
  const qty      = parseFloat(item.qty) || 0;
  const purchase = parseFloat(item.purchasePrice) || 0;
  const hasPrice = marketPrice > 0;

  const marketVal = qty * marketPrice;
  const costBasis = qty * purchase;
  const pnlAbs    = purchase > 0 && hasPrice ? marketVal - costBasis : null;
  const pnlPct    = purchase > 0 && hasPrice ? ((marketPrice - purchase) / purchase) * 100 : null;
  const isPos     = (pnlPct !== null ? pnlPct : (periodData?.prices
    ? periodData.prices[periodData.prices.length - 1] - periodData.prices[0]
    : 0)) >= 0;

  const insertedDate = item.insertedAt
    ? new Date(item.insertedAt).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' })
    : null;

  const qtyLabel   = assetKey === 'etfs' ? 'unidades' : isStock ? 'ações' : 'moedas';
  const priceLabel = assetKey === 'etfs' ? 'unidade'  : isStock ? 'ação'  : 'moeda';

  // ── Fetch period data ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    // 1S: reuse the sparkline history we already have
    if (period === '1S' && history?.length >= 2) {
      const labels = history.map((_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (history.length - 1 - i));
        return d.toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' });
      });
      setPeriodData({ prices: history, labels });
      return;
    }

    setLoading(true);
    fetchPeriodHistory(sym, period, type).then(result => {
      if (cancelled) return;
      setPeriodData(result);
      setLoading(false);
    });

    return () => { cancelled = true; };
  }, [period, open, sym, type, history]);

  // ── Animate chart line on period change ──────────────────────────────────────
  useEffect(() => {
    if (!open || !periodData) return;
    if (animRef.current) cancelAnimationFrame(animRef.current);
    setClipW(0);
    setScrubIdx(null);
    setScrubPrice(null);

    const duration = 550;
    const start = performance.now();
    function step(now) {
      const t = Math.min(1, (now - start) / duration);
      const ease = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      setClipW(ease * W);
      if (t < 1) animRef.current = requestAnimationFrame(step);
      else setClipW(W);
    }
    animRef.current = requestAnimationFrame(step);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [periodData, open]);

  // ── Scrub handler ────────────────────────────────────────────────────────────
  const handleScrub = useCallback((ratio) => {
    if (!periodData?.prices) return;
    const idx = Math.round(Math.max(0, Math.min(1, ratio)) * (periodData.prices.length - 1));
    setScrubIdx(idx);
    setScrubPrice(periodData.prices[idx]);
  }, [periodData]);

  const handleScrubEnd = useCallback(() => {
    setScrubIdx(null);
    setScrubPrice(null);
  }, []);

  // ── Displayed price & delta ──────────────────────────────────────────────────
  const prices    = periodData?.prices;
  const labels    = periodData?.labels;
  const dispPrice = scrubPrice ?? marketPrice;
  const basePrice = prices?.[0];
  const periodDelta = prices && basePrice
    ? ((dispPrice - basePrice) / basePrice) * 100
    : null;
  const dispLabel = scrubIdx !== null && labels ? labels[scrubIdx] : null;

  return (
    <CosmosSheet open={open} onClose={onClose} title="" showClose divider={false}>
      <div className="asd-root">

        {/* Header */}
        <div className="asd-hdr">
          <div className="asd-hdr-left">
            <div className="asd-icon">{sym.slice(0, 4)}</div>
            <div>
              <div className="asd-sym">{sym}</div>
              {item.name && <div className="asd-name">{item.name}</div>}
            </div>
          </div>
          {(item.broker || item.exchange) && (
            <span className="asd-broker">{item.broker ?? item.exchange}</span>
          )}
        </div>

        {/* Price */}
        <div className="asd-price-block">
          <div className="asd-price">{fmtPrice(dispPrice)}€</div>
          <div className="asd-price-row">
            {periodDelta !== null && (
              <span className={`asd-badge ${periodDelta >= 0 ? 'pos' : 'neg'}`}>
                {periodDelta >= 0 ? '▲' : '▼'} {Math.abs(periodDelta).toFixed(2)}%
              </span>
            )}
            <span className="asd-period-lbl">
              {dispLabel ?? period}
            </span>
          </div>
        </div>

        {/* Period selector */}
        <div className="asd-periods">
          {PERIODS.map(p => (
            <button
              key={p}
              className={`asd-pbtn${period === p ? ' active' : ''}`}
              onClick={() => { if (p !== period) { setPeriod(p); setPeriodData(null); } }}
            >{p}</button>
          ))}
        </div>

        {/* Chart */}
        <div className="asd-chart-wrap">
          {loading && <div className="asd-chart-loading"><span className="asd-spinner" /></div>}
          {!loading && (
            <PremiumChart
              prices={prices}
              labels={labels}
              purchasePrice={purchase || null}
              isPos={isPos}
              scrubIdx={scrubIdx}
              clipW={clipW}
              onScrub={handleScrub}
              onScrubEnd={handleScrubEnd}
            />
          )}
        </div>

        {/* P&L card */}
        {pnlPct !== null ? (
          <div className={`asd-pnl ${pnlPct >= 0 ? 'pos' : 'neg'}`}>
            <div className="asd-pnl-top">
              <span className="asd-pnl-since">Desde inserção{insertedDate ? ` · ${insertedDate}` : ''}</span>
              <span className={`asd-pnl-pct ${pnlPct >= 0 ? 'pos' : 'neg'}`}>{fmtPct(pnlPct)}</span>
            </div>
            <div className="asd-pnl-cols">
              <div className="asd-pnl-col">
                <span className="asd-pnl-lbl">Custo total</span>
                <span className="asd-pnl-val">{fmtInt(costBasis)}€</span>
                <span className="asd-pnl-sub">a {fmtPrice(purchase)}€/{priceLabel}</span>
              </div>
              <div className="asd-pnl-sep" />
              <div className="asd-pnl-col right">
                <span className="asd-pnl-lbl">Valor atual</span>
                <span className="asd-pnl-val">{fmtInt(marketVal)}€</span>
                <span className={`asd-pnl-gain ${pnlAbs >= 0 ? 'pos' : 'neg'}`}>
                  {pnlAbs >= 0 ? '+' : ''}{fmtInt(pnlAbs)}€
                </span>
              </div>
            </div>
          </div>
        ) : !purchase && hasPrice ? (
          <div className="asd-pnl-hint">
            Adiciona o preço de compra para ver o teu ganho/perda.
          </div>
        ) : null}

        {/* Stats */}
        <div className="asd-stats">
          <div className="asd-stat">
            <span className="asd-sl">Quantidade</span>
            <span className="asd-sv">{qty} {qtyLabel}</span>
          </div>
          <div className="asd-stat">
            <span className="asd-sl">Valor total</span>
            <span className="asd-sv">{hasPrice ? `${fmtInt(marketVal)}€` : '—'}</span>
          </div>
          {purchase > 0 && (
            <div className="asd-stat">
              <span className="asd-sl">Preço compra</span>
              <span className="asd-sv">{fmtPrice(purchase)}€</span>
            </div>
          )}
          {insertedDate && (
            <div className="asd-stat">
              <span className="asd-sl">Adicionado em</span>
              <span className="asd-sv">{insertedDate}</span>
            </div>
          )}
        </div>

        {/* Edit button */}
        <button className="asd-edit-btn" onClick={() => { onClose(); setTimeout(onEdit, 180); }}>
          Editar ativo
        </button>

      </div>
    </CosmosSheet>
  );
}
