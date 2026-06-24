import { describe, it, expect } from 'vitest';
import { buildInbox, INBOX_PRIORITY } from '../src/utils/homeInbox.js';

const TODAY = '2026-06-24';

// ── Fixtures ─────────────────────────────────────────────────────────────────
const rentDue = {
  id: 'r1', title: 'Renda', amount: 650, frequency: 'monthly',
  startDate: '2026-01-22', active: true, paymentType: 'fixed',
};
const futurePayment = {
  id: 'r2', title: 'Ginásio', amount: 30, frequency: 'monthly',
  startDate: '2026-07-05', active: true, paymentType: 'fixed', // começa no futuro
};
const water = {
  id: 'r3', title: 'Água', amount: 30, frequency: 'monthly',
  startDate: '2026-02-10', active: true, paymentType: 'variable', estimatedAmount: 28,
};

const accounts = [
  { id: 'a1', name: 'Activobank', reconciledAt: '2026-06-10' },        // 14d → fresco (staleDays 30)
  { id: 'a2', name: 'Revolut', reconciledAt: '2026-04-01' },           // ~84d → stale
  { id: 'a3', name: 'Cofre' },                                          // nunca → never
];

const txns = [
  { id: 't1', date: '2026-06-20', category: 'Outros', type: 'expense', amount: 12 },
  { id: 't2', date: '2026-06-21', category: '', type: 'expense', amount: 8 },
  { id: 't3', date: '2026-06-22', category: 'Alimentação', type: 'expense', amount: 40 },
  { id: 't4', date: '2026-01-01', category: 'Outros', type: 'expense', amount: 5 }, // fora da janela
];

// ── recurring-due ────────────────────────────────────────────────────────────
describe('buildInbox · recurring-due', () => {
  it('inclui recorrente vencido e não confirmado', () => {
    const inbox = buildInbox({ recurringPayments: [rentDue], today: TODAY });
    const item = inbox.find(i => i.type === 'recurring-due');
    expect(item).toBeTruthy();
    expect(item.action.paymentId).toBe('r1');
    expect(item.meta.dueDate).toBe('2026-06-22'); // ocorrência deste mês <= today
    expect(item.meta.daysOverdue).toBe(2);
    expect(item.subtitle).toContain('650.00€');
    expect(item.subtitle).toContain('há 2 dias');
  });

  it('exclui recorrente já confirmado para o mês', () => {
    const confirmed = { r1: { '2026-06': { transactionId: 'tx-paid' } } };
    const inbox = buildInbox({ recurringPayments: [rentDue], confirmedRecurring: confirmed, today: TODAY });
    expect(inbox.some(i => i.type === 'recurring-due')).toBe(false);
  });

  it('exclui recorrente que ainda não começou (sem ocorrências até hoje)', () => {
    const inbox = buildInbox({ recurringPayments: [futurePayment], today: TODAY });
    expect(inbox.some(i => i.type === 'recurring-due')).toBe(false);
  });

  it('mostra ocorrência por confirmar de um ciclo anterior dentro da janela', () => {
    // Netflix dia 28: a 24/jun, a ocorrência de 28/mai (27 dias) está por confirmar.
    const netflix = { id: 'r9', title: 'Netflix', amount: 13.99, frequency: 'monthly', startDate: '2026-01-28', active: true, paymentType: 'fixed' };
    const inbox = buildInbox({ recurringPayments: [netflix], today: TODAY });
    const item = inbox.find(i => i.type === 'recurring-due');
    expect(item).toBeTruthy();
    expect(item.meta.dueDate).toBe('2026-05-28');
  });

  it('exclui recorrentes inativos', () => {
    const inbox = buildInbox({ recurringPayments: [{ ...rentDue, active: false }], today: TODAY });
    expect(inbox.length).toBe(0);
  });

  it('usa o valor estimado (~) em pagamentos variáveis', () => {
    const inbox = buildInbox({ recurringPayments: [water], today: TODAY });
    const item = inbox.find(i => i.type === 'recurring-due');
    expect(item.subtitle).toContain('~28.00€');
    expect(item.meta.amount).toBe(28);
  });
});

// ── uncategorized ────────────────────────────────────────────────────────────
describe('buildInbox · uncategorized', () => {
  it('agrega transações recentes por categorizar (Outros ou vazias)', () => {
    const inbox = buildInbox({ transactions: txns, today: TODAY });
    const item = inbox.find(i => i.type === 'uncategorized');
    expect(item).toBeTruthy();
    expect(item.meta.count).toBe(2); // t1 + t2; t3 tem categoria; t4 fora da janela
    expect(item.title).toContain('2 transações');
  });

  it('singular quando é só uma', () => {
    const inbox = buildInbox({ transactions: [txns[0]], today: TODAY });
    const item = inbox.find(i => i.type === 'uncategorized');
    expect(item.title).toContain('1 transação por categorizar');
  });

  it('não cria item quando não há nada por categorizar', () => {
    const inbox = buildInbox({ transactions: [txns[2]], today: TODAY });
    expect(inbox.some(i => i.type === 'uncategorized')).toBe(false);
  });

  it('respeita a janela temporal', () => {
    const inbox = buildInbox({ transactions: [txns[3]], today: TODAY }); // só a antiga
    expect(inbox.some(i => i.type === 'uncategorized')).toBe(false);
  });
});

// ── reconcile-stale ──────────────────────────────────────────────────────────
describe('buildInbox · reconcile-stale', () => {
  it('inclui contas nunca conferidas e antigas, exclui frescas', () => {
    const inbox = buildInbox({ accounts, today: TODAY });
    const stale = inbox.filter(i => i.type === 'reconcile-stale');
    const ids = stale.map(i => i.action.accountId);
    expect(ids).toContain('a3'); // never
    expect(ids).toContain('a2'); // stale
    expect(ids).not.toContain('a1'); // fresca
  });

  it('conta nunca conferida fica acima da apenas antiga', () => {
    const inbox = buildInbox({ accounts, today: TODAY });
    const stale = inbox.filter(i => i.type === 'reconcile-stale');
    expect(stale[0].action.accountId).toBe('a3'); // never (days=Infinity) primeiro
    expect(stale[0].subtitle).toBe('Saldo nunca conferido');
  });
});

// ── ordenação & estados ──────────────────────────────────────────────────────
describe('buildInbox · ordenação e estados', () => {
  it('ordena por prioridade: recorrentes → categorizar → conferir', () => {
    const inbox = buildInbox({
      recurringPayments: [rentDue], transactions: txns, accounts, today: TODAY,
    });
    const types = inbox.map(i => i.type);
    expect(types[0]).toBe('recurring-due');
    expect(types.indexOf('uncategorized')).toBeLessThan(types.indexOf('reconcile-stale'));
    // sanidade: prioridades coerentes com a ordem
    for (let i = 1; i < inbox.length; i++) {
      expect(inbox[i].priority).toBeGreaterThanOrEqual(inbox[i - 1].priority);
    }
  });

  it('inbox-zero devolve lista vazia', () => {
    expect(buildInbox({ today: TODAY })).toEqual([]);
    expect(buildInbox({ recurringPayments: [], transactions: [], accounts: [], today: TODAY })).toEqual([]);
  });

  it('expõe o mapa de prioridades', () => {
    expect(INBOX_PRIORITY['recurring-due']).toBeLessThan(INBOX_PRIORITY['uncategorized']);
    expect(INBOX_PRIORITY['uncategorized']).toBeLessThan(INBOX_PRIORITY['reconcile-stale']);
  });
});
