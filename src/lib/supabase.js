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
function mapTransaction(raw) {
  return { ...raw, amount: Number(raw.amount) };
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
      // If account columns don't exist yet, retry without them so other
      // field updates (amount, category, date…) still succeed.
      const isColErr = error.code === 'PGRST204' || error.code === '42703' ||
        (error.message || '').includes('account_id') || (error.message || '').includes('account_name');
      if (!isColErr) throw error;
      console.warn('[supabase] account columns missing — updating without account fields');
      const { account_id, account_name, ...baseUpdates } = updates;
      if (Object.keys(baseUpdates).length === 0) {
        // Nothing else to update — fetch current row so caller gets a valid object back
        const { data: cur, error: ce } = await supabase
          .from('transactions').select('*').eq('id', transactionId).single();
        if (ce) throw ce;
        return mapTransaction(cur);
      }
      const { data: d2, error: e2 } = await supabase
        .from('transactions').update(baseUpdates).eq('id', transactionId).select();
      if (e2) throw e2;
      return mapTransaction(d2[0]);
    }
    return mapTransaction(data[0]);
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
      console.log('No settings found for user, returning empty');
      return {};
    }
    
    return data?.settings || {};
  },

  async updateUserSettings(userId, newSettings) {
    // Check if settings exist
    const { data: existing } = await supabase
      .from('user_settings')
      .select('id, settings')
      .eq('user_id', userId)
      .single()
    
    if (existing) {
      // Merge with existing settings
      const mergedSettings = { ...existing.settings, ...newSettings };
      
      const { data, error } = await supabase
        .from('user_settings')
        .update({ settings: mergedSettings })
        .eq('user_id', userId)
        .select()
        .single()
      
      if (error) throw error;
      return data;
    } else {
      // Create new settings row
      const { data, error } = await supabase
        .from('user_settings')
        .insert({ user_id: userId, settings: newSettings })
        .select()
        .single()
      
      if (error) throw error;
      return data;
    }
  }
}
