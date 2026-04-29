/**
 * dbService — single data-access layer for all Supabase operations.
 *
 * Rules:
 *  - All Supabase calls live in lib/supabase.js and are re-exported here.
 *  - Components import from here (or from lib/supabase directly — both work).
 *  - No component should import { supabase } and call it directly.
 *
 * Data flow:
 *   Supabase → dbService → App.jsx state → filteredTransactions → UI
 */

export { dbService, authService } from '../lib/supabase';
