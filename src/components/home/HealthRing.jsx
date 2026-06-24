/**
 * HealthRing.jsx — anel de saúde financeira (0-100).
 *
 * Apresentação pura. Quando `score` é null/undefined mostra um estado NEUTRO
 * ("—") — usado enquanto a fórmula do score não estiver decidida.
 */
import React from 'react';

const colorForScore = (score) => {
  if (score == null) return 'var(--cosmos-border-divider)';
  if (score >= 70) return 'var(--cosmos-income)';
  if (score >= 40) return 'var(--cosmos-warning, #f59e0b)';
  return 'var(--cosmos-expense)';
};

const HealthRing = ({ score = null, label = 'saúde', size = 86, stroke = 7 }) => {
  const r = (size - stroke) / 2;
  const c = size / 2;
  const circ = 2 * Math.PI * r;
  const hasScore = score != null && Number.isFinite(score);
  const pct = hasScore ? Math.min(100, Math.max(0, score)) : 0;
  const offset = circ * (1 - pct / 100);

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: 'block' }}
        role="img" aria-label={hasScore ? `Saúde financeira ${Math.round(pct)} em 100` : 'Saúde financeira ainda por calcular'}>
        <circle cx={c} cy={c} r={r} fill="none" stroke="var(--cosmos-border-divider)" strokeWidth={stroke} />
        {hasScore && (
          <circle
            cx={c} cy={c} r={r} fill="none"
            stroke={colorForScore(pct)} strokeWidth={stroke} strokeLinecap="round"
            strokeDasharray={circ} strokeDashoffset={offset}
            transform={`rotate(-90 ${c} ${c})`}
            style={{ transition: 'stroke-dashoffset 0.8s ease' }}
          />
        )}
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: 24, fontWeight: 700, color: hasScore ? 'var(--cosmos-text-1)' : 'var(--cosmos-text-3)', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
          {hasScore ? Math.round(pct) : '—'}
        </span>
        <span style={{ fontSize: 9.5, color: 'var(--cosmos-text-3)', marginTop: 2 }}>{label}</span>
      </div>
    </div>
  );
};

export default HealthRing;
