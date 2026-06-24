/**
 * SpendingDonut.jsx — donut "Onde foi este mês" + legenda.
 *
 * Apresentação pura: recebe { slices, total } de `spendingByCategory(...)`.
 * Não agrega nada. Devolve null quando não há gastos.
 */
import React from 'react';

const SIZE = 86;
const STROKE = 13;
const R = (SIZE - STROKE) / 2;
const C = 2 * Math.PI * R;
const CX = SIZE / 2;

const fmtEur = (v) =>
  `${Math.round(parseFloat(v) || 0).toLocaleString('pt-PT')}€`;

const SpendingDonut = ({ slices = [], total = 0, title = 'Onde foi este mês', onClick }) => {
  if (!slices.length || total <= 0) return null;

  // Segmentos: comprimento proporcional + rotação para o ângulo de início.
  let acc = 0;
  const segments = slices.map((s) => {
    const frac = s.amount / total;
    const seg = { ...s, len: frac * C, rot: acc * 360 - 90 };
    acc += frac;
    return seg;
  });

  return (
    <div
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      style={{
        padding: '14px 18px 16px',
        cursor: onClick ? 'pointer' : 'default',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--cosmos-text-2)', marginBottom: 12 }}>
        {title}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
        <svg
          width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}
          style={{ flexShrink: 0 }}
          role="img" aria-label="Distribuição dos gastos por categoria"
        >
          <circle cx={CX} cy={CX} r={R} fill="none" stroke="var(--cosmos-border-divider)" strokeWidth={STROKE} />
          {segments.map((s) => (
            <circle
              key={s.label}
              cx={CX} cy={CX} r={R}
              fill="none"
              stroke={s.color}
              strokeWidth={STROKE}
              strokeDasharray={`${s.len} ${C - s.len}`}
              transform={`rotate(${s.rot} ${CX} ${CX})`}
            />
          ))}
        </svg>

        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {slices.map((s) => (
            <div key={s.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12.5 }}>
              <span style={{ color: 'var(--cosmos-text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                <span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 3, background: s.color, marginRight: 8, flexShrink: 0 }} />
                {s.label}
              </span>
              <span style={{ color: 'var(--cosmos-text-3)', flexShrink: 0, marginLeft: 8 }}>{fmtEur(s.amount)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SpendingDonut;
