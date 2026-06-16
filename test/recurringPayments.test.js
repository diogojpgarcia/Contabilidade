import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  safeNum,
  advanceByFrequency,
  computeNextDueDate,
  getOccurrencesInRange,
  getMonthlyEquivalent,
  getTotalMonthlyCommitted,
  getUpcomingPayments,
  getPendingConfirmations,
} from '../src/utils/recurringPayments.js';

describe('safeNum', () => {
  it('converte ou devolve 0 (nunca NaN)', () => {
    expect(safeNum('12.5')).toBe(12.5);
    expect(safeNum('abc')).toBe(0);
    expect(safeNum(null)).toBe(0);
    expect(safeNum(undefined)).toBe(0);
    expect(safeNum(Infinity)).toBe(0);
  });
});

describe('advanceByFrequency', () => {
  it('monthly +1 mês', () => {
    expect(advanceByFrequency('2025-01-15', { frequency: 'monthly' })).toBe('2025-02-15');
  });
  it('weekly +7 dias', () => {
    expect(advanceByFrequency('2025-01-01', { frequency: 'weekly' })).toBe('2025-01-08');
  });
  it('yearly +1 ano', () => {
    expect(advanceByFrequency('2025-02-28', { frequency: 'yearly' })).toBe('2026-02-28');
  });
  it('custom usa customDays', () => {
    expect(advanceByFrequency('2025-01-01', { frequency: 'custom', customDays: 10 })).toBe('2025-01-11');
  });
  it('custom sem customDays → 30 dias', () => {
    expect(advanceByFrequency('2025-01-01', { frequency: 'custom' })).toBe('2025-01-31');
  });
  it('monthly respeita meses curtos (31 jan → 28 fev)', () => {
    expect(advanceByFrequency('2025-01-31', { frequency: 'monthly' })).toBe('2025-02-28');
  });
});

describe('computeNextDueDate', () => {
  it('startDate no futuro → devolve o startDate', () => {
    const p = { frequency: 'monthly', startDate: '2030-01-01' };
    expect(computeNextDueDate(p, '2025-01-01')).toBe('2030-01-01');
  });

  it('monthly: salta para a 1.ª ocorrência >= from', () => {
    const p = { frequency: 'monthly', startDate: '2025-01-15' };
    expect(computeNextDueDate(p, '2025-03-20')).toBe('2025-04-15');
  });

  it('monthly: ocorrência no próprio from conta como válida', () => {
    const p = { frequency: 'monthly', startDate: '2025-01-15' };
    expect(computeNextDueDate(p, '2025-03-15')).toBe('2025-03-15');
  });

  it('weekly: primeira ocorrência >= from', () => {
    const p = { frequency: 'weekly', startDate: '2025-01-01' };
    expect(computeNextDueDate(p, '2025-01-10')).toBe('2025-01-15');
  });

  it('yearly: aniversário exato no from', () => {
    const p = { frequency: 'yearly', startDate: '2020-06-16' };
    expect(computeNextDueDate(p, '2025-06-16')).toBe('2025-06-16');
  });

  it('monthly arranque em mês curto não fica para trás', () => {
    const p = { frequency: 'monthly', startDate: '2025-01-31' };
    expect(computeNextDueDate(p, '2025-02-15')).toBe('2025-02-28');
  });
});

describe('getOccurrencesInRange', () => {
  it('devolve todas as ocorrências dentro do intervalo', () => {
    const p = { frequency: 'monthly', startDate: '2025-01-10' };
    expect(getOccurrencesInRange(p, '2025-01-01', '2025-03-31'))
      .toEqual(['2025-01-10', '2025-02-10', '2025-03-10']);
  });
  it('vazio se a primeira ocorrência é depois do fim', () => {
    const p = { frequency: 'monthly', startDate: '2025-06-10' };
    expect(getOccurrencesInRange(p, '2025-01-01', '2025-03-31')).toEqual([]);
  });
  it('vazio sem startDate', () => {
    expect(getOccurrencesInRange({ frequency: 'monthly' }, '2025-01-01', '2025-12-31')).toEqual([]);
  });
});

describe('getMonthlyEquivalent / getTotalMonthlyCommitted', () => {
  it('monthly = montante', () => {
    expect(getMonthlyEquivalent({ frequency: 'monthly', amount: 50 })).toBe(50);
  });
  it('weekly = amount * 52/12', () => {
    expect(getMonthlyEquivalent({ frequency: 'weekly', amount: 10 })).toBeCloseTo(43.333, 2);
  });
  it('yearly = amount / 12', () => {
    expect(getMonthlyEquivalent({ frequency: 'yearly', amount: 120 })).toBe(10);
  });
  it('custom = amount * 30/dias', () => {
    expect(getMonthlyEquivalent({ frequency: 'custom', customDays: 15, amount: 30 })).toBe(60);
  });
  it('total ignora inativos', () => {
    const ps = [
      { frequency: 'monthly', amount: 50 },
      { frequency: 'monthly', amount: 30, active: false },
      { frequency: 'yearly', amount: 120 },
    ];
    expect(getTotalMonthlyCommitted(ps)).toBe(60); // 50 + 10
  });
});

describe('getUpcomingPayments', () => {
  it('ordena por próxima data e limita ao count, ignorando inativos', () => {
    const ps = [
      { id: 'b', frequency: 'monthly', startDate: '2025-01-20' },
      { id: 'a', frequency: 'monthly', startDate: '2025-01-05' },
      { id: 'x', frequency: 'monthly', startDate: '2025-01-01', active: false },
    ];
    const up = getUpcomingPayments(ps, 5, '2025-01-01');
    expect(up.map(p => p.id)).toEqual(['a', 'b']);
    expect(up[0].computedNextDue).toBe('2025-01-05');
  });
});

describe('getPendingConfirmations (depende de "hoje")', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-06-16T12:00:00'));
  });
  afterEach(() => vi.useRealTimers());

  // computeNextDueDate devolve sempre a próxima ocorrência >= hoje, e a função
  // só inclui aquelas cuja próxima data cai exatamente em "hoje" (dia 16).
  it('lista pagamentos com vencimento hoje, ainda não confirmados', () => {
    const ps = [{ id: 'p1', frequency: 'monthly', startDate: '2025-03-16' }];
    const pending = getPendingConfirmations(ps, {});
    expect(pending).toHaveLength(1);
    expect(pending[0].id).toBe('p1');
    expect(pending[0].dueDate).toBe('2025-06-16');
  });

  it('exclui os já confirmados nesse mês', () => {
    const ps = [{ id: 'p1', frequency: 'monthly', startDate: '2025-03-16' }];
    const due = getPendingConfirmations(ps, {})[0];
    const confirmed = { p1: { [due.monthKey]: true } };
    expect(getPendingConfirmations(ps, confirmed)).toHaveLength(0);
  });

  it('exclui inativos', () => {
    const ps = [{ id: 'p1', frequency: 'monthly', startDate: '2025-03-16', active: false }];
    expect(getPendingConfirmations(ps, {})).toHaveLength(0);
  });
});
