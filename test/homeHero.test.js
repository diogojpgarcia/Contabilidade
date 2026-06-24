import { describe, it, expect } from 'vitest';
import { buildHeroModel } from '../src/utils/homeHero.js';

const MONTH = '2026-06';
const tx = (over) => ({ date: '2026-06-10', ...over });

describe('buildHeroModel · fluxo do mês', () => {
  it('soma entrou/saiu/saldo do mês financeiro', () => {
    const m = buildHeroModel({
      transactions: [
        tx({ type: 'income', amount: 2000 }),
        tx({ type: 'income', amount: 180 }),
        tx({ type: 'expense', amount: 1768 }),
        tx({ type: 'expense', amount: -45, date: '2026-05-30' }), // fora do mês
      ],
      currentMonth: MONTH,
    });
    expect(m.income).toBe(2180);
    expect(m.expenses).toBe(1768);
    expect(m.balance).toBe(412);
  });

  it('usa valor absoluto nas despesas (sinal negativo)', () => {
    const m = buildHeroModel({ transactions: [tx({ type: 'expense', amount: -100 })], currentMonth: MONTH });
    expect(m.expenses).toBe(100);
  });

  it('expõe vitais formatados com tom', () => {
    const m = buildHeroModel({
      transactions: [tx({ type: 'income', amount: 1000 }), tx({ type: 'expense', amount: 600 })],
      currentMonth: MONTH,
    });
    expect(m.vitals.map(v => v.key)).toEqual(['in', 'out', 'bal']);
    const bal = m.vitals.find(v => v.key === 'bal');
    expect(bal.value).toContain('+');
    expect(bal.tone).toBe('income');
  });

  it('saldo negativo marca tom de despesa e sinal', () => {
    const m = buildHeroModel({
      transactions: [tx({ type: 'income', amount: 100 }), tx({ type: 'expense', amount: 300 })],
      currentMonth: MONTH,
    });
    expect(m.balance).toBe(-200);
    const bal = m.vitals.find(v => v.key === 'bal');
    expect(bal.tone).toBe('expense');
    expect(bal.value).toContain('−'); // minus sign (U+2212)
  });
});

describe('buildHeroModel · headline', () => {
  it('positivo → a poupar', () => {
    const m = buildHeroModel({ transactions: [tx({ type: 'income', amount: 500 }), tx({ type: 'expense', amount: 100 })], currentMonth: MONTH });
    expect(m.headline).toBe('Estás a poupar este mês.');
  });
  it('negativo → a gastar mais do que recebe', () => {
    const m = buildHeroModel({ transactions: [tx({ type: 'income', amount: 100 }), tx({ type: 'expense', amount: 500 })], currentMonth: MONTH });
    expect(m.headline).toBe('Estás a gastar mais do que recebes.');
  });
  it('sem movimentos → frase neutra', () => {
    const m = buildHeroModel({ transactions: [], currentMonth: MONTH });
    expect(m.headline).toBe('Ainda sem movimentos este mês.');
    expect(m.hasFlow).toBe(false);
  });
});

describe('buildHeroModel · placeholders de dinheiro', () => {
  it('score, scoreDelta e forecast ficam null até a fórmula ser decidida', () => {
    const m = buildHeroModel({ transactions: [tx({ type: 'income', amount: 500 })], currentMonth: MONTH });
    expect(m.score).toBeNull();
    expect(m.scoreDelta).toBeNull();
    expect(m.forecast).toBeNull();
  });
});
