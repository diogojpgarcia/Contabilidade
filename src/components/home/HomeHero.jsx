/**
 * HomeHero.jsx — herói da Home.
 *
 * Apresentação pura: recebe o modelo de `buildHeroModel(...)`.
 * Layout: saudação · (anel de saúde + frase + previsão) · grelha de vitais.
 *
 * `score`/`forecast` podem ser null (placeholder) — o anel mostra estado neutro
 * e a previsão não é renderizada até existir.
 */
import React from 'react';
import HealthRing from './HealthRing';

const TONE_COLOR = {
  income:  'var(--cosmos-income)',
  expense: 'var(--cosmos-expense)',
  neutral: 'var(--cosmos-text-1)',
};

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 19) return 'Boa tarde';
  return 'Boa noite';
}

const HomeHero = ({ model, userName = '' }) => {
  if (!model) return null;
  const { headline, vitals = [], score, scoreDelta, forecast } = model;

  return (
    <div style={{ padding: '18px 18px 16px' }}>
      <div style={{ fontSize: 12, color: 'var(--cosmos-text-3)', marginBottom: 14 }}>
        {getGreeting()}, {userName || 'Diogo'}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <HealthRing score={score} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--cosmos-text-1)', lineHeight: 1.35, marginBottom: 5 }}>
            {headline}
          </div>
          {(forecast || scoreDelta != null) && (
            <div style={{ fontSize: 12.5, color: 'var(--cosmos-text-2)', lineHeight: 1.5 }}>
              {forecast}
              {forecast && scoreDelta != null && ' · '}
              {scoreDelta != null && (
                <span style={{ color: scoreDelta >= 0 ? 'var(--cosmos-income)' : 'var(--cosmos-expense)' }}>
                  {scoreDelta >= 0 ? '+' : ''}{scoreDelta} pts
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {vitals.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 16 }}>
          {vitals.map((v) => (
            <div key={v.key} style={{ background: 'var(--cosmos-surface-2, var(--cosmos-surface-1))', border: '1px solid var(--cosmos-border-card)', borderRadius: 10, padding: '9px 10px' }}>
              <div style={{ fontSize: 10.5, color: 'var(--cosmos-text-3)', marginBottom: 3 }}>{v.label}</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: TONE_COLOR[v.tone] || 'var(--cosmos-text-1)', fontVariantNumeric: 'tabular-nums' }}>{v.value}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default HomeHero;
