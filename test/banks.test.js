import { describe, it, expect } from 'vitest';
import { parseCSV } from '../src/utils/parseBankFile.js';

// O parser anexa o saldo corrente (balance) quando o extrato o tem; estes casos
// validam só {date,type,amount,description}, por isso ignoramos esse campo.
const omitBalance = ({ balance: _b, ...r }) => r;

// Cobertura dos principais formatos de exportação CSV da banca portuguesa
// (+ neobancos). Cada caso valida nº de transações, data, tipo, montante e
// descrição. Protege a deteção data-driven de colunas contra regressões.
const CASES = {
  'CGD Caixadirecta (Débito/Crédito + metadados)': {
    csv: `Conta: 0123456789
Período: 01-06-2026 a 14-06-2026

Data mov.;Data valor;Descrição;Débito;Crédito;Saldo
12-06-2026;12-06-2026;COMPRA PINGO DOCE;32,15;;1.000,00
11-06-2026;11-06-2026;TRF MB WAY;;50,00;1.032,15
10-06-2026;10-06-2026;ORDENADO EMPRESA XYZ;;1.500,00;982,15`,
    expect: [
      { date: '2026-06-12', type: 'expense', amount: 32.15, description: 'COMPRA PINGO DOCE' },
      { date: '2026-06-11', type: 'income',  amount: 50,    description: 'TRF MB WAY' },
      { date: '2026-06-10', type: 'income',  amount: 1500,  description: 'ORDENADO EMPRESA XYZ' },
    ],
  },
  'Millennium BCP (Valor assinado)': {
    csv: `Data movimento;Data valor;Descritivo;Valor;Saldo após movimento
12-06-2026;12-06-2026;COMPRA CONTINENTE LDA;-45,90;1.000,00
11-06-2026;11-06-2026;VENC. ORDENADO;1.500,00;1.045,90`,
    expect: [
      { date: '2026-06-12', type: 'expense', amount: 45.9, description: 'COMPRA CONTINENTE LDA' },
      { date: '2026-06-11', type: 'income',  amount: 1500, description: 'VENC. ORDENADO' },
    ],
  },
  'Novo Banco (Movimento/Valor)': {
    csv: `Data Operação;Data Valor;Movimento;Valor;Saldo Disponível
12/06/2026;12/06/2026;PAGAMENTO SERVICOS EDP;-62,30;1.000,00
11/06/2026;11/06/2026;TRANSFERENCIA RECEBIDA;200,00;1.062,30`,
    expect: [
      { date: '2026-06-12', type: 'expense', amount: 62.3, description: 'PAGAMENTO SERVICOS EDP' },
      { date: '2026-06-11', type: 'income',  amount: 200,  description: 'TRANSFERENCIA RECEBIDA' },
    ],
  },
  'BPI (Valor (EUR) + Saldo)': {
    csv: `Data Movimento;Data Valor;Descrição;Valor (EUR);Saldo Contabilístico (EUR)
2026-06-12;2026-06-12;LEVANTAMENTO ATM;-40,00;1.000,00
2026-06-11;2026-06-11;DEPOSITO;500,00;1.040,00`,
    expect: [
      { date: '2026-06-12', type: 'expense', amount: 40,  description: 'LEVANTAMENTO ATM' },
      { date: '2026-06-11', type: 'income',  amount: 500, description: 'DEPOSITO' },
    ],
  },
  'ActivoBank (Montante + Saldo)': {
    csv: `Data;Descrição;Montante;Saldo
12-06-2026;MB WAY ENVIO;-15,00;800,00
11-06-2026;REEMBOLSO;15,00;815,00`,
    expect: [
      { date: '2026-06-12', type: 'expense', amount: 15, description: 'MB WAY ENVIO' },
      { date: '2026-06-11', type: 'income',  amount: 15, description: 'REEMBOLSO' },
    ],
  },
  'Montepio (Débito/Crédito)': {
    csv: `Data Lançamento;Data Valor;Descrição;Débito;Crédito;Saldo
12-06-2026;12-06-2026;COMPRA FARMACIA;12,50;;500,00
11-06-2026;11-06-2026;JUROS;;1,20;512,50`,
    expect: [
      { date: '2026-06-12', type: 'expense', amount: 12.5, description: 'COMPRA FARMACIA' },
      { date: '2026-06-11', type: 'income',  amount: 1.2,  description: 'JUROS' },
    ],
  },
  'Crédito Agrícola (Importância + D/C)': {
    csv: `Data;Descritivo;Importância;D/C;Saldo
12-06-2026;COMPRA LIDL;23,45;D;1.000,00
11-06-2026;TRANSFERENCIA;100,00;C;1.023,45`,
    expect: [
      { date: '2026-06-12', type: 'expense', amount: 23.45, description: 'COMPRA LIDL' },
      { date: '2026-06-11', type: 'income',  amount: 100,   description: 'TRANSFERENCIA' },
    ],
  },
  'EuroBic (Valor a Débito/Crédito)': {
    csv: `Data;Descrição;Valor a Débito;Valor a Crédito;Saldo
12-06-2026;COMPRA WORTEN;199,99;;800,00
11-06-2026;ORDENADO;;1.500,00;999,99`,
    expect: [
      { date: '2026-06-12', type: 'expense', amount: 199.99, description: 'COMPRA WORTEN' },
      { date: '2026-06-11', type: 'income',  amount: 1500,   description: 'ORDENADO' },
    ],
  },
  'Bankinter (Importe assinado)': {
    csv: `Fecha;Fecha valor;Concepto;Importe;Saldo
12/06/2026;12/06/2026;COMPRA AMAZON;-55,00;1.000,00
11/06/2026;11/06/2026;NOMINA;1.500,00;1.055,00`,
    expect: [
      { date: '2026-06-12', type: 'expense', amount: 55,   description: 'COMPRA AMAZON' },
      { date: '2026-06-11', type: 'income',  amount: 1500, description: 'NOMINA' },
    ],
  },
  'Revolut (EN, datas com hora)': {
    csv: `Type,Product,Started Date,Completed Date,Description,Amount,Fee,Currency,State,Balance
CARD_PAYMENT,Current,2026-06-12 08:23:11,2026-06-12 09:00:00,Lidl,-12.50,0.00,EUR,COMPLETED,487.50
TOPUP,Current,2026-06-11 09:00:00,2026-06-11 09:00:01,Salary,1500.00,0.00,EUR,COMPLETED,1987.50`,
    expect: [
      { date: '2026-06-12', type: 'expense', amount: 12.5, description: 'Lidl' },
      { date: '2026-06-11', type: 'income',  amount: 1500, description: 'Salary' },
    ],
  },
  'N26 (EN, Payee/Amount)': {
    csv: `Date,Payee,Account number,Transaction type,Payment reference,Amount (EUR),Amount (Foreign Currency),Type Foreign Currency,Exchange Rate
2026-06-12,Spotify,DE123,Direct Debit,Subscription,-9.99,,,
2026-06-11,Employer,DE999,Income,Salary,2000.00,,,`,
    expect: [
      { date: '2026-06-12', type: 'expense', amount: 9.99, description: 'Spotify' },
      { date: '2026-06-11', type: 'income',  amount: 2000, description: 'Employer' },
    ],
  },
  'Wise (EN, muitas colunas)': {
    csv: `TransferWise ID,Date,Amount,Currency,Description,Payment Reference,Running Balance,Exchange From,Exchange To,Exchange Rate,Payer Name,Payee Name
123,12-06-2026,-30.00,EUR,Card transaction,,470.00,,,,,Store
124,11-06-2026,500.00,EUR,Received money,,500.00,,,,John,`,
    expect: [
      { date: '2026-06-12', type: 'expense', amount: 30,  description: 'Card transaction' },
      { date: '2026-06-11', type: 'income',  amount: 500, description: 'Received money' },
    ],
  },
};

for (const [bank, { csv, expect: expected }] of Object.entries(CASES)) {
  describe(`import: ${bank}`, () => {
    const rows = parseCSV(csv);
    it(`reconhece ${expected.length} transações`, () => {
      expect(rows.length).toBe(expected.length);
    });
    expected.forEach((exp, i) => {
      it(`linha ${i + 1} — ${exp.description} (${exp.type} ${exp.amount})`, () => {
        expect(omitBalance(rows[i])).toEqual(exp);
      });
    });
  });
}
