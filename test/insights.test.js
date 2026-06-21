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

  it('fundo de emergência usa só património líquido (contas + aforro)', () => {
    const s = buildInsightsSummary({
      transactions, budgets: {}, categories,
      patrimony: {
        accounts: [{ balance: 1400 }],
        bonds:    [{ faceValue: 700 }],          // líquido (aforro)
        stocks:   [{ value: 5000 }],             // ilíquido — excluído
        crypto:   [{ value: 9000 }],             // ilíquido — excluído
        realestate: [{ value: 200000 }],         // ilíquido — excluído
      },
      selectedMonth: '2026-06', startDay: 1,
    });
    expect(s.liquidTotal).toBe(2100);            // 1400 + 700
    expect(s.emergencyMonths).toBe(3);           // 2100 / 700 (ignora stocks/crypto/imóveis)
  });

  it('exclui aforro do fundo de emergência quando o toggle está off', () => {
    const s = buildInsightsSummary({
      transactions, budgets: {}, categories,
      patrimony: { accounts: [{ balance: 1400 }], bonds: [{ faceValue: 700 }] },
      selectedMonth: '2026-06', startDay: 1,
      emergencyIncludesAforro: false,
    });
    expect(s.liquidTotal).toBe(1400);            // só contas, sem aforro
    expect(s.emergencyMonths).toBe(2);           // 1400 / 700
  });

  it('usa currentBalance da conta quando presente (saldo real)', () => {
    const s = buildInsightsSummary({
      transactions, budgets: {}, categories,
      patrimony: { accounts: [{ balance: 100, adjustment: 50, currentBalance: 1400 }] },
      selectedMonth: '2026-06', startDay: 1,
    });
    expect(s.liquidTotal).toBe(1400);            // currentBalance manda sobre balance+adjustment
  });

  it('expõe estado de reconciliação das contas (confiança)', () => {
    const s = buildInsightsSummary({
      transactions, budgets: {}, categories,
      patrimony: { accounts: [
        { balance: 1000, reconciledAt: '2026-06-10' },
        { balance: 500,  reconciledAt: '2026-05-01' },
        { balance: 200 },
      ] },
      selectedMonth: '2026-06', startDay: 1,
    });
    expect(s.dataConfidence.accountsTotal).toBe(3);
    expect(s.dataConfidence.accountsReconciled).toBe(2);
    expect(s.dataConfidence.reconciledThrough).toBe('2026-05-01'); // a mais antiga (conservadora)
  });
});
