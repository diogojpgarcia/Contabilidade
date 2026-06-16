# Migrações de base de dados (Supabase)

Estas migrações são SQL para correr manualmente no **Supabase Dashboard → SQL Editor**.
Não correm no `vite build` nem nos testes — têm de ser aplicadas na BD à mão.

## Migrações

| Ficheiro | Descrição | Estado |
|---|---|---|
| `migrations/001_transactions_account_columns.sql` | Promove `account_id`/`account_name` a colunas reais em `transactions` + backfill a partir do `transactionAccountMap` | ⬜ a aplicar |

## 001 — colunas de conta

**Problema que resolve:** a ligação transação↔conta vivia num blob JSON
(`user_settings.settings -> 'transactionAccountMap'`), uma segunda fonte de
verdade frágil, com fallback espalhado pelo código (`useTransactions.js`,
`supabase.js`).

**Fase 1 (esta migração — segura, não destrutiva):**
1. Corre `001_transactions_account_columns.sql` no SQL Editor.
2. Abre a app e confirma que os saldos por conta no Património continuam corretos.
   - O código já prefere a coluna e usa o mapa só como fallback, por isso nada
     parte se a migração ainda não tiver corrido.

**Fase 2 (depois de confirmado — limpeza de código, fazer noutra tarefa):**
- Deixar de escrever/ler `transactionAccountMap` em `useTransactions.js`.
- Remover a lógica de fallback de colunas em falta em `supabase.js`
  (`addTransaction`, `updateTransaction`, `updateAccountName`,
  `migrateUnlinkedTransactions`).
- Opcional: limpar a chave `transactionAccountMap` dos `user_settings`.

> A Fase 2 só deve avançar quando **todos** os utilizadores ativos tiverem a
> coluna preenchida — caso contrário perdem-se associações de conta. Por agora o
> mapa fica como rede de segurança.
