-- db/rls.sql — Row Level Security para a app (Contabilidade)
--
-- ⚠️ A SEGURANÇA DOS DADOS DEPENDE DESTAS POLÍTICAS.
-- O cliente usa a anon key (pública) e o acesso é feito diretamente às tabelas;
-- sem RLS correto, qualquer utilizador autenticado pode ler/alterar/apagar linhas
-- de OUTRO utilizador. O código já filtra por user_id (defesa em profundidade),
-- mas o RLS é a fronteira real, aplicada no servidor.
--
-- COMO APLICAR: cola este script no Supabase Dashboard → SQL Editor → Run.
-- Idempotente (drop policy if exists + create) — pode correr-se várias vezes.
-- Revê os nomes das tabelas/colunas antes de aplicar.

-- ── transactions ────────────────────────────────────────────────────────────
alter table public.transactions enable row level security;

drop policy if exists "transactions_select_own" on public.transactions;
create policy "transactions_select_own"
  on public.transactions for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "transactions_insert_own" on public.transactions;
create policy "transactions_insert_own"
  on public.transactions for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "transactions_update_own" on public.transactions;
create policy "transactions_update_own"
  on public.transactions for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "transactions_delete_own" on public.transactions;
create policy "transactions_delete_own"
  on public.transactions for delete
  to authenticated
  using (auth.uid() = user_id);

-- ── user_settings ───────────────────────────────────────────────────────────
alter table public.user_settings enable row level security;

drop policy if exists "user_settings_select_own" on public.user_settings;
create policy "user_settings_select_own"
  on public.user_settings for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "user_settings_insert_own" on public.user_settings;
create policy "user_settings_insert_own"
  on public.user_settings for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "user_settings_update_own" on public.user_settings;
create policy "user_settings_update_own"
  on public.user_settings for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "user_settings_delete_own" on public.user_settings;
create policy "user_settings_delete_own"
  on public.user_settings for delete
  to authenticated
  using (auth.uid() = user_id);

-- ── Verificação rápida (opcional) ───────────────────────────────────────────
-- select schemaname, tablename, rowsecurity
--   from pg_tables where tablename in ('transactions','user_settings');
-- select tablename, policyname, cmd from pg_policies
--   where tablename in ('transactions','user_settings') order by tablename, cmd;
