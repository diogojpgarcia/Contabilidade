/**
 * Onboarding.jsx
 * First-use tour — shown once, dismissed permanently via localStorage flag.
 * 4 slides covering the main tabs.
 */
import React, { useState } from 'react';

const STORAGE_KEY = 'financas_onboarding_done';

const SLIDES = [
  {
    emoji: '👋',
    title: 'Bem-vindo às tuas Finanças',
    desc:  'Acompanha o teu dinheiro, investimentos e orçamento num só lugar.',
  },
  {
    emoji: '🏠',
    title: 'Home — a tua consola',
    desc:  'Vê o teu patrimônio total, próximas contas e o estado do orçamento de relance.',
  },
  {
    emoji: '📊',
    title: 'Stats — conhece os teus padrões',
    desc:  'Gráficos mensais de receitas e despesas, score financeiro e insights automáticos.',
  },
  {
    emoji: '🎯',
    title: 'Budget — controla os gastos',
    desc:  'Define limites por categoria. O anel mostra quanto já usaste do orçamento.',
  },
  {
    emoji: '💼',
    title: 'Património — os teus ativos',
    desc:  'Regista contas, ETFs, cripto, imóveis e veículos. Preços atualizados automaticamente.',
  },
];

const Onboarding = ({ onDone }) => {
  const [step, setStep] = useState(0);
  const [leaving, setLeavig] = useState(false);

  const finish = () => {
    setLeavig(true);
    setTimeout(() => {
      try { localStorage.setItem(STORAGE_KEY, '1'); } catch {}
      onDone?.();
    }, 350);
  };

  const next = () => {
    if (step < SLIDES.length - 1) setStep(s => s + 1);
    else finish();
  };

  const slide = SLIDES[step];

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'var(--cosmos-bg)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '32px 28px',
      opacity: leaving ? 0 : 1,
      transition: 'opacity 0.35s ease',
    }}>
      {/* Slide content */}
      <div
        key={step}
        style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          textAlign: 'center', flex: 1, justifyContent: 'center',
          animation: 'tab-enter 0.4s cubic-bezier(0.34,1.56,0.64,1) both',
        }}
      >
        <div style={{ fontSize: 72, marginBottom: 32, lineHeight: 1 }}>{slide.emoji}</div>
        <h1 style={{
          fontSize: 26, fontWeight: 700, color: 'var(--cosmos-text-1)',
          letterSpacing: '-0.03em', lineHeight: 1.2,
          margin: '0 0 16px',
        }}>
          {slide.title}
        </h1>
        <p style={{
          fontSize: 16, color: 'var(--cosmos-text-2)',
          lineHeight: 1.6, maxWidth: 300, margin: 0,
        }}>
          {slide.desc}
        </p>
      </div>

      {/* Progress dots */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 32 }}>
        {SLIDES.map((_, i) => (
          <div
            key={i}
            onClick={() => setStep(i)}
            style={{
              width: i === step ? 20 : 8,
              height: 8,
              borderRadius: 99,
              background: i === step ? 'var(--cosmos-accent)' : 'var(--cosmos-border-divider)',
              transition: 'width 0.3s ease, background 0.3s ease',
              cursor: 'pointer',
            }}
          />
        ))}
      </div>

      {/* CTA button */}
      <button
        onClick={next}
        style={{
          width: '100%', maxWidth: 320,
          padding: '16px 0',
          background: 'var(--cosmos-accent)',
          border: 'none', borderRadius: 16,
          fontSize: 16, fontWeight: 700,
          color: '#000', cursor: 'pointer',
          WebkitTapHighlightColor: 'transparent',
          transition: 'transform 0.1s, opacity 0.1s',
          marginBottom: 16,
        }}
        onPointerDown={e => e.currentTarget.style.transform = 'scale(0.97)'}
        onPointerUp={e => e.currentTarget.style.transform = ''}
        onPointerLeave={e => e.currentTarget.style.transform = ''}
      >
        {step < SLIDES.length - 1 ? 'Seguinte' : 'Começar →'}
      </button>

      {/* Skip */}
      {step < SLIDES.length - 1 && (
        <button
          onClick={finish}
          style={{
            background: 'none', border: 'none',
            fontSize: 14, color: 'var(--cosmos-text-3)',
            cursor: 'pointer', padding: '8px 16px',
          }}
        >
          Saltar
        </button>
      )}
    </div>
  );
};

/** Returns true if onboarding has already been completed */
export const isOnboardingDone = () => {
  try { return localStorage.getItem(STORAGE_KEY) === '1'; } catch { return false; }
};

export default Onboarding;
