-- ============================================================================
-- Migração 002 — chave de idempotência para escritas offline
-- ============================================================================
-- Porquê: ao reproduzir a fila offline, há uma janela rara de duplicação se a
-- app fechar entre o insert e a remoção da entrada da fila (ou se o ack de um
-- insert online se perder). Esta coluna + índice UNIQUE permitem um
-- upsert ON CONFLICT DO NOTHING: re-enviar a mesma mutação devolve a mesma
-- linha em vez de criar um duplicado.
--
-- Independente do tipo da coluna `id` (uuid ou bigint) — a chave é gerada no
-- cliente e vive numa coluna própria.
--
-- Como correr: Supabase Dashboard → SQL Editor → cola e executa. Idempotente.
-- ============================================================================

-- 1) Coluna (text — UUID gerado no cliente). Linhas antigas ficam a NULL.
alter table public.transactions
  add column if not exists client_mutation_id text;

-- 2) Índice UNIQUE. Em Postgres, NULLs são distintos entre si, por isso as
--    linhas antigas (client_mutation_id IS NULL) não colidem — a unicidade só
--    é imposta sobre valores não-nulos. Necessário para o ON CONFLICT.
create unique index if not exists uq_transactions_client_mutation_id
  on public.transactions (client_mutation_id);

-- ============================================================================
-- O código degrada graciosamente: enquanto esta migração não correr, os inserts
-- offline usam o caminho normal (sem idempotência). Depois de aplicada, o flush
-- passa a usar o upsert e a janela de duplicação fecha.
-- ============================================================================
