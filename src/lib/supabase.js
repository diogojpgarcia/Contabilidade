import { createClient } from '@supabase/supabase-js'

const supabaseUrl     = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export const authService = {
  supabase, // Export supabase para usar resetPasswordForEmail
  
  async signUp(email, password, fullName) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } }
    })
    if (error) throw error
    return data
  },

  async signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    return data
  },

  async signOut() {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  },

  async getCurrentUser() {
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error) throw error
    return user
  },

  onAuthStateChange(callback) {
    return supabase.auth.onAuthStateChange(callback)
  }
}

// Normalise a raw Supabase row so amount is always a Number.
// Apply this to every row that comes back from the transactions table.
const VALID_TX_TYPES = new Set(['expense', 'income', 'transfer', 'adjustment']);

// Data de hoje em hora LOCAL (não UTC) — evita off-by-one perto da meia-noite
// em fusos a leste de UTC (Portugal no verão = UTC+1).
const localToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

function mapTransaction(raw) {
  if (!raw) throw new Error('updateTransaction: no row returned — transaction may not exist or RLS blocked the update');
  const type = VALID_TX_TYPES.has(raw.type) ? raw.type : 'expense';
  return {
    ...raw,
    amount:      Number(raw.amount) || 0,
    type,
    category:    raw.category    || (type === 'income' ? 'Outros Rendimentos' : 'Outros'),
    description: raw.description || '',
    date:        raw.date        || localToday(),
  };
}


/**
 * Calcula uma chave determinista para uma transação importada de banco.
 * Usada como import_hash único para evitar re-importações duplicadas.
 * Input: date + amount (2 decimais) + descrição normalizada (60 chars).
 * Não usa crypto — é uma string legível e estável entre imports.
 */
export function computeImportHash(date, amount, description, seq = 0) {
  const desc = (description || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60);
  // base tem de ser idêntica a importHashBase() em utils/importDedup.js
  // (usada por assignImportSeqs) — manter a normalização em sincronia.
  const base = `${date}|${parseFloat(amount).toFixed(2)}|${desc}`;
  return seq > 0 ? `${base}#${seq}` : base;
}

// ── Settings write queue ───────────────────────────────────────────────────
// Serialises concurrent updateUserSettings calls per userId so that a
// read-modify-write can never be interleaved with another one for the same user.
const _writeQueues = new Map(); // userId → Promise (tail of the chain)

export const dbService = {
  async getTransactions(userId) {
    // O Supabase corta por defeito a 1000 linhas. Paginamos por blocos para
    // nunca perder transações silenciosamente (saldos/stats ficariam errados).
    const PAGE = 1000;
    let from = 0;
    let all = [];
    for (;;) {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(from, from + PAGE - 1);
      if (error) throw error;
      const batch = data || [];
      all = all.concat(batch);
      if (batch.length < PAGE) break;
      from += PAGE;
    }
    return all.map(mapTransaction);
  },

  async addTransaction(userId, transaction) {
    const { date, description, amount, type, category, account_id, account_name } = transaction;
    const row = { user_id: userId, date, description, amount, type, category };
    if (account_id   != null) row.account_id   = account_id;
    if (account_name != null) row.account_name = account_name;

    const { data, error } = await supabase.from('transactions').insert([row]).select();
    if (error) throw error;
    return mapTransaction(data[0]);
  },

  // Insere de forma idempotente usando client_mutation_id (migração 002):
  // re-enviar a mesma mutação devolve a MESMA linha em vez de duplicar.
  // Degrada para addTransaction se não houver chave ou se a coluna/índice ainda
  // não existirem na BD.
  async addTransactionIdempotent(userId, transaction, mutationId) {
    if (!mutationId) return this.addTransaction(userId, transaction);

    const { date, description, amount, type, category, account_id, account_name } = transaction;
    const row = { user_id: userId, date, description, amount, type, category, client_mutation_id: mutationId };
    if (account_id   != null) row.account_id   = account_id;
    if (account_name != null) row.account_name = account_name;

    try {
      const { data, error } = await supabase
        .from('transactions')
        .upsert([row], { onConflict: 'client_mutation_id', ignoreDuplicates: true })
        .select();
      if (error) throw error;
      if (data && data.length) return mapTransaction(data[0]);

      // Conflito: já tinha sido inserida num flush anterior — devolve a existente.
      const { data: existing, error: e2 } = await supabase
        .from('transactions').select('*').eq('client_mutation_id', mutationId).single();
      if (e2) throw e2;
      return mapTransaction(existing);
    } catch (err) {
      // Migração 002 ainda não aplicada (coluna/constraint em falta) → insert normal.
      const isColErr = err.code === 'PGRST204' || err.code === '42703' || err.code === '42P10' ||
        /client_mutation_id|no unique or exclusion constraint|on conflict/i.test(err.message || '');
      if (!isColErr) throw err;
      console.warn('[supabase] client_mutation_id ausente — insert sem idempotência (correr migração 002)');
      return this.addTransaction(userId, transaction);
    }
  },

  async migrateUnlinkedTransactions(userId, accountId, accountName) {
    const { data, error } = await supabase
      .from('transactions')
      .update({ account_id: accountId, account_name: accountName })
      .eq('user_id', userId)
      .is('account_id', null)
      .neq('type', 'transfer')
      .select('id');
    if (error) throw error;
    return (data || []).length;
  },

  // userId (opcional) → adiciona .eq('user_id') como defesa em profundidade,
  // além do RLS. Não altera o comportamento quando o RLS está bem configurado,
  // mas blinda contra um RLS em falta/mal configurado.
  async updateTransaction(transactionId, updates, userId = null) {
    const scope = (q) => (userId ? q.eq('user_id', userId) : q);
    const { data, error } = await scope(
      supabase.from('transactions').update(updates).eq('id', transactionId)
    ).select();
    if (error) {
      // A coluna `subcategory` pode ainda não existir nalgumas BDs — nesse caso
      // repetimos sem ela (os saldos de transferência têm fallback por descrição
      // em computeAccountBalance). As colunas de conta já existem (migração 001).
      const isSubcatErr = error.code === 'PGRST204' || error.code === '42703' ||
        (error.message || '').includes('subcategory');
      if (!isSubcatErr) throw error;
      const { subcategory, ...baseUpdates } = updates;
      if (Object.keys(baseUpdates).length === 0) {
        // Nothing core to update — fetch current row so caller gets a valid object back
        const { data: cur, error: ce } = await scope(
          supabase.from('transactions').select('*').eq('id', transactionId)
        ).single();
        if (ce) throw ce;
        return mapTransaction(cur);
      }
      const { data: d2, error: e2 } = await scope(
        supabase.from('transactions').update(baseUpdates).eq('id', transactionId)
      ).select();
      if (e2) throw e2;
      return mapTransaction(d2?.[0]);
    }
    return mapTransaction(data?.[0]);
  },

  async deleteTransaction(transactionId, userId = null) {
    let q = supabase.from('transactions').delete().eq('id', transactionId);
    if (userId) q = q.eq('user_id', userId);
    const { error } = await q;
    if (error) throw error;
  },

  // deleteAllUserData — removes financial transaction data and user settings.
  // Budget goals, categories, rules etc. are intentionally kept so the user
  // doesn't have to reconfigure the app after a data reset.
  // Propaga o novo nome de uma conta a todas as transações ligadas (DB).
  // Chamado pelo handleAccountRename em useTransactions quando o utilizador
  // renomeia uma conta em PatrimonyView.
  async updateAccountName(userId, accountId, newName) {
    const { error } = await supabase
      .from('transactions')
      .update({ account_name: newName })
      .eq('user_id', userId)
      .eq('account_id', accountId);
    if (error) throw error;
  },

  async deleteAllUserData(userId) {
    if (!userId) throw new Error('userId is required');

    const tables = [
      'transactions',
      'user_settings',
    ];

    for (const table of tables) {
      const { error } = await supabase
        .from(table)
        .delete()
        .eq('user_id', userId);

      // code 42P01 = table does not exist, safe to skip (forward-compat)
      if (error && error.code !== '42P01') {
        throw new Error(`Erro ao apagar ${table}: ${error.message}`);
      }
    }

    // Also wipe any localStorage keys written by legacy code (e.g. security-system.js).
    // Safe to run even if the keys do not exist.
    try {
      localStorage.removeItem(`transactions_${userId}`);
      localStorage.removeItem(`recovery_${userId}`);
      localStorage.removeItem(`user_data_${userId}`);
    } catch (_) { /* localStorage not available (SSR/test env) */ }
  },

  async getUserSettings(userId) {
    const { data, error } = await supabase
      .from('user_settings')
      .select('settings')
      .eq('user_id', userId)
      .single()
    
    if (error && error.code !== 'PGRST116') {
      // PGRST116 = no rows returned (user hasn't created settings yet) — esperado.
      // Outros erros (rede, RLS, etc.) não devem rebentar o boot, mas devem ser
      // registados para não falharem em silêncio.
      console.warn('[supabase] getUserSettings:', error.message || error.code);
      return {};
    }

    return data?.settings || {};
  },


  /**
   * Importação em massa com proteção contra re-import.
   * Cada row deve ter import_hash — conflitos são ignorados via
   * ON CONFLICT (import_hash) DO NOTHING.
   * Devolve { saved: Transaction[], skipped: number }.
   */
  async addTransactionsBulk(userId, transactions) {
    const rows = transactions.map(tx => {
      const row = {
        user_id:     userId,
        date:        tx.date,
        description: tx.description,
        amount:      tx.amount,
        type:        tx.type,
        category:    tx.category,
        import_hash: tx.import_hash || null,
      };
      if (tx.account_id   != null) row.account_id   = tx.account_id;
      if (tx.account_name != null) row.account_name = tx.account_name;
      return row;
    });

    try {
      const { data, error } = await supabase
        .from('transactions')
        .upsert(rows, { onConflict: 'import_hash', ignoreDuplicates: true })
        .select();

      if (error) throw error;

      const saved   = (data || []).map(mapTransaction);
      const skipped = rows.length - saved.length;
      return { saved, skipped };
    } catch (err) {
      // Casos em que o ON CONFLICT (import_hash) não funciona:
      //  - coluna import_hash ainda não existe (PGRST204 / 42703)
      //  - não existe constraint UNIQUE em import_hash → Postgres 42P10
      //    "there is no unique or exclusion constraint matching the ON CONFLICT…"
      const isColErr = err.code === 'PGRST204' || err.code === '42703' ||
        (err.message || '').includes('import_hash');
      const isConstraintErr = err.code === '42P10' ||
        /no unique or exclusion constraint|on conflict/i.test(err.message || '');
      if (!isColErr && !isConstraintErr) throw err;

      // Insert simples, sem dedup ao nível do DB. É seguro porque o preview do
      // import já marca/filtra os duplicados client-side. Se a coluna import_hash
      // existir, guardamo-la na mesma (fica útil quando a constraint for criada).
      const plainRows = isColErr ? rows.map(({ import_hash, ...r }) => r) : rows;
      try {
        const { data, error } = await supabase
          .from('transactions').insert(plainRows).select();
        if (error) throw error;
        return { saved: (data || []).map(mapTransaction), skipped: 0 };
      } catch {
        // Último recurso: inserts individuais (mais lento, mas robusto).
        const saved = [];
        for (const tx of transactions) {
          try {
            const row = await this.addTransaction(userId, tx);
            if (row) saved.push(row);
          } catch (_) { /* ignorar erros individuais */ }
        }
        return { saved, skipped: 0 };
      }
    }
  },

  async updateUserSettings(userId, newSettings) {
    // Serialised via _writeQueues: each call chains onto the previous one so
    // read-modify-write is never interleaved with a concurrent call for the same user.
    const tail = _writeQueues.get(userId) ?? Promise.resolve();

    const next = tail.catch(() => {}).then(async () => {
      const { data: existing } = await supabase
        .from('user_settings')
        .select('settings')
        .eq('user_id', userId)
        .maybeSingle();

      const mergedSettings = { ...(existing?.settings || {}), ...newSettings };

      const { data, error } = await supabase
        .from('user_settings')
        .upsert(
          { user_id: userId, settings: mergedSettings },
          { onConflict: 'user_id' }
        )
        .select()
        .single();

      if (error) throw error;
      return data;
    });

    // Store only the error-suppressed tail so a failed write doesn't block the queue
    _writeQueues.set(userId, next.catch(() => {}));
    return next;
  }
}
