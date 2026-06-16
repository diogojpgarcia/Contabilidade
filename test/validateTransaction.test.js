import { describe, it, expect } from 'vitest';
import { normalizeAmount, isValidDate, validateTransaction } from '../src/utils/validateTransaction.js';

describe('normalizeAmount', () => {
  it('aceita números e strings (com vírgula ou ponto)', () => {
    expect(normalizeAmount(12.5)).toBe(12.5);
    expect(normalizeAmount('12.5')).toBe(12.5);
    expect(normalizeAmount('12,5')).toBe(12.5);
    expect(normalizeAmount('  3 ')).toBe(3);
  });
  it('devolve NaN para inválidos', () => {
    expect(Number.isNaN(normalizeAmount('abc'))).toBe(true);
    expect(Number.isNaN(normalizeAmount(null))).toBe(true);
    expect(Number.isNaN(normalizeAmount(Infinity))).toBe(true);
    expect(Number.isNaN(normalizeAmount(undefined))).toBe(true);
  });
});

describe('isValidDate', () => {
  it('aceita YYYY-MM-DD válidas', () => {
    expect(isValidDate('2026-06-16')).toBe(true);
    expect(isValidDate('2024-02-29')).toBe(true); // bissexto
  });
  it('rejeita formatos/datas inválidas', () => {
    expect(isValidDate('2026-13-01')).toBe(false);
    expect(isValidDate('2026-02-30')).toBe(false);
    expect(isValidDate('16-06-2026')).toBe(false);
    expect(isValidDate('2026-6-1')).toBe(false);
    expect(isValidDate('')).toBe(false);
    expect(isValidDate(null)).toBe(false);
  });
});

describe('validateTransaction', () => {
  const base = { amount: '10', type: 'expense', date: '2026-06-16', description: '  Café  ' };

  it('normaliza amount, type e trim da descrição', () => {
    const out = validateTransaction(base);
    expect(out.amount).toBe(10);
    expect(out.type).toBe('expense');
    expect(out.description).toBe('Café');
  });

  it('coage type desconhecido para expense', () => {
    expect(validateTransaction({ ...base, type: 'xpto' }).type).toBe('expense');
  });

  it('preserva campos extra (account_id, etc.)', () => {
    const out = validateTransaction({ ...base, account_id: 'a1', category: 'Alimentação' });
    expect(out.account_id).toBe('a1');
    expect(out.category).toBe('Alimentação');
  });

  it('lança em valor inválido', () => {
    expect(() => validateTransaction({ ...base, amount: 'abc' })).toThrow('Valor inválido');
    expect(() => validateTransaction({ ...base, amount: -5 })).toThrow('negativo');
  });

  it('lança em data inválida', () => {
    expect(() => validateTransaction({ ...base, date: '2026-02-30' })).toThrow('Data inválida');
    expect(() => validateTransaction({ ...base, date: '' })).toThrow('Data inválida');
  });

  it('lança em objeto inválido', () => {
    expect(() => validateTransaction(null)).toThrow('Transação inválida');
  });
});
