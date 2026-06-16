# Migrações de base de dados (Supabase)

Estas migrações são SQL para correr manualmente no **Supabase Dashboard → SQL Editor**.
Não correm no `vite build` nem nos testes — têm de ser aplicadas na BD à mão.

## Migrações

| Ficheiro | Descrição | Estado |
|---|---|---|
| `migrations/001_transactions_account_columns.sql` | Promove `account_id`/`account_name` a colunas reais em `transactions` + backfill a partir do `transactionAccountMap` | ✅ aplicada (2026-06-16) |
| `migrations/002_client_mutation_id.sql` | Coluna `client_mutation_id` + índice UNIQUE para idempotência das escritas offline (fecha a janela de duplicação no flush) | ✅ aplicada (2026-06-16) |

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

**Fase 2 — FEITA (2026-06-16).** Depois de a migração 001 estar aplicada:
- `transactionAccountMap` removido por completo de `useTransactions.js` e
  `useSettings.js` (estado, leituras e escritas).
- Fallback de colunas de conta em falta removido de `supabase.js`
  (`addTransaction`, `updateAccountName`, `migrateUnlinkedTransactions`).
  O `updateTransaction` mantém apenas um fallback para a coluna `subcategory`,
  que **não** foi coberta pela migração 001 (ver nota abaixo).
- A chave `transactionAccountMap` que ainda exista nos `user_settings` é
  inofensiva (deixou de ser lida); pode ser limpa um dia, sem urgência.

> Nota: a coluna `subcategory` continua opcional/incerta no schema. Se for
> adicionada numa migração futura, o último fallback do `updateTransaction`
> pode também ser removido.
