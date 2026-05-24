import React from 'react';

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

export default Sparkline;
