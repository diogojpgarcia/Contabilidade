import { describe, it, expect } from 'vitest';
import { toBudgetLabel } from '../src/utils/categories-professional.js';

// Garante que as categorias internas do import e variantes sem acento se
// traduzem nas labels canónicas do orçamento (senão as transações importadas
// não apareciam em nenhuma categoria).
describe('toBudgetLabel', () => {
  it('acerta acentos/casing', () => {
    expect(toBudgetLabel('Alimentacao')).toBe('Alimentação');
    expect(toBudgetLabel('Saude')).toBe('Saúde');
    expect(toBudgetLabel('habitacao')).toBe('Habitação');
  });
  it('mapeia a taxonomia interna do import', () => {
    expect(toBudgetLabel('Transportes')).toBe('Transporte');
    expect(toBudgetLabel('Contas')).toBe('Utilities');
    expect(toBudgetLabel('Financas')).toBe('Serviços Financeiros');
    expect(toBudgetLabel('Entretenimento')).toBe('Lazer & Entretenimento');
    expect(toBudgetLabel('Rendimentos')).toBe('Outros Rendimentos');
  });
  it('mantém labels já corretas', () => {
    expect(toBudgetLabel('Alimentação')).toBe('Alimentação');
    expect(toBudgetLabel('Transporte')).toBe('Transporte');
    expect(toBudgetLabel('Outros')).toBe('Outros');
  });
  it('devolve o valor original se não houver correspondência', () => {
    expect(toBudgetLabel('Categoria Personalizada XYZ')).toBe('Categoria Personalizada XYZ');
    expect(toBudgetLabel('')).toBe('');
  });
});
