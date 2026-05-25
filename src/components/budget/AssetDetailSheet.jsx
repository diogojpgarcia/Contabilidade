import React, { useState, useEffect, useRef, useCallback } from 'react';
import CosmosSheet from '../cosmos/CosmosSheet';
import { fetchPeriodHistory } from '../../utils/assetPrice';

// ─── SVG chart constants ──────────────────────────────────────────────────────
const W = 390, H = 185, PL = 0, PR = 0, PT = 18, PB = 18;

const PERIODS = ['1D', '1S', '1M', '6M', '1A', '5A', 'Tudo'];

// ─── Catmull-Rom smooth path ──────────────────────────────────────────────────
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

function toPts(prices) {
  if (!prices || prices.length < 2) return [];
  const mn = Math.min(...prices), mx = Math.max(...prices);
  const rng = mx === mn ? mx * 0.08 || 20 : mx - mn;
  return prices.map((v, i) => [
    PL + (i / (prices.length - 1)) * (W - PL - PR),
    PT + ((mx - v) / rng) * (H - PT - PB),
  ]);
}

// ─── Formatters ───────────────────────────────────────────────────────────────
const fmtPrice = (n) => {
  if (n === null || n === undefined || isNaN(n)) return '—';
  return n.toLocaleString('pt-PT', {
    minimumFractionDigits: n < 1 ? 4 : 2,
    maximumFractionDigits: n < 1 ? 6 : 2,
  });
};
const fmtPct  = (n) => (n >= 0 ? '+' : '') + Math.abs(n).toFixed(2) + '%';
const fmtAbs  = (n) => (n >= 0 ? '+' : '−') + fmtPrice(Math.abs(n));
const fmtInt  = (n) => Math.round(n).toLocaleString('pt-PT');

// ─── Premium Chart ────────────────────────────────────────────────────────────
const PremiumChart = React.memo(({
  prices, isPos, scrubIdx, clipW, onScrub, onScrubEnd,
}) => {
  const pts = toPts(prices);
  if (pts.length < 2) return (
    <div className="asd-chart-empty">Sem dados de histórico</div>
  );

  const linePath   = catmullRomPath(pts);
  const color      = isPos ? '#30d158' : '#ff453a';
  const scrubPt    = scrubIdx !== null && pts[scrubIdx] ? pts[scrubIdx] : null;
  const endPt      = pts[pts.length - 1];
  const isAnimDone = clipW >= W;

  // X split: during animation = clipW; during scrub = scrubPt[0]
  const splitX = scrubPt ? scrubPt[0] : Math.min(clipW, W);

  // Price scale: max/min
  const mn  = Math.min(...prices), mx = Math.max(...prices);
  const yTop = PT;       // where max price sits
  const yBot = H - PB;   // where min price sits

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className="asd-svg"
      onMouseDown={e  => { const r = e.currentTarget.getBoundingClientRect(); onScrub((e.clientX - r.left) / r.width); }}
      onMouseMove={e  => { if (e.buttons) { const r = e.currentTarget.getBoundingClientRect(); onScrub((e.clientX - r.left) / r.width); } }}
      onMouseLeave={onScrubEnd}
      onMouseUp={onScrubEnd}
      onTouchStart={e => { e.preventDefault(); const r = e.currentTarget.getBoundingClientRect(); onScrub((e.touches[0].clientX - r.left) / r.width); }}
      onTouchMove={e  => { e.preventDefault(); const r = e.currentTarget.getBoundingClientRect(); onScrub((e.touches[0].clientX - r.left) / r.width); }}
      onTouchEnd={onScrubEnd}
    >
      <defs>
        {/* Clip for animated draw-in and active portion */}
        <clipPath id="asd-clip-active">
          <rect x="0" y="0" width={splitX.toFixed(1)} height={H} />
        </clipPath>
        {/* Clip for dimmed portion (after cursor / after animation) */}
        <clipPath id="asd-clip-dim">
          <rect x={splitX.toFixed(1)} y="0" width={W} height={H} />
        </clipPath>
      </defs>

      {/* Active line segment */}
      <path
        d={linePath}
        fill="none"
        stroke={color}
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        clipPath="url(#asd-clip-active)"
      />

      {/* Dimmed portion — visible only when scrubbing (after animation finishes) */}
      {(scrubPt || !isAnimDone) && (
        <path
          d={linePath}
          fill="none"
          stroke={isAnimDone ? 'rgba(255,255,255,0.18)' : 'none'}
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          clipPath="url(#asd-clip-dim)"
        />
      )}

      {/* Price scale labels on right */}
      <text
        x={W - 6}
        y={yTop + 2}
        textAnchor="end"
        fontSize="10"
        fill="rgba(255,255,255,0.35)"
        fontFamily="-apple-system, 'SF Pro Text', sans-serif"
        dominantBaseline="hanging"
      >
        {fmtPrice(mx)}
      </text>
      <text
        x={W - 6}
        y={yBot - 2}
        textAnchor="end"
        fontSize="10"
        fill="rgba(255,255,255,0.35)"
        fontFamily="-apple-system, 'SF Pro Text', sans-serif"
        dominantBaseline="auto"
      >
        {fmtPrice(mn)}
      </text>

      {/* Cursor: full-height white line + glow dot */}
      {scrubPt && (
        <>
          {/* Vertical cursor line */}
          <line
            x1={scrubPt[0].toFixed(1)}
            x2={scrubPt[0].toFixed(1)}
            y1="0"
            y2={H}
            stroke="rgba(255,255,255,0.55)"
            strokeWidth="1"
          />
          {/* Glow rings */}
          <circle cx={scrubPt[0].toFixed(1)} cy={scrubPt[1].toFixed(1)} r="14" fill={color} opacity="0.08" />
          <circle cx={scrubPt[0].toFixed(1)} cy={scrubPt[1].toFixed(1)} r="9"  fill={color} opacity="0.15" />
          {/* Solid dot */}
          <circle
            cx={scrubPt[0].toFixed(1)}
            cy={scrubPt[1].toFixed(1)}
            r="5"
            fill={color}
            stroke="var(--cosmos-bg, #0c0e13)"
            strokeWidth="2"
          />
        </>
      )}

      {/* End-of-line dot when animation is complete and not scrubbing */}
      {isAnimDone && !scrubPt && (
        <>
          <circle cx={endPt[0].toFixed(1)} cy={endPt[1].toFixed(1)} r="9"  fill={color} opacity="0.15" />
          <circle
            cx={endPt[0].toFixed(1)}
            cy={endPt[1].toFixed(1)}
            r="4.5"
            fill={color}
            stroke="var(--cosmos-bg, #0c0e13)"
            strokeWidth="2"
          />
        </>
      )}
    </svg>
  );
});

// ─── Main component ───────────────────────────────────────────────────────────
export default function AssetDetailSheet({
  open, onClose, item, assetKey, marketPrice, history, onEdit,
}) {
  const [period,     setPeriod]     = useState('1D');
  const [periodData, setPeriodData] = useState(null);
  const [loading,    setLoading]    = useState(false);
  const [clipW,      setClipW]      = useState(0);
  const [scrubIdx,   setScrubIdx]   = useState(null);
  const [scrubPrice, setScrubPrice] = useState(null);
  const animRef = useRef(null);

  if (!item) return null;

  const isStock  = assetKey === 'stocks' || assetKey === 'etfs';
  const type     = isStock ? 'stock' : 'crypto';
  const sym      = isStock ? item.ticker : (item.coin ?? '');
  const qty      = parseFloat(item.qty)           || 0;
  const purchase = parseFloat(item.purchasePrice) || 0;
  const hasPrice = marketPrice > 0;

  const marketVal = qty * marketPrice;
  const costBasis = qty * purchase;
  const pnlAbs    = purchase > 0 && hasPrice ? marketVal - costBasis : null;
  const pnlPct    = purchase > 0 && hasPrice ? ((marketPrice - purchase) / purchase) * 100 : null;

  // Overall direction for chart color
  const chartIsPos = (pnlPct !== null
    ? pnlPct
    : (periodData?.prices?.length >= 2
        ? periodData.prices[periodData.prices.length - 1] - periodData.prices[0]
        : 0)
  ) >= 0;

  const insertedDate = item.insertedAt
    ? new Date(item.insertedAt).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' })
    : null;


  const qtyLabel   = assetKey === 'etfs' ? 'unidades' : isStock ? 'acoes' : 'moedas';
  const priceLabel = assetKey === 'etfs' ? 'unidade'  : isStock ? 'acao'  : 'moeda';

  // Fetch period data
  useEffect(() => {
    if (!open) return;
    let cancelled = false;

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

  // Animate chart line draw-in
  useEffect(() => {
    if (!open || !periodData) return;
    if (animRef.current) cancelAnimationFrame(animRef.current);
    setClipW(0);
    setScrubIdx(null);
    setScrubPrice(null);

    const duration = 520;
    const start = performance.now();
    const step = (now) => {
      const t    = Math.min(1, (now - start) / duration);
      const ease = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      setClipW(ease * W);
      if (t < 1) animRef.current = requestAnimationFrame(step);
      else        setClipW(W);
    };
    animRef.current = requestAnimationFrame(step);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [periodData, open]);

  // Scrub handlers
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

  // Displayed values
  const prices     = periodData?.prices;
  const labels     = periodData?.labels;
  const dispPrice  = scrubPrice ?? marketPrice;
  const basePrice  = prices?.[0];

  const periodAbsDelta = prices && basePrice != null ? dispPrice - basePrice : null;
  const periodPctDelta = prices && basePrice        ? ((dispPrice - basePrice) / basePrice) * 100 : null;
  const deltaIsPos     = (periodPctDelta ?? 0) >= 0;

  const scrubLabel = scrubIdx !== null && labels ? labels[scrubIdx] : null;
  const lastLabel  = labels ? labels[labels.length - 1] : null;
  const timeLabel  = scrubLabel ?? (period === '1D' ? lastLabel : null);

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

        {/* Price display */}
        <div className="asd-price-block">
          <div className="asd-price">{fmtPrice(dispPrice)} &euro;</div>
          <div className="asd-delta-row">
            {periodAbsDelta !== null && (
              <span className={`asd-delta-abs ${deltaIsPos ? 'pos' : 'neg'}`}>
                {fmtAbs(periodAbsDelta)} &euro;
              </span>
            )}
            {periodPctDelta !== null && (
              <span className={`asd-delta-pct ${deltaIsPos ? 'pos' : 'neg'}`}>
                {deltaIsPos ? '▲' : '▼'} {Math.abs(periodPctDelta).toFixed(2)}%
              </span>
            )}
          </div>
          {timeLabel && (
            <div className="asd-time-lbl">{timeLabel}</div>
          )}
        </div>

        {/* Chart */}
        <div className="asd-chart-wrap">
          {loading ? (
            <div className="asd-chart-loading"><span className="asd-spinner" /></div>
          ) : (
            <PremiumChart
              prices={prices}
              isPos={chartIsPos}
              scrubIdx={scrubIdx}
              clipW={clipW}
              onScrub={handleScrub}
              onScrubEnd={handleScrubEnd}
            />
          )}
        </div>

        {/* Period selector - BELOW chart */}
        <div className="asd-periods">
          {PERIODS.map(p => (
            <button
              key={p}
              className={`asd-pbtn${period === p ? ' active' : ''}`}
              onClick={() => { if (p !== period) { setPeriod(p); setPeriodData(null); } }}
            >{p}</button>
          ))}
        </div>

        {/* P&L card */}
        {pnlPct !== null ? (
          <div className={`asd-pnl ${pnlPct >= 0 ? 'pos' : 'neg'}`}>
            <div className="asd-pnl-top">
              <span className="asd-pnl-since">
                Desde {insertedDate ? insertedDate : 'insercao'}
              </span>
              <span className={`asd-pnl-pct ${pnlPct >= 0 ? 'pos' : 'neg'}`}>
                {fmtPct(pnlPct)}
              </span>
            </div>
            <div className="asd-pnl-cols">
              <div className="asd-pnl-col">
                <span className="asd-pnl-lbl">Custo total</span>
                <span className="asd-pnl-val">{fmtInt(costBasis)} &euro;</span>
                <span className="asd-pnl-sub">a {fmtPrice(purchase)} &euro;/{priceLabel}</span>
              </div>
              <div className="asd-pnl-sep" />
              <div className="asd-pnl-col right">
                <span className="asd-pnl-lbl">Valor atual</span>
                <span className="asd-pnl-val">{fmtInt(marketVal)} &euro;</span>
                <span className={`asd-pnl-gain ${pnlAbs >= 0 ? 'pos' : 'neg'}`}>
                  {pnlAbs >= 0 ? '+' : '-'}{fmtInt(Math.abs(pnlAbs))} &euro;
                </span>
              </div>
            </div>
          </div>
        ) : !purchase && hasPrice ? (
          <div className="asd-pnl-hint">
            Adiciona o preco de compra para ver o teu ganho/perda.
          </div>
        ) : null}

        {/* Stats grid */}
        <div className="asd-stats">
          <div className="asd-stat">
            <span className="asd-sl">Quantidade</span>
            <span className="asd-sv">{qty} {qtyLabel}</span>
          </div>
          <div className="asd-stat">
            <span className="asd-sl">Valor total</span>
            <span className="asd-sv">{hasPrice ? `${fmtInt(marketVal)} €` : '—'}</span>
          </div>
          {purchase > 0 && (
            <div className="asd-stat">
              <span className="asd-sl">Preco compra</span>
              <span className="asd-sv">{fmtPrice(purchase)} €</span>
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
        <button
          className="asd-edit-btn"
          onClick={() => { onClose(); setTimeout(onEdit, 180); }}
        >
          Editar ativo
        </button>

      </div>
    </CosmosSheet>
  );
}
