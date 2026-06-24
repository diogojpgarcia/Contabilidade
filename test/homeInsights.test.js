import { describe, it, expect } from 'vitest';
import { buildHomeInsights, INSIGHT_TONE } from '../src/utils/homeInsights.js';

const categories = {
  expense: [
    { id: 'c1', label: 'Casa' },
    { id: 'c2', label: 'Alimentação' },
  ],
  income: [{ id: 'i1', label: 'Salário' }],
};

const MONTH = '2026-06';
const tx = (over) => ({ type: 'expense', date: '2026-06-10', ...over });

describe('buildHomeInsights · mapeamento', () => {
  it('embrulha um insight de orçamento ultrapassado na forma da Home', () => {
    const out = buildHomeInsights({
      transactions: [tx({ category: 'Alimentação', amount: 150 })],
      budgets: { c2: 100 }, // limite 100, gasto 150 → ultrapassado
      categories, currentMonth: MONTH,
    });
    expect(out.length).toBeGreaterThan(0);
    const over = out.find(i => i.text.includes('Alimentação'));
    expect(over).toBeTruthy();
    expect(over.tone).toBe('danger');           // color 'risk' → 'danger'
    expect(over.text).toContain('ultrapassado');
    expect(typeof over.subtext).toBe('string');
    expect(over.action).toMatchObject({ action: 'openBudget', categoryLabel: 'Alimentação' });
    expect(over.id).toBeTruthy();
  });

  it('respeita maxResults', () => {
    const out = buildHomeInsights({
      transactions: [
        tx({ category: 'Casa', amount: 500 }),
        tx({ category: 'Alimentação', amount: 500 }),
        tx({ type: 'income', category: 'Salário', amount: 100 }),
      ],
      budgets: { c1: 100, c2: 100 },
      categories, currentMonth: MONTH, maxResults: 1,
    });
    expect(out.length).toBeLessThanOrEqual(1);
  });

  it('cada item tem um tom válido', () => {
    const out = buildHomeInsights({
      transactions: [tx({ category: 'Alimentação', amount: 150 })],
      budgets: { c2: 100 }, categories, currentMonth: MONTH,
    });
    const tones = new Set(Object.values(INSIGHT_TONE));
    for (const i of out) expect(tones.has(i.tone)).toBe(true);
  });
});

describe('buildHomeInsights · guardas', () => {
  it('sem transações devolve vazio', () => {
    expect(buildHomeInsights({ transactions: [], categories, currentMonth: MONTH })).toEqual([]);
  });
  it('sem mês devolve vazio', () => {
    expect(buildHomeInsights({ transactions: [tx({ category: 'Casa', amount: 10 })], categories })).toEqual([]);
  });
  it('sem categorias devolve vazio', () => {
    expect(buildHomeInsights({ transactions: [tx({ category: 'Casa', amount: 10 })], currentMonth: MONTH })).toEqual([]);
  });
  it('nunca lança — devolve [] em input inválido', () => {
    expect(buildHomeInsights({ transactions: [{ bad: true }], categories, currentMonth: MONTH })).toEqual(expect.any(Array));
  });
});
