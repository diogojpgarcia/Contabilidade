import { describe, it, expect } from 'vitest';
import {
  getFinancialMonthKey,
  getFinancialMonthRange,
  isInFinancialMonth,
  shiftFinancialMonth,
  getCurrentFinancialMonth,
} from '../src/utils/financialMonth.js';
import {
  advanceByFrequency,
  computeNextDueDate,
  getOccurrencesInRange,
  getMonthlyEquivalent,
  getTotalMonthlyCommitted,
  getRecurringMonthKey,
  isConfirmedForMonth,
} from '../src/utils/recurringPayments.js';

/**
 * Estes testes correm com TZ=Europe/Lisbon (ver script "test" no package.json).
 * Datas de verão (Jun–Out) ficam em UTC+1, por isso qualquer regressão a
 * toISOString() sobre datas locais voltaria a dar off-by-one e falharia aqui.
 */

describe('financialMonth — getFinancialMonthKey', () => {
  it('startDay=1 → mês de calendário', () => {
    expect(getFinancialMonthKey('2025-06-15', 1)).toBe('2025-06');
  });
  it('startDay=25 → dia >= startDay fica no mês que começa', () => {
    expect(getFinancialMonthKey('2025-06-25', 25)).toBe('2025-06');
    expect(getFinancialMonthKey('2025-07-10', 25)).toBe('2025-06');
  });
  it('startDay=25 → dia < startDay pertence ao mês financeiro anterior', () => {
    expect(getFinancialMonthKey('2025-06-24', 25)).toBe('2025-05');
  });
});

describe('financialMonth — getFinancialMonthRange', () => {
  it('mês de calendário (startDay=1)', () => {
    expect(getFinancialMonthRange('2025-06', 1)).toEqual({ start: '2025-06-01', end: '2025-06-30' });
  });
  it('fim de mês de Fevereiro não-bissexto', () => {
    expect(getFinancialMonthRange('2025-02', 1).end).toBe('2025-02-28');
  });
  it('fim de mês de Fevereiro bissexto', () => {
    expect(getFinancialMonthRange('2024-02', 1).end).toBe('2024-02-29');
  });
  it('mês financeiro de VERÃO com startDay=25 (regressão DST/UTC+1)', () => {
    // Antes do fix, em Europe/Lisbon no verão, toISOString dava 2025-06-24 / 2025-07-23.
    expect(getFinancialMonthRange('2025-06', 25)).toEqual({ start: '2025-06-25', end: '2025-07-24' });
  });
  it('mês financeiro de INVERNO com startDay=25', () => {
    expect(getFinancialMonthRange('2025-01', 25)).toEqual({ start: '2025-01-25', end: '2025-02-24' });
  });
  it('limite que atravessa o ano', () => {
    expect(getFinancialMonthRange('2025-12', 25)).toEqual({ start: '2025-12-25', end: '2026-01-24' });
  });
});

describe('financialMonth — isInFinancialMonth (startDay=25, verão)', () => {
  it('dentro do intervalo', () => {
    expect(isInFinancialMonth('2025-06-30', '2025-06', 25)).toBe(true);
    expect(isInFinancialMonth('2025-07-24', '2025-06', 25)).toBe(true);
  });
  it('fora do intervalo', () => {
    expect(isInFinancialMonth('2025-06-24', '2025-06', 25)).toBe(false);
    expect(isInFinancialMonth('2025-07-25', '2025-06', 25)).toBe(false);
  });
});

describe('financialMonth — shiftFinancialMonth', () => {
  it('avança e recua, com viragem de ano', () => {
    expect(shiftFinancialMonth('2025-06', 1)).toBe('2025-07');
    expect(shiftFinancialMonth('2025-12', 1)).toBe('2026-01');
    expect(shiftFinancialMonth('2025-01', -1)).toBe('2024-12');
  });
});

describe('financialMonth — getCurrentFinancialMonth', () => {
  it('devolve sempre uma chave YYYY-MM válida', () => {
    expect(getCurrentFinancialMonth(1)).toMatch(/^\d{4}-\d{2}$/);
  });
});

describe('recurringPayments — advanceByFrequency', () => {
  it('mensal em data de verão (regressão DST/UTC+1)', () => {
    expect(advanceByFrequency('2025-06-25', { frequency: 'monthly' })).toBe('2025-07-25');
  });
  it('mensal a partir de dia 31 → encolhe para o último dia do mês curto', () => {
    expect(advanceByFrequency('2025-01-31', { frequency: 'monthly' })).toBe('2025-02-28');
  });
  it('semanal a atravessar a mudança para hora de verão (30 Mar 2025)', () => {
    expect(advanceByFrequency('2025-03-30', { frequency: 'weekly' })).toBe('2025-04-06');
  });
  it('semanal normal', () => {
    expect(advanceByFrequency('2025-06-25', { frequency: 'weekly' })).toBe('2025-07-02');
  });
  it('custom de N dias', () => {
    expect(advanceByFrequency('2025-06-25', { frequency: 'custom', customDays: 10 })).toBe('2025-07-05');
  });
  it('anual', () => {
    expect(advanceByFrequency('2025-06-25', { frequency: 'yearly' })).toBe('2026-06-25');
  });
});

describe('recurringPayments — computeNextDueDate', () => {
  it('startDate no futuro → devolve o próprio startDate', () => {
    expect(computeNextDueDate({ frequency: 'monthly', startDate: '2025-12-01' }, '2025-06-01')).toBe('2025-12-01');
  });
  it('mensal — salta para a ocorrência >= from', () => {
    expect(computeNextDueDate({ frequency: 'monthly', startDate: '2025-01-15' }, '2025-04-01')).toBe('2025-04-15');
  });
  it('semanal — salto O(1) imune a DST (Jan→Mar)', () => {
    expect(computeNextDueDate({ frequency: 'weekly', startDate: '2025-01-06' }, '2025-03-31')).toBe('2025-03-31');
  });
  it('anual', () => {
    expect(computeNextDueDate({ frequency: 'yearly', startDate: '2020-03-10' }, '2025-01-01')).toBe('2025-03-10');
  });
});

describe('recurringPayments — getOccurrencesInRange', () => {
  it('mensal dentro de um trimestre de verão', () => {
    const p = { frequency: 'monthly', startDate: '2025-06-10' };
    expect(getOccurrencesInRange(p, '2025-06-01', '2025-08-31'))
      .toEqual(['2025-06-10', '2025-07-10', '2025-08-10']);
  });
  it('sem startDate → vazio', () => {
    expect(getOccurrencesInRange({ frequency: 'monthly' }, '2025-01-01', '2025-12-31')).toEqual([]);
  });
});

describe('recurringPayments — valores mensais', () => {
  it('getMonthlyEquivalent', () => {
    expect(getMonthlyEquivalent({ frequency: 'monthly', amount: 100 })).toBe(100);
    expect(getMonthlyEquivalent({ frequency: 'yearly', amount: 1200 })).toBe(100);
    expect(getMonthlyEquivalent({ frequency: 'weekly', amount: 10 })).toBeCloseTo(43.333, 2);
    expect(getMonthlyEquivalent({ frequency: 'custom', customDays: 10, amount: 10 })).toBe(30);
  });
  it('getTotalMonthlyCommitted ignora inativos', () => {
    const payments = [
      { frequency: 'monthly', amount: 100 },
      { frequency: 'monthly', amount: 50, active: false },
      { frequency: 'yearly', amount: 1200 },
    ];
    expect(getTotalMonthlyCommitted(payments)).toBe(200);
  });
});

describe('recurringPayments — helpers de mês/confirmação', () => {
  it('getRecurringMonthKey', () => {
    expect(getRecurringMonthKey('2025-06-25')).toBe('2025-06');
  });
  it('isConfirmedForMonth', () => {
    const conf = { rec1: { '2025-06': { transactionId: 'x' } } };
    expect(isConfirmedForMonth('rec1', '2025-06', conf)).toBe(true);
    expect(isConfirmedForMonth('rec1', '2025-07', conf)).toBe(false);
    expect(isConfirmedForMonth('rec2', '2025-06', conf)).toBe(false);
  });
});
