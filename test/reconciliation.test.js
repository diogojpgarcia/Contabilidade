import { describe, it, expect } from 'vitest';
import {
  computeAccountBalanceAsOf,
  reconcileAccount,
  findGapCandidates,
} from '../src/utils/reconciliation.js';

const acc = { id: 'a1', balance: 1000, adjustment: 0 };

const txns = [
  { id: 't1', account_id: 'a1', type: 'expense', amount: 100, date: '2026-06-05' },
  { id: 't2', account_id: 'a1', type: 'income',  amount: 500, date: '2026-06-20' },
  { id: 't3', account_id: 'a2', type: 'expense', amount: 999, date: '2026-06-10' }, // outra conta
];

describe('computeAccountBalanceAsOf', () => {
  it('soma só transações até à data (inclusive)', () => {
    // 1000 - 100 (até 05) = 900
    expect(computeAccountBalanceAsOf(acc, txns, '2026-06-05')).toBe(900);
    // 1000 - 100 + 500 (até 20) = 1400
    expect(computeAccountBalanceAsOf(acc, txns, '2026-06-20')).toBe(1400);
  });
  it('ignora transações de outras contas', () => {
    expect(computeAccountBalanceAsOf(acc, txns, '2026-06-30')).toBe(1400);
  });
  it('sem asOf comporta-se como saldo total', () => {
    expect(computeAccountBalanceAsOf(acc, txns, null)).toBe(1400);
  });
});

describe('reconcileAccount', () => {
  it('gap negativo → faltam despesas', () => {
    // app calcula 1400; real 1350 → faltam 50€ de despesa
    const r = reconcileAccount({ account: acc, transactions: txns, realBalance: 1350, asOfDate: '2026-06-20' });
    expect(r.computed).toBe(1400);
    expect(r.gap).toBe(-50);
    expect(r.direction).toBe('missing-expense');
  });
  it('gap positivo → faltam receitas', () => {
    const r = reconcileAccount({ account: acc, transactions: txns, realBalance: 1500, asOfDate: '2026-06-20' });
    expect(r.gap).toBe(100);
    expect(r.direction).toBe('missing-income');
  });
  it('diferença de cêntimos conta como conferido', () => {
    const r = reconcileAccount({ account: acc, transactions: txns, realBalance: 1400.005, asOfDate: '2026-06-20' });
    expect(r.direction).toBe('ok');
  });
});

describe('findGapCandidates', () => {
  const recurrings = [
    { id: 'r1', title: 'Netflix', amount: 15, frequency: 'monthly', startDate: '2026-06-08', accountId: 'a1', active: true },
    { id: 'r2', title: 'Renda',   amount: 500, frequency: 'monthly', startDate: '2026-06-01', accountId: 'a2', active: true }, // outra conta
  ];

  it('devolve recorrentes previstas não casadas desta conta', () => {
    const out = findGapCandidates({
      recurringPayments: recurrings,
      transactions: txns,
      accountId: 'a1',
      fromDate: '2026-06-01',
      toDate: '2026-06-30',
      confirmedRecurring: {},
    });
    expect(out.map(c => c.payment.id)).toEqual(['r1']); // r2 é de outra conta
    expect(out[0].dueDate).toBe('2026-06-08');
  });

  it('exclui ocorrências já confirmadas/associadas/dispensadas', () => {
    const out = findGapCandidates({
      recurringPayments: recurrings,
      transactions: txns,
      accountId: 'a1',
      fromDate: '2026-06-01',
      toDate: '2026-06-30',
      confirmedRecurring: { r1: { '2026-06': { skipped: true } } },
    });
    expect(out).toHaveLength(0);
  });

  it('exclui ocorrências que já casam com uma transação da conta', () => {
    const withMatch = [...txns, { id: 't4', account_id: 'a1', type: 'expense', amount: 15, date: '2026-06-09' }];
    const out = findGapCandidates({
      recurringPayments: recurrings,
      transactions: withMatch,
      accountId: 'a1',
      fromDate: '2026-06-01',
      toDate: '2026-06-30',
      confirmedRecurring: {},
    });
    expect(out).toHaveLength(0); // Netflix já está no histórico
  });

  it('inclui recorrentes sem conta atribuída', () => {
    const generic = [{ id: 'r3', title: 'Spotify', amount: 10, frequency: 'monthly', startDate: '2026-06-15', accountId: '', active: true }];
    const out = findGapCandidates({
      recurringPayments: generic,
      transactions: txns,
      accountId: 'a1',
      fromDate: '2026-06-01',
      toDate: '2026-06-30',
      confirmedRecurring: {},
    });
    expect(out.map(c => c.payment.id)).toEqual(['r3']);
  });
});
