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

export const dbService = {
  async getTransactions(userId) {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    if (error) throw error
    return data || []
  },

  async addTransaction(userId, transaction) {
    const { date, description, amount, type, category } = transaction;
    const { data, error } = await supabase
      .from('transactions')
      .insert([{ user_id: userId, date, description, amount, type, category }])
      .select()
    if (error) throw error
    return data[0]
  },

  async updateTransaction(transactionId, updates) {
    const { data, error } = await supabase
      .from('transactions')
      .update(updates)
      .eq('id', transactionId)
      .select()
    if (error) throw error
    return data[0]
  },

  async deleteTransaction(transactionId) {
    const { error } = await supabase
      .from('transactions')
      .delete()
      .eq('id', transactionId)
    if (error) throw error
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
