-- ============================================================================
-- Migração 001 — colunas de conta na tabela `transactions`
-- ============================================================================
-- Porquê: hoje a ligação transação↔conta vive num blob JSON
-- (user_settings.settings -> 'transactionAccountMap'), com lógica de fallback
-- espalhada pelo código. Esta migração promove `account_id`/`account_name` a
-- colunas reais e faz o backfill a partir do mapa, para que passem a ser a
-- fonte de verdade. O código já lê a coluna primeiro e o mapa só como fallback,
-- por isso a app continua a funcionar antes e depois desta migração.
--
-- Como correr: Supabase Dashboard → SQL Editor → cola e executa. É idempotente
-- (pode correr-se mais do que uma vez sem efeitos colaterais).
-- ============================================================================

-- 1) Colunas (text — os ids de conta de património são strings).
alter table public.transactions
  add column if not exists account_id   text,
  add column if not exists account_name text;

-- 2) Backfill a partir do transactionAccountMap guardado em user_settings.
--    Só preenche linhas ainda sem account_id, para ser seguro a re-correr.
update public.transactions t
set account_id   = m.value ->> 'account_id',
    account_name = m.value ->> 'account_name'
from public.user_settings us,
     jsonb_each(us.settings -> 'transactionAccountMap') as m(key, value)
where us.user_id = t.user_id
  and m.key = t.id::text
  and t.account_id is null
  and (m.value ->> 'account_id') is not null;

-- 3) Índice para as queries por conta (ex. renomear conta → propagar nome).
create index if not exists idx_transactions_user_account
  on public.transactions (user_id, account_id);

-- ============================================================================
-- Depois de correr esta migração e confirmar que os saldos por conta continuam
-- corretos na app, o `transactionAccountMap` deixa de ser necessário e pode ser
-- removido do código (fase 2 — ver db/README.md).
-- ============================================================================
