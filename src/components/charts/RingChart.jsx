/**
 * RingChart.jsx — Animated SVG donut/ring chart.
 * Usage: <RingChart pct={68} color="var(--cosmos-income)" size={120} stroke={10} label="68%" sublabel="gasto" />
 */
import React, { useEffect, useRef, useState } from 'react';

const RingChart = ({
  pct = 0,           // 0-100
  color = 'var(--cosmos-accent)',
  trackColor = 'rgba(255,255,255,0.06)',
  size = 120,
  stroke = 10,
  label,             // centre primary text
  sublabel,          // centre secondary text
  labelSize = 18,
  sublabelSize = 11,
  duration = 900,    // animation duration ms
}) => {
  const [animPct, setAnimPct] = useState(0);
  const rafRef  = useRef(null);
  const fromRef = useRef(0);

  useEffect(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    const from  = fromRef.current;
    const to    = Math.min(100, Math.max(0, pct));
    const start = Date.now();
    const tick  = () => {
      const p     = Math.min((Date.now() - start) / duration, 1);
      const eased = 1 - (1 - p) ** 3;
      const curr  = from + (to - from) * eased;
      setAnimPct(curr);
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
      else fromRef.current = to;
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [pct, duration]);

  const r          = (size - stroke) / 2;
  const cx         = size / 2;
  const cy         = size / 2;
  const circumf    = 2 * Math.PI * r;
  const dashOffset = circumf * (1 - animPct / 100);

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', display: 'block' }}>
        {/* Track */}
        <circle
          cx={cx} cy={cy} r={r}
          fill="none"
          stroke={trackColor}
          strokeWidth={stroke}
        />
        {/* Progress */}
        <circle
          cx={cx} cy={cy} r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumf}
          strokeDashoffset={dashOffset}
          style={{ transition: 'none', filter: `drop-shadow(0 0 6px ${color}66)` }}
        />
      </svg>
      {/* Centre label */}
      {(label || sublabel) && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          gap: 1,
        }}>
          {label && (
            <span style={{
              fontSize: labelSize,
              fontWeight: 700,
              color: 'var(--cosmos-text-1)',
              letterSpacing: '-0.02em',
              lineHeight: 1,
              fontVariantNumeric: 'tabular-nums',
            }}>
              {label}
            </span>
          )}
          {sublabel && (
            <span style={{
              fontSize: sublabelSize,
              color: 'var(--cosmos-text-3)',
              fontWeight: 400,
            }}>
              {sublabel}
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default RingChart;
