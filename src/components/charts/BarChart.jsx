/**
 * BarChart.jsx — Animated monthly income/expense bar chart.
 * Replaces the SVG line chart in StatsOverview.
 */
import React, { useEffect, useRef, useState } from 'react';

const BarChart = ({ data = [], height = 80 }) => {
  const [animPct, setAnimPct] = useState(0);
  const [tooltip, setTooltip] = useState(null); // { idx, x, y }
  const rafRef = useRef(null);

  useEffect(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    setAnimPct(0);
    const start = Date.now();
    const tick = () => {
      const p = Math.min((Date.now() - start) / 700, 1);
      const eased = 1 - (1 - p) ** 3;
      setAnimPct(eased);
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [data]);

  if (!data.length) return null;

  const maxVal = Math.max(...data.map(d => Math.max(d.income || 0, d.expenses || 0)), 1);
  const barW   = 10;
  const gap    = 6;
  const groupW = barW * 2 + gap;
  const groupGap = 8;
  const totalW = data.length * (groupW + groupGap) - groupGap;
  const padX   = 8;
  const chartW = totalW + padX * 2;
  const chartH = height;
  const padY   = 6;
  const usableH = chartH - padY * 2 - 14; // 14 for month labels

  const barH = (val) => Math.max(2, (val / maxVal) * usableH * animPct);
  const barY = (val) => padY + usableH - barH(val);

  return (
    <div style={{ position: 'relative', overflowX: 'auto', overflowY: 'hidden', scrollbarWidth: 'none' }}>
      <svg
        width={chartW}
        height={chartH}
        viewBox={`0 0 ${chartW} ${chartH}`}
        style={{ display: 'block', minWidth: '100%' }}
      >
        {data.map((d, i) => {
          const x = padX + i * (groupW + groupGap);
          const isLast = i === data.length - 1;
          return (
            <g key={i}>
              {/* Income bar */}
              <rect
                x={x}
                y={barY(d.income || 0)}
                width={barW}
                height={barH(d.income || 0)}
                rx={3}
                fill="var(--cosmos-income)"
                opacity={tooltip && tooltip.idx !== i ? 0.4 : 0.85}
                style={{ cursor: 'pointer' }}
                onPointerDown={() => setTooltip(tooltip?.idx === i ? null : { idx: i, income: d.income, expenses: d.expenses })}
              />
              {/* Expense bar */}
              <rect
                x={x + barW + gap}
                y={barY(d.expenses || 0)}
                width={barW}
                height={barH(d.expenses || 0)}
                rx={3}
                fill="var(--cosmos-expense)"
                opacity={tooltip && tooltip.idx !== i ? 0.4 : 0.85}
                style={{ cursor: 'pointer' }}
                onPointerDown={() => setTooltip(tooltip?.idx === i ? null : { idx: i, income: d.income, expenses: d.expenses })}
              />
              {/* Month label */}
              <text
                x={x + barW + gap / 2}
                y={chartH - 2}
                textAnchor="middle"
                fontSize={9}
                fill={isLast ? 'var(--cosmos-accent)' : 'var(--cosmos-text-3)'}
                fontWeight={isLast ? 600 : 400}
              >
                {d.month}
              </text>
              {/* Current month indicator dot */}
              {isLast && (
                <circle cx={x + barW + gap / 2} cy={chartH - 14} r={2} fill="var(--cosmos-accent)" />
              )}
            </g>
          );
        })}
      </svg>

      {/* Tooltip */}
      {tooltip && (
        <div style={{
          position: 'absolute', top: 6, left: '50%', transform: 'translateX(-50%)',
          background: 'var(--cosmos-surface-3)',
          border: '1px solid var(--cosmos-border-card)',
          borderRadius: 10, padding: '6px 12px',
          display: 'flex', gap: 14, pointerEvents: 'none',
          boxShadow: 'var(--cosmos-shadow-card, 0 4px 16px rgba(0,0,0,0.15))',
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: 'var(--cosmos-income)', fontWeight: 600, marginBottom: 2 }}>Receitas</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--cosmos-text-1)' }}>
              {(tooltip.income || 0).toLocaleString('pt-PT', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}€
            </div>
          </div>
          <div style={{ width: 1, background: 'var(--cosmos-border-divider)' }} />
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: 'var(--cosmos-expense)', fontWeight: 600, marginBottom: 2 }}>Despesas</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--cosmos-text-1)' }}>
              {(tooltip.expenses || 0).toLocaleString('pt-PT', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}€
            </div>
          </div>
        </div>
      )}

      {/* Legend */}
      <div style={{ display: 'flex', gap: 12, padding: '4px 8px 0', justifyContent: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <div style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--cosmos-income)', opacity: 0.85 }} />
          <span style={{ fontSize: 10, color: 'var(--cosmos-text-3)' }}>Receitas</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <div style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--cosmos-expense)', opacity: 0.85 }} />
          <span style={{ fontSize: 10, color: 'var(--cosmos-text-3)' }}>Despesas</span>
        </div>
      </div>
    </div>
  );
};

export default BarChart;
