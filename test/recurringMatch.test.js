import { describe, it, expect } from 'vitest';
import { businessDaysBetween, findMatchingTransaction, matchPendingRecurrings } from '../src/utils/recurringMatch.js';

describe('businessDaysBetween', () => {
  it('ignora fins de semana', () => {
    expect(businessDaysBetween('2026-06-19', '2026-06-19')).toBe(0); // mesmo dia
    expect(businessDaysBetween('2026-06-19', '2026-06-22')).toBe(1); // sex → seg = 1 dia útil
    expect(businessDaysBetween('2026-06-15', '2026-06-19')).toBe(4); // seg → sex
  });
  it('ordem indiferente', () => {
    expect(businessDaysBetween('2026-06-22', '2026-06-19')).toBe(1);
  });
});

describe('findMatchingTransaction', () => {
  const txns = [
    { id: 't1', type: 'expense', amount: 500, date: '2026-06-10' }, // renda
    { id: 't2', type: 'expense', amount: 30,  date: '2026-06-12' },
    { id: 't3', type: 'income',  amount: 500, date: '2026-06-10' }, // receita — ignora
  ];

  it('casa montante dentro de ±5% e data dentro de ±5 dias úteis', () => {
    const m = findMatchingTransaction({ amount: 510, dueDate: '2026-06-11' }, txns); // 510 vs 500 = 2%
    expect(m?.id).toBe('t1');
  });
  it('rejeita montante fora da tolerância', () => {
    expect(findMatchingTransaction({ amount: 600, dueDate: '2026-06-10' }, txns)).toBeNull(); // 20% off
  });
  it('rejeita data fora da janela', () => {
    expect(findMatchingTransaction({ amount: 500, dueDate: '2026-06-30' }, txns)).toBeNull(); // > 5 dias úteis
  });
  it('ignora receitas e transações já usadas', () => {
    const used = new Set(['t1']);
    expect(findMatchingTransaction({ amount: 500, dueDate: '2026-06-10' }, txns, { usedIds: used })).toBeNull();
  });
});

describe('matchPendingRecurrings', () => {
  it('não reutiliza a mesma transação para duas ocorrências', () => {
    const txns = [{ id: 't1', type: 'expense', amount: 100, date: '2026-06-10' }];
    const pending = [
      { id: 'r1', amount: 100, dueDate: '2026-06-10' },
      { id: 'r2', amount: 100, dueDate: '2026-06-11' },
    ];
    const out = matchPendingRecurrings(pending, txns);
    const matched = out.filter(p => p.match);
    expect(matched).toHaveLength(1); // só uma fica casada
  });
  it('usa estimatedAmount em pagamentos variáveis', () => {
    const txns = [{ id: 't1', type: 'expense', amount: 80, date: '2026-06-10' }];
    const pending = [{ id: 'r1', paymentType: 'variable', estimatedAmount: 78, dueDate: '2026-06-10' }];
    expect(matchPendingRecurrings(pending, txns)[0].match?.id).toBe('t1');
  });
});
