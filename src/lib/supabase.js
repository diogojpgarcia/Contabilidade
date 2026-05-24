import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://njiyuslutkskrrnsiinl.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5qaXl1c2x1dGtza3JybnNpaW5sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU5NDAyNzYsImV4cCI6MjA5MTUxNjI3Nn0.LCj-7iTPHOV_sKcEVb1Zl2ryTHj61v10VlrWSdPMd-E'

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

function mapTransaction(raw) {
  if (!raw) throw new Error('updateTransaction: no row returned — transaction may not exist or RLS blocked the update');
  const type = VALID_TX_TYPES.has(raw.type) ? raw.type : 'expense';
  return {
    ...raw,
    amount:      Number(raw.amount) || 0,
    type,
    category:    raw.category    || (type === 'income' ? 'Outros Rendimentos' : 'Outros'),
    description: raw.description || '',
    date:        raw.date        || new Date().toISOString().slice(0, 10),
  };
}


/**
 * Calcula uma chave determinista para uma transação importada de banco.
 * Usada como import_hash único para evitar re-importações duplicadas.
 * Input: date + amount (2 decimais) + descrição normalizada (60 chars).
 * Não usa crypto — é uma string legível e estável entre imports.
 */
export function computeImportHash(date, amount, description) {
  const desc = (description || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60);
  return `${date}|${parseFloat(amount).toFixed(2)}|${desc}`;
}

export const dbService = {
  async getTransactions(userId) {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    if (error) throw error
    return (data || []).map(mapTransaction)
  },

  async addTransaction(userId, transaction) {
    const { date, description, amount, type, category, account_id, account_name } = transaction;
    const row = { user_id: userId, date, description, amount, type, category };
    if (account_id   != null) row.account_id   = account_id;
    if (account_name != null) row.account_name = account_name;

    const { data, error } = await supabase.from('transactions').insert([row]).select();

    // Graceful fallback: if the account columns don't exist yet in the DB,
    // retry without them so the insert still succeeds.
    // Add `account_id text, account_name text` to the transactions table to enable linking.
    if (error) {
      const isColErr = error.code === 'PGRST204' || error.code === '42703' ||
        (error.message || '').includes('account_id') || (error.message || '').includes('account_name');
      if (!isColErr) throw error;
      console.warn('[supabase] account_id/account_name columns missing — add them to transactions table');
      const base = { user_id: userId, date, description, amount, type, category };
      const { data: d2, error: e2 } = await supabase.from('transactions').insert([base]).select();
      if (e2) throw e2;
      // Preserve account fields the caller passed in — the DB row lacks them but
      // the in-memory object must carry them so computeCurrentBalance works immediately.
      return {
        ...mapTransaction(d2[0]),
        ...(account_id   != null ? { account_id }   : {}),
        ...(account_name != null ? { account_name } : {}),
      };
    }
    return mapTransaction(data[0]);
  },

  async migrateUnlinkedTransactions(userId, accountId, accountName) {
    const { data, error } = await supabase
      .from('transactions')
      .update({ account_id: accountId, account_name: accountName })
      .eq('user_id', userId)
      .is('account_id', null)
      .neq('type', 'transfer')
      .select('id');
    if (error) {
      const isColErr = error.code === 'PGRST204' || error.code === '42703' ||
        (error.message || '').includes('account_id');
      if (!isColErr) throw error;
      console.warn('[supabase] account columns missing — migration skipped');
      return 0;
    }
    return (data || []).length;
  },

  async updateTransaction(transactionId, updates) {
    const { data, error } = await supabase
      .from('transactions')
      .update(updates)
      .eq('id', transactionId)
      .select();
    if (error) {
      // If optional columns (account_id, account_name, subcategory…) don't exist yet,
      // retry with only the core fields that are guaranteed to be in the schema.
      const isColErr = error.code === 'PGRST204' || error.code === '42703' ||
        (error.message || '').includes('account_id') ||
        (error.message || '').includes('account_name') ||
        (error.message || '').includes('subcategory');
      if (!isColErr) throw error;
      console.warn('[supabase] optional column missing — retrying with core fields only');
      // Strip all optional/possibly-missing columns; keep only guaranteed core schema fields
      const { account_id, account_name, subcategory, ...baseUpdates } = updates;
      if (Object.keys(baseUpdates).length === 0) {
        // Nothing core to update — fetch current row so caller gets a valid object back
        const { data: cur, error: ce } = await supabase
          .from('transactions').select('*').eq('id', transactionId).single();
        if (ce) throw ce;
        return mapTransaction(cur);
      }
      const { data: d2, error: e2 } = await supabase
        .from('transactions').update(baseUpdates).eq('id', transactionId).select();
      if (e2) throw e2;
      return mapTransaction(d2?.[0]);
    }
    return mapTransaction(data?.[0]);
  },

  async deleteTransaction(transactionId) {
    const { error } = await supabase
      .from('transactions')
      .delete()
      .eq('id', transactionId)
    if (error) throw error
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
    if (error) {
      const isColErr = error.code === 'PGRST204' || error.code === '42703' ||
        (error.message || '').includes('account_name') ||
        (error.message || '').includes('account_id');
      if (!isColErr) throw error;
      console.warn('[supabase] account_name column missing — DB rename skipped');
    }
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
      // PGRST116 = no rows returned (user hasn't created settings yet)
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
      // Se a coluna import_hash ainda não existe (antes da migração SQL),
      // cai no modo de fallback com inserts individuais sem proteção.
      const isColErr = err.code === 'PGRST204' || err.code === '42703' ||
        (err.message || '').includes('import_hash');
      if (!isColErr) throw err;

      // Fallback: insert one by one sem hash (comportamento anterior)
      const saved = [];
      for (const tx of transactions) {
        try {
          const row = await this.addTransaction(userId, tx);
          if (row) saved.push(row);
        } catch (e) { /* ignorar erros individuais no fallback */ }
      }
      return { saved, skipped: 0 };
    }
  },

  async updateUserSettings(userId, newSettings) {
    // Ler settings actuais para fazer merge (necessário porque Supabase não suporta
    // jsonb merge nativo no upsert — teríamos de usar uma RPC para isso).
    // O SELECT + UPSERT ainda tem uma janela de race condition teórica, mas usar
    // upsert em vez de SELECT + INSERT/UPDATE elimina o caso mais comum de conflito
    // (dois tabs a criar a linha em simultâneo).
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
  }
}
