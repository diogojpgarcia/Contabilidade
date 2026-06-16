import { describe, it, expect } from 'vitest';
import { normalizeDesc, tokensOf, descMatchesPattern, derivePattern } from '../src/utils/textMatch.js';

describe('normalizeDesc / tokensOf', () => {
  it('normaliza pontuação e espaços', () => {
    expect(normalizeDesc('UBER *EATS  Portugal')).toBe('uber eats portugal');
    expect(normalizeDesc('UBER*TRIP')).toBe('uber trip');
  });
  it('extrai tokens significativos (sem ruído nem curtos)', () => {
    expect(tokensOf('PAGAMENTO UBER EATS via MBWAY')).toEqual(['uber', 'eats']);
    expect(tokensOf('Compra POS Continente')).toEqual(['continente']);
  });
});

describe('descMatchesPattern', () => {
  it('faz match com padrão multi-palavra apesar de pontuação', () => {
    expect(descMatchesPattern('UBER *EATS LISBOA', 'uber eats')).toBe(true);
    expect(descMatchesPattern('UBER *TRIP', 'uber eats')).toBe(false);
    expect(descMatchesPattern('UBER *TRIP', 'uber')).toBe(true);
  });
});

describe('derivePattern — diferenciar Uber Eats vs Uber Rides', () => {
  it('devolve o padrão específico quando os rejeitados partilham o 1.º token', () => {
    // Utilizador seleciona os Eats, deixa os Rides de fora → "uber" é ambíguo.
    const pat = derivePattern(
      'UBER *EATS',
      ['UBER *EATS', 'UBER EATS PORTUGAL'],
      ['UBER *TRIP', 'UBER BV RIDES'],
    );
    expect(pat).toBe('uber eats');
  });

  it('usa o padrão amplo quando não há rejeitados', () => {
    const pat = derivePattern('CONTINENTE LISBOA', ['CONTINENTE LISBOA', 'CONTINENTE PORTO'], []);
    expect(pat).toBe('continente');
  });

  it('devolve null se nenhum prefixo da seed separar selecionados de rejeitados', () => {
    // Selecionado e rejeitado têm exatamente a mesma descrição → indistinguível.
    const pat = derivePattern('UBER EATS', ['UBER EATS'], ['UBER EATS']);
    expect(pat).toBeNull();
  });

  it('dismiss: aprende padrão que não toca nos irmãos deixados de fora', () => {
    const pat = derivePattern('UBER EATS', ['UBER EATS'], ['UBER TRIP']);
    expect(pat).toBe('uber eats');
  });
});
