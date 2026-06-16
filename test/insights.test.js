import { describe, it, expect } from 'vitest';
import { isNeed, buildInsightsSummary } from '../src/utils/insights.js';

describe('isNeed — classificação necessidades vs desejos (50/30/20)', () => {
  it('classifica essenciais como necessidades (com/sem acento)', () => {
    expect(isNeed('Habitação')).toBe(true);
    expect(isNeed('Alimentação')).toBe(true);
    expect(isNeed('Saúde')).toBe(true);
    expect(isNeed('Transporte')).toBe(true);
    expect(isNeed('Utilities')).toBe(true);
    expect(isNeed('Educação')).toBe(true);
  });
  it('classifica discricionários como desejos', () => {
    expect(isNeed('Restaurantes')).toBe(false);
    expect(isNeed('Lazer & Entretenimento')).toBe(false);
    expect(isNeed('Compras')).toBe(false);
    expect(isNeed('')).toBe(false);
    expect(isNeed(null)).toBe(false);
  });
});

describe('buildInsightsSummary — estrutura 50/30/20', () => {
  const categories = {
    expense: [
      { id: 'hab',  label: 'Habitação' },
      { id: 'rest', label: 'Restaurantes' },
    ],
    income: [],
  };
  const transactions = [
    { type: 'income',  amount: 1000, category: 'Salário',      date: '2026-06-01' },
    { type: 'expense', amount: 500,  category: 'Habitação',    date: '2026-06-05' },
    { type: 'expense', amount: 200,  category: 'Restaurantes', date: '2026-06-10' },
  ];

  it('calcula needs/wants/savings e percentagens do rendimento', () => {
    const s = buildInsightsSummary({
      transactions, budgets: {}, categories, patrimony: null,
      selectedMonth: '2026-06', startDay: 1,
    });
    expect(s.income).toBe(1000);
    expect(s.expenses).toBe(700);
    expect(s.fiftyThirtyTwenty).toEqual({
      needs: 500, wants: 200, savings: 300,
      needsPct: 50, wantsPct: 20, savingsPct: 30,
    });
  });

  it('cobertura de emergência em meses de despesa', () => {
    const s = buildInsightsSummary({
      transactions, budgets: {}, categories,
      patrimony: { accounts: [{ balance: 2100 }] },
      selectedMonth: '2026-06', startDay: 1,
    });
    expect(s.emergencyMonths).toBe(3); // 2100 / 700
  });
});
