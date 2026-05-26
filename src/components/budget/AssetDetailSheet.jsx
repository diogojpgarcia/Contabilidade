import React, { useState, useEffect, useRef, useCallback, useLayoutEffect } from 'react';
import CosmosSheet from '../cosmos/CosmosSheet';
import { fetchPeriodHistory } from '../../utils/assetPrice';

// ─── SVG chart constants ──────────────────────────────────────────────────────
const W = 390, H = 185, PT = 18, PB = 18;
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
    (i / (prices.length - 1)) * W,
    PT + ((mx - v) / rng) * (H - PT - PB),
  ]);
}

// Linearly interpolate exact [x,y] on pts at a fractional ratio 0‒1
function lerpPt(pts, ratio) {
  const fi = Math.max(0, Math.min(1, ratio)) * (pts.length - 1);
  const lo = Math.floor(fi);
  const hi = Math.min(pts.length - 1, lo + 1);
  const t  = fi - lo;
  return [
    pts[lo][0] * (1 - t) + pts[hi][0] * t,
    pts[lo][1] * (1 - t) + pts[hi][1] * t,
  ];
}

// ─── Formatters ───────────────────────────────────────────────────────────────
const fmtPrice = (n) => {
  if (n === null || n === undefined || isNaN(n)) return '—';
  return n.toLocaleString('pt-PT', {
    minimumFractionDigits: n < 1 ? 4 : 2,
    maximumFractionDigits: n < 1 ? 6 : 2,
  });
};
const fmtPct = (n) => (n >= 0 ? '+' : '') + Math.abs(n).toFixed(2) + '%';
const fmtAbs = (n) => (n >= 0 ? '+' : '−') + fmtPrice(Math.abs(n));
const fmtInt = (n) => Math.round(n).toLocaleString('pt-PT');

// ─── Helper: set cx/cy on an SVG element ref ──────────────────────────────────
function setXY(ref, cx, cy) {
  if (!ref.current) return;
  ref.current.setAttribute('cx', cx);
  ref.current.setAttribute('cy', cy);
}
function show(ref) { ref.current && ref.current.setAttribute('visibility', 'visible'); }
function hide(ref) { ref.current && ref.current.setAttribute('visibility', 'hidden'); }
function setAttr(ref, attr, val) { ref.current && ref.current.setAttribute(attr, val); }

// ─── PremiumChart ─────────────────────────────────────────────────────────────
//
//  Two separate RAF loops:
//    1. animLoop  – one-shot draw-in (stops itself when done)
//    2. scrubLoop – runs only while finger/mouse is down (stops on pointerUp)
//
//  ALL cursor DOM writes go through individual element refs — zero querySelectorAll
//  in the hot path.  React state is only updated when the snapped price index
//  actually changes, so renders are rare during scrubbing.
//
const PremiumChart = React.memo(({ prices, isPos, animKey, onScrubChange, onScrubEnd }) => {
  const color    = isPos ? '#30d158' : '#ff453a';
  const linePath = catmullRomPath(toPts(prices || []));

  // ptsRef always holds the latest computed points — the scrub RAF loop reads it
  const ptsRef  = useRef([]);
  useLayoutEffect(() => { ptsRef.current = toPts(prices || []); }, [prices]);

  // ── Individual element refs (no querySelectorAll in hot path) ──────────────
  const activeRectRef    = useRef(null);  // clipPath rect for animated/active line
  const dimRectRef       = useRef(null);  // clipPath rect for dimmed line
  const dimPathRef       = useRef(null);  // dimmed line path
  const spotClipRectRef  = useRef(null);  // clipPath rect for spotlight
  const spotPathRef      = useRef(null);  // bright spotlight line segment
  const cursorLineRef    = useRef(null);  // vertical white cursor line
  const cursorOuter      = useRef(null);  // outermost glow ring
  const cursorInner      = useRef(null);  // inner glow ring
  const cursorDot        = useRef(null);  // solid filled dot
  const endOuter         = useRef(null);  // resting end-dot outer ring
  const endDot           = useRef(null);  // resting end-dot solid

  // ── RAF handles ────────────────────────────────────────────────────────────
  const animRAF  = useRef(null);
  const scrubRAF = useRef(null);

  // ── Scrub state (never causes React renders) ──────────────────────────────
  const pendingRatioRef = useRef(null);
  const isScrubbingRef  = useRef(false);
  const lastIdxRef      = useRef(-1);

  // ── Draw-in animation (re-runs each time animKey changes) ─────────────────
  useEffect(() => {
    const pts = ptsRef.current;
    if (!pts.length) return;

    // Cancel any running loops
    if (animRAF.current)  cancelAnimationFrame(animRAF.current);
    if (scrubRAF.current) cancelAnimationFrame(scrubRAF.current);
    animRAF.current  = null;
    scrubRAF.current = null;

    // Reset scrub state
    isScrubbingRef.current  = false;
    pendingRatioRef.current = null;
    lastIdxRef.current      = -1;

    // Reset all element visibility
    hide(cursorOuter); hide(cursorInner); hide(cursorDot);
    hide(cursorLineRef); hide(dimPathRef); hide(spotPathRef);
    hide(endOuter); hide(endDot);
    setAttr(activeRectRef, 'width', '0');
    setAttr(dimRectRef, 'x', String(W)); setAttr(dimRectRef, 'width', '0');

    const endPt   = pts[pts.length - 1];
    const DURATION = 520;
    const start   = performance.now();

    const animLoop = (now) => {
      const t    = Math.min(1, (now - start) / DURATION);
      const ease = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      setAttr(activeRectRef, 'width', (ease * W).toFixed(1));

      if (t < 1) {
        animRAF.current = requestAnimationFrame(animLoop);
      } else {
        // Animation complete — show resting end dot
        animRAF.current = null;
        setAttr(activeRectRef, 'width', String(W));
        setXY(endOuter, endPt[0].toFixed(1), endPt[1].toFixed(1));
        setXY(endDot,   endPt[0].toFixed(1), endPt[1].toFixed(1));
        show(endOuter); show(endDot);
        // Loop stops — no more RAF until scrub starts
      }
    };

    animRAF.current = requestAnimationFrame(animLoop);
    return () => {
      if (animRAF.current)  cancelAnimationFrame(animRAF.current);
      if (scrubRAF.current) cancelAnimationFrame(scrubRAF.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animKey]);

  // ── Scrub RAF loop (runs only while pointer is down) ─────────────────────
  const startScrubLoop = useCallback(() => {
    if (scrubRAF.current) return;           // already running

    // Hide resting end dot as soon as scrub begins
    hide(endOuter); hide(endDot);

    const loop = () => {
      if (!isScrubbingRef.current) {
        // Pointer released — restore state and stop
        scrubRAF.current = null;

        hide(cursorOuter); hide(cursorInner); hide(cursorDot);
        hide(cursorLineRef); hide(dimPathRef); hide(spotPathRef);
        setAttr(activeRectRef, 'width', String(W));
        setAttr(dimRectRef, 'x', String(W)); setAttr(dimRectRef, 'width', '0');

        // Restore resting end dot
        const pts   = ptsRef.current;
        const endPt = pts[pts.length - 1];
        setXY(endOuter, endPt[0].toFixed(1), endPt[1].toFixed(1));
        setXY(endDot,   endPt[0].toFixed(1), endPt[1].toFixed(1));
        show(endOuter); show(endDot);
        return;                             // stop — no requestAnimationFrame
      }

      const ratio = pendingRatioRef.current;
      if (ratio !== null) {
        const pts      = ptsRef.current;
        const [cx, cy] = lerpPt(pts, ratio);
        const cxS      = cx.toFixed(1);
        const cyS      = cy.toFixed(1);

        // Active clip: 0 → cursor
        setAttr(activeRectRef, 'width', cxS);

        // Dim clip: cursor → W
        setAttr(dimRectRef, 'x', cxS);
        setAttr(dimRectRef, 'width', (W - cx).toFixed(1));
        show(dimPathRef);

        // Spotlight clip: cursor ± 28 px
        const SPOT = 28;
        setAttr(spotClipRectRef, 'x', (cx - SPOT).toFixed(1));
        show(spotPathRef);

        // Cursor vertical line
        if (cursorLineRef.current) {
          cursorLineRef.current.setAttribute('x1', cxS);
          cursorLineRef.current.setAttribute('x2', cxS);
        }
        show(cursorLineRef);

        // Cursor glow rings + dot
        setXY(cursorOuter, cxS, cyS);
        setXY(cursorInner, cxS, cyS);
        setXY(cursorDot,   cxS, cyS);
        show(cursorOuter); show(cursorInner); show(cursorDot);

        // Notify React only when snapped index changes → rare renders
        const snapIdx = Math.min(pts.length - 1, Math.max(0, Math.round(ratio * (pts.length - 1))));
        if (snapIdx !== lastIdxRef.current) {
          lastIdxRef.current = snapIdx;
          onScrubChange(snapIdx, (prices || [])[snapIdx]);
        }
      }

      scrubRAF.current = requestAnimationFrame(loop);
    };

    scrubRAF.current = requestAnimationFrame(loop);
  }, [onScrubChange, prices]);

  // ── Pointer event handlers ────────────────────────────────────────────────
  const getRatio = (clientX, el) => {
    const r = el.getBoundingClientRect();
    return Math.max(0, Math.min(1, (clientX - r.left) / r.width));
  };

  const onDown = useCallback((e) => {
    isScrubbingRef.current  = true;
    pendingRatioRef.current = getRatio(e.clientX, e.currentTarget);
    startScrubLoop();
  }, [startScrubLoop]);

  const onMove = useCallback((e) => {
    if (!isScrubbingRef.current) return;
    pendingRatioRef.current = getRatio(e.clientX, e.currentTarget);
  }, []);

  const onUp = useCallback((e) => {
    isScrubbingRef.current  = false;
    pendingRatioRef.current = null;
    lastIdxRef.current      = -1;
    onScrubEnd();
    // scrubLoop will detect isScrubbingRef=false on next frame and stop itself
  }, [onScrubEnd]);

  const onTouchStart = useCallback((e) => {
    e.preventDefault();
    isScrubbingRef.current  = true;
    pendingRatioRef.current = getRatio(e.touches[0].clientX, e.currentTarget);
    startScrubLoop();
  }, [startScrubLoop]);

  const onTouchMove = useCallback((e) => {
    e.preventDefault();
    pendingRatioRef.current = getRatio(e.touches[0].clientX, e.currentTarget);
  }, []);

  if (!prices || prices.length < 2) {
    return <div className="asd-chart-empty">Sem dados de histórico</div>;
  }
  const mn = Math.min(...prices), mx = Math.max(...prices);
  const SPOT = 28;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className="asd-svg"
      onMouseDown={onDown}
      onMouseMove={onMove}
      onMouseLeave={onUp}
      onMouseUp={onUp}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onUp}
    >
      <defs>
        {/* Tight glow filter for cursor dot — matches Revolut */}
        <filter id="asd-glow" x="-150%" y="-150%" width="400%" height="400%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        {/* Wider glow for the intersection halo */}
        <filter id="asd-halo" x="-200%" y="-200%" width="500%" height="500%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>

        {/* Active (draw-in) clip */}
        <clipPath id="asd-ca">
          <rect ref={activeRectRef} x="0" y="0" width="0" height={H} />
        </clipPath>

        {/* Dim clip — after cursor */}
        <clipPath id="asd-cd">
          <rect ref={dimRectRef} x={W} y="0" width="0" height={H} />
        </clipPath>

        {/* Spotlight clip — ±SPOT px around cursor */}
        <clipPath id="asd-cs">
          <rect ref={spotClipRectRef} x="0" y="0" width={SPOT * 2} height={H} />
        </clipPath>
      </defs>

      {/* Dimmed line after cursor — Revolut usa opacidade ~25% */}
      <path
        ref={dimPathRef}
        d={linePath}
        fill="none"
        stroke={color}
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.22"
        clipPath="url(#asd-cd)"
        visibility="hidden"
      />

      {/* Active (colored) line — draw-in animates this */}
      <path
        d={linePath}
        fill="none"
        stroke={color}
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        clipPath="url(#asd-ca)"
      />

      {/* Spotlight: reservado (desativado — o glow fica no dot como no Revolut) */}
      <path
        ref={spotPathRef}
        d={linePath}
        fill="none"
        stroke="transparent"
        strokeWidth="0"
        visibility="hidden"
      />

      {/* Price scale labels */}
      <text x={W - 6} y={PT + 2}
        textAnchor="end" fontSize="10"
        fill="rgba(255,255,255,0.3)"
        fontFamily="-apple-system,'SF Pro Text',sans-serif"
        dominantBaseline="hanging"
      >{fmtPrice(mx)}</text>
      <text x={W - 6} y={H - PB - 2}
        textAnchor="end" fontSize="10"
        fill="rgba(255,255,255,0.3)"
        fontFamily="-apple-system,'SF Pro Text',sans-serif"
        dominantBaseline="auto"
      >{fmtPrice(mn)}</text>

      {/* Full-height cursor line — bright white like Revolut */}
      <line
        ref={cursorLineRef}
        x1="0" x2="0" y1="0" y2={H}
        stroke="rgba(255,255,255,0.88)"
        strokeWidth="1.5"
        visibility="hidden"
      />

      {/* Cursor dot — Revolut style: halo + tight glow + solid dot */}
      {/* Outer halo (large, very soft) */}
      <circle ref={cursorOuter} cx="0" cy="0" r="14" fill={color} opacity="0.13" filter="url(#asd-halo)" visibility="hidden" />
      {/* Inner ring */}
      <circle ref={cursorInner} cx="0" cy="0" r="8"  fill={color} opacity="0.28" visibility="hidden" />
      {/* Solid dot */}
      <circle ref={cursorDot}   cx="0" cy="0" r="4.5"
        fill={color}
        stroke="rgba(255,255,255,0.95)"
        strokeWidth="2"
        filter="url(#asd-glow)"
        visibility="hidden"
      />

      {/* Resting end dot */}
      <circle ref={endOuter} cx="0" cy="0" r="9"   fill={color} opacity="0.18" visibility="hidden" />
      <circle ref={endDot}   cx="0" cy="0" r="4.5"
        fill={color}
        stroke="var(--cosmos-bg,#0c0e13)"
        strokeWidth="2"
        visibility="hidden"
      />
    </svg>
  );
});

// ─── AssetDetailSheet ─────────────────────────────────────────────────────────
export default function AssetDetailSheet({
  open, onClose, item, assetKey, marketPrice, history, onEdit,
}) {
  const [period,     setPeriod]     = useState('1D');
  const [periodData, setPeriodData] = useState(null);
  const [loading,    setLoading]    = useState(false);
  const [animKey,    setAnimKey]    = useState(0);
  const [scrubIdx,   setScrubIdx]   = useState(null);
  const [scrubPrice, setScrubPrice] = useState(null);

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

  // ── Fetch period data ──────────────────────────────────────────────────────
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

  // ── Trigger draw-in animation whenever new data arrives ───────────────────
  useEffect(() => {
    if (!open || !periodData) return;
    setScrubIdx(null);
    setScrubPrice(null);
    setAnimKey(k => k + 1);
  }, [periodData, open]);

  // ── Scrub callbacks (called by PremiumChart only when index changes) ───────
  const handleScrubChange = useCallback((idx, price) => {
    setScrubIdx(idx);
    setScrubPrice(price);
  }, []);

  const handleScrubEnd = useCallback(() => {
    setScrubIdx(null);
    setScrubPrice(null);
  }, []);

  // ── Display values ─────────────────────────────────────────────────────────
  const prices    = periodData?.prices;
  const labels    = periodData?.labels;
  const dispPrice = scrubPrice ?? marketPrice;
  const basePrice = prices?.[0];

  const periodAbsDelta = prices && basePrice != null ? dispPrice - basePrice : null;
  const periodPctDelta = prices && basePrice ? ((dispPrice - basePrice) / basePrice) * 100 : null;
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

        {/* Price */}
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
          {timeLabel && <div className="asd-time-lbl">{timeLabel}</div>}
        </div>

        {/* Chart */}
        <div className="asd-chart-wrap">
          {loading ? (
            <div className="asd-chart-loading"><span className="asd-spinner" /></div>
          ) : (
            <PremiumChart
              prices={prices}
              isPos={chartIsPos}
              animKey={animKey}
              onScrubChange={handleScrubChange}
              onScrubEnd={handleScrubEnd}
            />
          )}
        </div>

        {/* Period selector — below chart */}
        <div className="asd-periods">
          {PERIODS.map(p => (
            <button
              key={p}
              className={`asd-pbtn${period === p ? ' active' : ''}`}
              onClick={() => { if (p !== period) { setPeriod(p); setPeriodData(null); } }}
            >{p}</button>
          ))}
        </div>

        {/* P&L */}
        {pnlPct !== null ? (
          <div className={`asd-pnl ${pnlPct >= 0 ? 'pos' : 'neg'}`}>
            <div className="asd-pnl-top">
              <span className="asd-pnl-since">Desde {insertedDate ?? 'insercao'}</span>
              <span className={`asd-pnl-pct ${pnlPct >= 0 ? 'pos' : 'neg'}`}>{fmtPct(pnlPct)}</span>
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
                  {pnlAbs >= 0 ? '+' : '−'}{fmtInt(Math.abs(pnlAbs))} &euro;
                </span>
              </div>
            </div>
          </div>
        ) : !purchase && hasPrice ? (
          <div className="asd-pnl-hint">Adiciona o preco de compra para ver o teu ganho/perda.</div>
        ) : null}

        {/* Stats */}
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
              <span className="asd-sv">{fmtPrice(purchase)} &euro;</span>
            </div>
          )}
          {insertedDate && (
            <div className="asd-stat">
              <span className="asd-sl">Adicionado em</span>
              <span className="asd-sv">{insertedDate}</span>
            </div>
          )}
        </div>

        {/* Edit */}
        <button className="asd-edit-btn" onClick={() => { onClose(); setTimeout(onEdit, 180); }}>
          Editar ativo
        </button>

      </div>
    </CosmosSheet>
  );
}
