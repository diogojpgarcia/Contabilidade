import { describe, it, expect } from 'vitest';
import { spendingByCategory } from '../src/utils/homeStats.js';

const categories = {
  expense: [
    { id: 'c1', label: 'Casa', color: '#5B8DEF' },
    { id: 'c2', label: 'Alimentação', color: '#E8734A' },
    { id: 'c3', label: 'Transportes', color: '#F5B731' },
    { id: 'c4', label: 'Saúde', color: '#34D399' },
    { id: 'c5', label: 'Lazer', color: '#A78BFA' },
  ],
};

const MONTH = '2026-06';

const tx = (over) => ({ type: 'expense', date: '2026-06-10', ...over });

describe('spendingByCategory · agregação', () => {
  it('soma despesas por categoria e ordena desc', () => {
    const { slices, total } = spendingByCategory({
      transactions: [
        tx({ category: 'Casa', amount: 200 }),
        tx({ category: 'Alimentação', amount: 50 }),
        tx({ category: 'Alimentação', amount: 70 }),
        tx({ category: 'Transportes', amount: 30 }),
      ],
      currentMonth: MONTH, categories,
    });
    expect(total).toBe(350);
    expect(slices.map(s => s.label)).toEqual(['Casa', 'Alimentação', 'Transportes']);
    expect(slices[1].amount).toBe(120); // 50 + 70
  });

  it('atribui a cor da categoria e calcula a percentagem', () => {
    const { slices } = spendingByCategory({
      transactions: [tx({ category: 'Casa', amount: 300 }), tx({ category: 'Alimentação', amount: 100 })],
      currentMonth: MONTH, categories,
    });
    expect(slices[0]).toMatchObject({ label: 'Casa', color: '#5B8DEF', pct: 75 });
    expect(slices[1].pct).toBe(25);
  });

  it('usa cor de fallback quando a categoria não existe no mapa', () => {
    const { slices } = spendingByCategory({
      transactions: [tx({ category: 'Desconhecida', amount: 10 })],
      currentMonth: MONTH, categories,
    });
    expect(slices[0].color).toBe('var(--cosmos-text-3)');
  });

  it('ignora receitas, valores zero e datas fora do mês', () => {
    const { slices, total } = spendingByCategory({
      transactions: [
        tx({ category: 'Casa', amount: 100 }),
        tx({ category: 'Casa', type: 'income', amount: 999 }),
        tx({ category: 'Casa', amount: 0 }),
        tx({ category: 'Casa', amount: 80, date: '2026-05-30' }),
      ],
      currentMonth: MONTH, categories,
    });
    expect(total).toBe(100);
    expect(slices.length).toBe(1);
  });

  it('usa valor absoluto (despesas guardadas com sinal negativo)', () => {
    const { total } = spendingByCategory({
      transactions: [tx({ category: 'Casa', amount: -45.5 })],
      currentMonth: MONTH, categories,
    });
    expect(total).toBe(45.5);
  });
});

describe('spendingByCategory · agregação da cauda (topN)', () => {
  it('agrega o excedente numa fatia Resto', () => {
    const { slices } = spendingByCategory({
      transactions: [
        tx({ category: 'Casa', amount: 500 }),
        tx({ category: 'Alimentação', amount: 400 }),
        tx({ category: 'Transportes', amount: 300 }),
        tx({ category: 'Saúde', amount: 200 }),
        tx({ category: 'Lazer', amount: 100 }),
      ],
      currentMonth: MONTH, categories, topN: 4,
    });
    expect(slices.length).toBe(4);
    expect(slices.map(s => s.label)).toEqual(['Casa', 'Alimentação', 'Transportes', 'Resto']);
    expect(slices[3].amount).toBe(300); // Saúde 200 + Lazer 100
    expect(slices[3].color).toBe('var(--cosmos-text-3)');
  });

  it('não agrega quando cabe em topN', () => {
    const { slices } = spendingByCategory({
      transactions: [
        tx({ category: 'Casa', amount: 100 }),
        tx({ category: 'Alimentação', amount: 80 }),
      ],
      currentMonth: MONTH, categories, topN: 4,
    });
    expect(slices.map(s => s.label)).toEqual(['Casa', 'Alimentação']);
    expect(slices.some(s => s.label === 'Resto')).toBe(false);
  });
});

describe('spendingByCategory · estados-limite', () => {
  it('sem mês devolve vazio', () => {
    expect(spendingByCategory({ transactions: [tx({ category: 'Casa', amount: 10 })], categories })).toEqual({ slices: [], total: 0 });
  });
  it('sem despesas devolve vazio', () => {
    expect(spendingByCategory({ transactions: [], currentMonth: MONTH, categories })).toEqual({ slices: [], total: 0 });
  });
});
