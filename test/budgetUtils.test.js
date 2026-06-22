import { describe, it, expect } from 'vitest';
import { computeAccountBalance, getItemValue, roundCents } from '../src/utils/budgetUtils.js';

describe('roundCents — fronteira de escrita monetária', () => {
  it('elimina a deriva de float', () => {
    expect(roundCents(0.1 + 0.2)).toBe(0.3);          // 0.30000000000000004
    expect(roundCents(1.005 * 1)).toBe(1);            // arredonda a cêntimo
    expect(roundCents(-50.004)).toBe(-50);
    expect(roundCents(1234.567)).toBe(1234.57);
  });
  it('trata valores inválidos como 0', () => {
    expect(roundCents(undefined)).toBe(0);
    expect(roundCents(null)).toBe(0);
    expect(roundCents('x')).toBe(0);
  });
});

const acc = { id: 'a1', balance: 100, adjustment: 0 };

describe('computeAccountBalance — fonte única de verdade do saldo', () => {
  it('base = balance + adjustment quando não há transações', () => {
    expect(computeAccountBalance({ id: 'a1', balance: 100, adjustment: 25 }, [])).toBe(125);
    expect(computeAccountBalance({ id: 'a1', balance: 100, adjustment: -40 }, [])).toBe(60);
  });

  it('income soma, expense subtrai', () => {
    const txs = [
      { account_id: 'a1', type: 'income', amount: 50 },
      { account_id: 'a1', type: 'expense', amount: 30 },
    ];
    expect(computeAccountBalance(acc, txs)).toBe(120); // 100 + 50 - 30
  });

  it('transfer out (subcategory) subtrai, transfer in soma', () => {
    const txs = [
      { account_id: 'a1', type: 'transfer', subcategory: 'out', amount: 40 },
      { account_id: 'a1', type: 'transfer', subcategory: 'in', amount: 10 },
    ];
    expect(computeAccountBalance(acc, txs)).toBe(70); // 100 - 40 + 10
  });

  it('transfer legacy sem subcategory: descrição "Transferência para" → out', () => {
    const txs = [
      { account_id: 'a1', type: 'transfer', description: 'Transferência para Poupança', amount: 40 },
      { account_id: 'a1', type: 'transfer', description: 'Transferência de Ordenado', amount: 25 },
    ];
    expect(computeAccountBalance(acc, txs)).toBe(85); // 100 - 40 + 25
  });

  it('ignora transações de outras contas', () => {
    const txs = [
      { account_id: 'a1', type: 'expense', amount: 30 },
      { account_id: 'a2', type: 'expense', amount: 999 },
    ];
    expect(computeAccountBalance(acc, txs)).toBe(70);
  });

  describe('modo ÂNCORA (conta conferida)', () => {
    // Conta conferida a 500€ em 2026-06-10. balance/adjustment de criação são
    // IGNORADOS; só contam movimentos APÓS a data de conferência.
    const anchored = { id: 'a1', balance: 9999, adjustment: 123, reconciledAt: '2026-06-10', reconciledBalance: 500 };
    const txs = [
      { account_id: 'a1', type: 'expense', amount: 100, date: '2026-06-05' }, // ANTES da âncora → ignora
      { account_id: 'a1', type: 'income',  amount: 50,  date: '2026-06-10' }, // NA âncora → ignora (incluída no conferido)
      { account_id: 'a1', type: 'expense', amount: 30,  date: '2026-06-15' }, // depois → conta
      { account_id: 'a1', type: 'income',  amount: 200, date: '2026-06-20' }, // depois → conta
    ];

    it('parte do saldo conferido e só soma movimentos posteriores', () => {
      expect(computeAccountBalance(anchored, txs)).toBe(670); // 500 - 30 + 200
    });

    it('ignora saldo de criação e ajuste em modo âncora', () => {
      expect(computeAccountBalance({ ...anchored, balance: 1, adjustment: 9 }, txs)).toBe(670);
    });

    it('asOf depois da âncora: conferido + movimentos no intervalo', () => {
      expect(computeAccountBalance(anchored, txs, { asOf: '2026-06-16' })).toBe(470); // 500 - 30
    });

    it('asOf ANTES da âncora cai no fallback (criação+ajuste+até asOf)', () => {
      // fallback: 9999 + 123 + (expense 100 em 06-05) = 10022
      expect(computeAccountBalance(anchored, txs, { asOf: '2026-06-08' })).toBe(10022);
    });

    it('sem reconciledAt → fallback clássico (soma tudo, inalterado)', () => {
      // 100 (criação) - 100 + 50 - 30 + 200 = 220
      expect(computeAccountBalance({ id: 'a1', balance: 100, adjustment: 0 }, txs)).toBe(220);
    });
  });

  it('tolera amount inválido/em falta (nunca NaN)', () => {
    const txs = [
      { account_id: 'a1', type: 'expense', amount: 'abc' },
      { account_id: 'a1', type: 'income', amount: null },
      { account_id: 'a1', type: 'income' },
    ];
    expect(computeAccountBalance(acc, txs)).toBe(100);
  });

  it('tolera transactions null/undefined', () => {
    expect(computeAccountBalance(acc, null)).toBe(100);
    expect(computeAccountBalance(acc, undefined)).toBe(100);
  });

  it('tipo desconhecido não afeta o saldo', () => {
    const txs = [{ account_id: 'a1', type: 'adjustment', amount: 500 }];
    expect(computeAccountBalance(acc, txs)).toBe(100);
  });

  it('aceita amounts em string (como vêm do form)', () => {
    const txs = [{ account_id: 'a1', type: 'income', amount: '12.50' }];
    expect(computeAccountBalance(acc, txs)).toBeCloseTo(112.5, 5);
  });
});

describe('getItemValue — valor por tipo de património', () => {
  it('contas: usa currentBalance se presente, senão balance+adjustment', () => {
    expect(getItemValue({ currentBalance: 333 }, 'accounts')).toBe(333);
    expect(getItemValue({ balance: 100, adjustment: 20 }, 'accounts')).toBe(120);
  });
  it('stocks/etfs: qty * avgPrice', () => {
    expect(getItemValue({ qty: 10, avgPrice: 5 }, 'stocks')).toBe(50);
    expect(getItemValue({ qty: 3, avgPrice: 2.5 }, 'etfs')).toBe(7.5);
  });
  it('crypto: qty * price', () => {
    expect(getItemValue({ qty: 2, price: 1000 }, 'crypto')).toBe(2000);
  });
  it('bonds/vehicles/realestate: value direto', () => {
    expect(getItemValue({ value: 5000 }, 'bonds')).toBe(5000);
    expect(getItemValue({ value: 12000 }, 'vehicles')).toBe(12000);
    expect(getItemValue({ value: 250000 }, 'realestate')).toBe(250000);
  });
  it('tipo desconhecido → 0', () => {
    expect(getItemValue({ value: 1 }, 'qualquer')).toBe(0);
  });
});
