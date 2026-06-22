import { describe, it, expect } from 'vitest';
import {
  normImportDesc, importHashBase, assignImportSeqs, findExistingDuplicates,
} from '../src/utils/importDedup.js';

describe('normImportDesc', () => {
  it('minúsculas, sem acentos, alfanumérico, limite 60', () => {
    expect(normImportDesc('Café CÊNTRICO, Lda.')).toBe('cafe centrico lda');
    expect(normImportDesc(null)).toBe('');
  });
});

describe('importHashBase', () => {
  it('data|montante(2dp)|descrição normalizada', () => {
    expect(importHashBase('2026-06-12', 1.5, 'Café')).toBe('2026-06-12|1.50|cafe');
  });
});

describe('assignImportSeqs', () => {
  it('0 na 1ª ocorrência, 1,2… nas repetições da mesma chave', () => {
    const rows = [
      { date: '2026-06-12', amount: 1.5, description: 'Café' },
      { date: '2026-06-12', amount: 1.5, description: 'Café' }, // igual → seq 1
      { date: '2026-06-12', amount: 2.0, description: 'Café' }, // montante difere → seq 0
      { date: '2026-06-13', amount: 1.5, description: 'Café' }, // data difere → seq 0
    ];
    expect(assignImportSeqs(rows)).toEqual([0, 1, 0, 0]);
  });
});

describe('findExistingDuplicates', () => {
  const rows = [
    { date: '2026-06-12', amount: 1.5, type: 'expense', description: 'Café' },
    { date: '2026-06-12', amount: 1.5, type: 'expense', description: 'Café' },
    { date: '2026-06-20', amount: 1000, type: 'income', description: 'Ordenado' },
  ];

  it('re-import total: tudo já existe → todos marcados', () => {
    const acc = [
      { date: '2026-06-12', amount: 1.5, type: 'expense', description: 'Café' },
      { date: '2026-06-12', amount: 1.5, type: 'expense', description: 'Café' },
      { date: '2026-06-20', amount: 1000, type: 'income', description: 'Ordenado' },
    ];
    expect([...findExistingDuplicates(rows, acc)].sort()).toEqual([0, 1, 2]);
  });

  it('contagem: 2 cafés no ficheiro, 1 já na conta → só 1 marcado', () => {
    const acc = [{ date: '2026-06-12', amount: 1.5, type: 'expense', description: 'Café' }];
    expect(findExistingDuplicates(rows, acc).size).toBe(1);
  });

  it('tipo conta para o match (despesa vs receita do mesmo valor)', () => {
    const acc = [{ date: '2026-06-20', amount: 1000, type: 'expense', description: 'Ordenado' }];
    // a linha 2 é income → não casa com a existente expense
    expect(findExistingDuplicates(rows, acc).has(2)).toBe(false);
  });

  it('conta vazia → nada marcado', () => {
    expect(findExistingDuplicates(rows, []).size).toBe(0);
  });
});
