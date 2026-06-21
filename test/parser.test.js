import { describe, it, expect } from 'vitest';
import { detectColumns, parseCSV, extractClosingBalance } from '../src/utils/parseBankFile.js';

// Regressão: extratos Santander têm colunas "Data valor" e "Montante( EUR )".
// O keyword 'valor' fazia "Data valor" ganhar a deteção de montante, e o parser
// lia a DATA como número (ex. 12062026). Garantir que isto não volta.
describe('parseBankFile — detectColumns (layout Santander)', () => {
  const headers = ['Data Operação', 'Data valor', 'Descrição', 'Montante( EUR )', 'Saldo Contabilístico( EUR )'];

  it('deteta a coluna de data correta', () => {
    expect(detectColumns(headers).date).toBe('Data valor');
  });
  it('NÃO escolhe a coluna de data como coluna de montante', () => {
    expect(detectColumns(headers).amt).not.toBe('Data valor');
  });
});

describe('parseBankFile — parseCSV (layout Santander, ; e decimais PT)', () => {
  const csv = `Data Operação;Data valor;Descrição;Montante( EUR );Saldo Contabilístico( EUR )
12-06-2026;12-06-2026;Mts Metro Transporte;-1,35;226,32
11-06-2026;11-06-2026;Boa Turma 4;-1,87;227,67
09-06-2026;09-06-2026;Ordenado;1.500,00;1.726,32`;

  const rows = parseCSV(csv);

  it('reconhece as 3 transações', () => {
    expect(rows.length).toBe(3);
  });
  it('usa a coluna Montante (não a data) com o sinal correto — despesa', () => {
    expect(rows.find(r => r.description.includes('Metro'))).toMatchObject({
      amount: 1.35, type: 'expense', date: '2026-06-12',
    });
  });
  it('atribui receita a valores positivos', () => {
    expect(rows.find(r => r.description.includes('Ordenado'))).toMatchObject({
      amount: 1500, type: 'income',
    });
  });
  it('captura o saldo corrente de cada linha', () => {
    expect(rows.find(r => r.description.includes('Metro')).balance).toBe(226.32);
    expect(rows.find(r => r.description.includes('Ordenado')).balance).toBe(1726.32);
  });
});

describe('extractClosingBalance — saldo final do extrato', () => {
  const csv = `Data Operação;Data valor;Descrição;Montante( EUR );Saldo Contabilístico( EUR )
12-06-2026;12-06-2026;Mts Metro Transporte;-1,35;226,32
11-06-2026;11-06-2026;Boa Turma 4;-1,87;227,67
09-06-2026;09-06-2026;Ordenado;1.500,00;1.726,32`;

  it('devolve o saldo da data mais recente (ficheiro descendente)', () => {
    const rows = parseCSV(csv);
    expect(extractClosingBalance(rows)).toEqual({ balance: 226.32, date: '2026-06-12' });
  });
  it('devolve null quando não há coluna de saldo', () => {
    const noBal = `Data;Descrição;Montante
12-06-2026;Café;-1,35
11-06-2026;Ordenado;1.500,00`;
    expect(extractClosingBalance(parseCSV(noBal))).toBeNull();
  });
  it('escolhe a data mais recente independentemente da ordem do ficheiro', () => {
    const ascending = [
      { date: '2026-06-09', balance: 100 },
      { date: '2026-06-12', balance: 250 },
    ];
    expect(extractClosingBalance(ascending)).toEqual({ balance: 250, date: '2026-06-12' });
  });
});
