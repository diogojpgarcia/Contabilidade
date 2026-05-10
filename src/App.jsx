import React, { useState, useEffect, useRef, useMemo } from 'react';
import CloudAuth from './components/CloudAuth';
import ResetPassword from './components/ResetPassword';
import BulkUpdateModal from './components/BulkUpdateModal';
import ErrorBoundary from './components/ErrorBoundary';
import { authService, dbService } from './lib/supabase';
import { CATEGORIES_EXPENSE, CATEGORIES_INCOME } from './utils/categories-professional';
import { getMonthKey } from './utils/data';
import {
  getCurrentFinancialMonth,
  isInFinancialMonth,
  shiftFinancialMonth,
} from './utils/financialMonth';

// New Tab Components
import HomeTab from './components/tabs/HomeTab';
import StatsTab from './components/tabs/StatsTab';
import AddTab from './components/tabs/AddTab';
import BudgetTab from './components/tabs/BudgetTab';
import ImportTab from './components/tabs/ImportTab';
import ProfileTab from './components/tabs/ProfileTab';

import './styles/layout.css';
import './styles/modern.css';
import './styles/fintech.css';

const App = () => {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isRecoveryMode, setIsRecoveryMode] = useState(false);
  const [activeTab, setActiveTab] = useState('home');

  // Scroll-reset: always open each tab at the top
  const mainContentRef = useRef(null);
  useEffect(() => {
    if (mainContentRef.current) mainContentRef.current.scrollTop = 0;
  }, [activeTab]);
  const [transactions, setTransactions] = useState([]);
  const [currentMonth, setCurrentMonth] = useState(getMonthKey(new Date().toISOString()));
  const [patrimony, setPatrimony] = useState({ accounts: [], stocks: [], bonds: [], realestate: [], vehicles: [], crypto: [] });
  const [homePatrimonyView, setHomePatrimonyView] = useState("total");
  const [learnedRules, setLearnedRules] = useState([]); // [{ pattern, category }]
  const [budgets, setBudgets] = useState({});
  const [theme, setTheme] = useState('default'); // 'default' | 'modern'
  const [categories, setCategories] = useState({ expense: CATEGORIES_EXPENSE, income: CATEGORIES_INCOME });
  const [mainAccountId, setMainAccountId] = useState(null); // string | null — the "Principal" account
  const [financialMonthStartDay, setFinancialMonthStartDay] = useState(1); // 1 = calendar month
  const [useFinancialMonth, setUseFinancialMonth] = useState(false);
  const [transactionAccountMap, setTransactionAccountMap] = useState({}); // { [txId]: { account_id, account_name } } — fallback when DB columns absent
  const [bulkPending, setBulkPending]   = useState(null); // { transactionId, newCategory, pattern, similar[] }
  const loadRequestId = React.useRef(0); // incremented to cancel stale fetches

  // Check for existing session on mount
  useEffect(() => {
    checkUserSession();
    checkRecoveryMode();
  }, []);

  // Load transactions + settings atomically when user changes
  useEffect(() => {
    if (currentUser) loadUserData();
  }, [currentUser]);

  const checkUserSession = async () => {
    try {
      const user = await authService.getCurrentUser();
      if (user) {
        console.log('✅ User session found:', user.email);
        setCurrentUser(user);
      }
    } catch (error) {
      console.log('No active session');
    } finally {
      setLoading(false);
    }
  };

  const checkRecoveryMode = () => {
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const type = hashParams.get('type');
    
    if (type === 'recovery') {
      console.log('🔐 Recovery mode detected!');
      setIsRecoveryMode(true);
      setLoading(false);
    }
  };

  const handleResetComplete = () => {
    console.log('✅ Reset complete, reloading...');
    setIsRecoveryMode(false);
    window.location.hash = '';
    window.location.reload();
  };

  // Single load function — fetches transactions + settings in parallel, then
  // merges the transactionAccountMap fallback into transactions atomically.
  // This eliminates the race condition between the two former separate loads.
  const loadUserData = async () => {
    if (!currentUser) return;
    const requestId = ++loadRequestId.current;
    try {
      const [txData, settings] = await Promise.all([
        dbService.getTransactions(currentUser.id).catch(() => []),
        dbService.getUserSettings(currentUser.id).catch(() => ({})),
      ]);
      if (requestId !== loadRequestId.current) return; // superseded

      // Merge transactionAccountMap fallback — applies account data saved when
      // the account_id column doesn't exist in Supabase yet.
      const accountMap = settings?.transactionAccountMap || {};
      const rows = (txData || []).map(t => ({
        ...t,
        type: t.type || 'expense',
        account_id:   t.account_id   || accountMap[t.id]?.account_id   || null,
        account_name: t.account_name || accountMap[t.id]?.account_name || null,
      }));
      setTransactions(rows);
      setTransactionAccountMap(accountMap);

      // Apply settings
      if (settings?.patrimony)        setPatrimony(settings.patrimony);
      if (settings?.homePatrimonyView) setHomePatrimonyView(settings.homePatrimonyView);
      if (settings?.learned_rules)    setLearnedRules(settings.learned_rules);
      if (settings?.category_budgets) setBudgets(settings.category_budgets);
      if (settings?.custom_categories) {
        const saved = settings.custom_categories;
        setCategories({
          expense: Array.isArray(saved.expense) ? saved.expense : CATEGORIES_EXPENSE,
          income:  Array.isArray(saved.income)  ? saved.income  : CATEGORIES_INCOME,
        });
      }
      const t = settings?.theme;
      if (t === 'default' || t === 'modern' || t === 'fintech') setTheme(t);
      const mid = settings?.mainAccountId ?? settings?.defaultTransactionAccount?.id ?? null;
      if (mid) setMainAccountId(mid);

      // Financial month settings — restore and snap currentMonth to the correct period
      const sd  = settings?.financialMonthStartDay ?? 1;
      const ufm = settings?.useFinancialMonth      ?? false;
      setFinancialMonthStartDay(sd);
      setUseFinancialMonth(ufm);
      setCurrentMonth(getCurrentFinancialMonth(ufm ? sd : 1));
    } catch (error) {
      console.error('❌ Error loading user data:', error);
    }
  };

  // Keep a stable reference for callsites that only need to reload transactions
  // (e.g. after delete/import) without re-applying all settings.
  const loadUserTransactions = async () => {
    if (!currentUser) return;
    const requestId = ++loadRequestId.current;
    try {
      const [txData, settings] = await Promise.all([
        dbService.getTransactions(currentUser.id).catch(() => []),
        Promise.resolve(null), // settings already in state — no need to re-fetch
      ]);
      if (requestId !== loadRequestId.current) return;
      const accountMap = transactionAccountMap; // use in-memory map
      const rows = (txData || []).map(t => ({
        ...t,
        type: t.type || 'expense',
        account_id:   t.account_id   || accountMap[t.id]?.account_id   || null,
        account_name: t.account_name || accountMap[t.id]?.account_name || null,
      }));
      setTransactions(rows);
    } catch (error) {
      console.error('❌ Error loading transactions:', error);
    }
  };

  // Generic words that should never become a matching pattern.
  const NOISE_WORDS = new Set([
    'payment','compra','ref','mbway','transfer','debito','credito',
    'debit','credit','via','para','from','por','com','the','and',
    'pagamento','direta','direto','sepa','trf','pos','atm',
  ]);

  // Extract the first meaningful word from a description.
  // Removes numbers, symbols, noise words, and short tokens (<3 chars).
  const extractPattern = (description) => {
    if (!description) return null;
    const words = description
      .toLowerCase()
      .replace(/[^a-z\s]/g, ' ')   // strip numbers and symbols
      .split(/\s+/)
      .filter(w => w.length >= 3 && !NOISE_WORDS.has(w));
    return words[0] || null;        // first meaningful word
  };

  // Persist a learned rule (upsert by pattern).
  const saveLearnedRule = (pattern, category) => {
    const updated = [
      { pattern, category },
      ...learnedRules.filter(r => r.pattern !== pattern),
    ];
    setLearnedRules(updated);
    dbService.updateUserSettings(currentUser.id, { learned_rules: updated }).catch(console.error);
  };

  // Called when user picks a category in HomeTab or StatsTab.
  // Updates the single transaction immediately, then shows the bulk-update
  // modal if other transactions share the same description pattern.
  const handleCategoryChange = async (transactionId, newCategory, description) => {
    const original = transactions.find(t => t.id === transactionId);

    // 1. Optimistic update for this transaction
    setTransactions(prev => prev.map(t =>
      t.id === transactionId ? { ...t, category: newCategory } : t
    ));

    try {
      // 2. DB write for this transaction
      await dbService.updateTransaction(transactionId, { category: newCategory });

      // 3. Look for similar uncorrected transactions
      const pattern = extractPattern(description);
      if (pattern) {
        const similar = transactions.filter(t =>
          t.id !== transactionId &&
          t.category !== newCategory &&
          (t.description || '').toLowerCase().includes(pattern)
        );

        if (similar.length > 0) {
          // Let user decide whether to update all
          setBulkPending({ transactionId, newCategory, description, pattern, similar });
        } else {
          // Nothing similar — save rule immediately
          saveLearnedRule(pattern, newCategory);
        }
      }
    } catch (err) {
      console.error('Error updating category:', err);
      if (original) setTransactions(prev => prev.map(t => t.id === transactionId ? original : t));
    }
  };

  // User confirmed "update all similar".
  const handleBulkConfirm = async () => {
    if (!bulkPending) return;
    const { newCategory, pattern, similar } = bulkPending;

    // 1. Optimistic bulk state update (skip the already-updated tx)
    setTransactions(prev => prev.map(t =>
      similar.some(s => s.id === t.id) ? { ...t, category: newCategory } : t
    ));

    // 2. Persist each in the background (fire-and-forget — no reload)
    for (const tx of similar) {
      dbService.updateTransaction(tx.id, { category: newCategory }).catch(console.error);
    }

    // 3. Save learned rule
    saveLearnedRule(pattern, newCategory);

    setBulkPending(null);
  };

  // User chose "only this one".
  const handleBulkDismiss = () => {
    if (bulkPending) saveLearnedRule(bulkPending.pattern, bulkPending.newCategory);
    setBulkPending(null);
  };

  const handlePatrimonyChange = async (newPatrimony) => {
    setPatrimony(newPatrimony);
    try { await dbService.updateUserSettings(currentUser.id, { patrimony: newPatrimony }); }
    catch (error) { console.error("Error saving patrimony:", error); }
  };

  const handleFinancialMonthChange = ({ startDay, enabled }) => {
    const sd  = Math.min(28, Math.max(1, startDay));
    setFinancialMonthStartDay(sd);
    setUseFinancialMonth(enabled);
    // Snap the current view to today's financial period under the new settings
    setCurrentMonth(getCurrentFinancialMonth(enabled ? sd : 1));
    dbService.updateUserSettings(currentUser.id, {
      financialMonthStartDay: sd,
      useFinancialMonth: enabled,
    }).catch(console.error);
  };

  // Sets mainAccountId as the "Principal" account.
  // Also offers to migrate unlinked transactions to this account.
  const handleMainAccountChange = async (accountId) => {
    setMainAccountId(accountId);
    dbService.updateUserSettings(currentUser.id, { mainAccountId: accountId }).catch(console.error);

    if (!accountId) return;

    const acc = (patrimony.accounts || []).find(a => a.id === accountId);
    if (!acc) return;

    const unlinked = transactions.filter(t => !t.account_id && t.type !== 'transfer');
    if (unlinked.length === 0) return;

    const confirmed = window.confirm(
      `${unlinked.length} transação(ões) sem conta associada.\n\nAplicar "${acc.name}" a estas transações antigas?`
    );
    if (!confirmed) return;

    try {
      // DB update (no-op if account columns don't exist — graceful)
      await dbService.migrateUnlinkedTransactions(currentUser.id, acc.id, acc.name);

      // Update in-memory state
      setTransactions(prev => prev.map(t =>
        (!t.account_id && t.type !== 'transfer')
          ? { ...t, account_id: acc.id, account_name: acc.name }
          : t
      ));

      // Persist every migrated transaction to fallback map — this is the guaranteed
      // storage that survives reload even when DB columns don't exist
      const updatedMap = { ...transactionAccountMap };
      unlinked.forEach(t => {
        updatedMap[t.id] = { account_id: acc.id, account_name: acc.name };
      });
      setTransactionAccountMap(updatedMap);
      dbService.updateUserSettings(currentUser.id, { transactionAccountMap: updatedMap }).catch(console.error);
    } catch (err) {
      console.error('❌ Migration failed:', err);
      alert('Erro na migração: ' + err.message);
    }
  };

  // Pure function: initialBalance (= account.balance) + all linked transaction effects.
  // Transfers: out = subtract, in = add (detected by description prefix).
  // Never mutates patrimony — call this in useMemo or render.
  const computeCurrentBalance = (account, allTransactions) => {
    const initial = parseFloat(account.balance ?? 0);
    if (isNaN(initial)) return 0;
    return (allTransactions || []).reduce((sum, tx) => {
      if (tx.account_id !== account.id) return sum;
      const amt = parseFloat(tx.amount) || 0;
      if (tx.type === 'income')  return sum + amt;
      if (tx.type === 'expense') return sum - amt;
      if (tx.type === 'transfer') {
        const isOut = /^Transferência para/i.test(tx.description || '');
        return isOut ? sum - amt : sum + amt;
      }
      return sum;
    }, initial);
  };

  const handleCategoriesChange = (updated) => {
    // CategoryManager already persists to Supabase — we just keep global state in sync.
    setCategories(updated);
  };

  const handleBudgetsChange = async (newBudgets) => {
    setBudgets(newBudgets);
    try { await dbService.updateUserSettings(currentUser.id, { category_budgets: newBudgets }); }
    catch (error) { console.error('Error saving budgets:', error); alert('Erro ao guardar orçamento'); }
  };

  const handlePatrimonyViewChange = async (view) => {
    setHomePatrimonyView(view);
    try { await dbService.updateUserSettings(currentUser.id, { homePatrimonyView: view }); }
    catch (error) { console.error("Error saving patrimony view:", error); }
  };

  const handleAuthSuccess = (user) => {
    console.log('🎉 Auth success!', user.email);
    setCurrentUser(user);
  };

  const handleLogout = async () => {
    try {
      await authService.signOut();
      setCurrentUser(null);
      setTransactions([]);
      console.log('👋 Logged out');
    } catch (error) {
      console.error('❌ Logout error:', error);
    }
  };

  const handleAddTransaction = async (transaction) => {
    try {
      const accId   = transaction.account_id || mainAccountId || null;
      const accName = transaction.account_name || (accId ? (patrimony.accounts || []).find(a => a.id === accId)?.name || null : null);
      const newTx = await dbService.addTransaction(currentUser.id, {
        ...transaction,
        account_id:   accId,
        account_name: accName,
      });
      // Ensure account fields are present (fallback DB path preserves them in the
      // returned object now, but guard here too for safety)
      const txWithAccount = {
        ...newTx,
        account_id:   newTx.account_id   || accId   || null,
        account_name: newTx.account_name || accName || null,
      };
      setTransactions(prev => [txWithAccount, ...prev]);

      // Persist account link to fallback map — guaranteed even when DB columns absent
      if (accId && txWithAccount.id) {
        const updatedMap = {
          ...transactionAccountMap,
          [txWithAccount.id]: { account_id: accId, account_name: accName || null },
        };
        setTransactionAccountMap(updatedMap);
        dbService.updateUserSettings(currentUser.id, { transactionAccountMap: updatedMap }).catch(console.error);
      }

      setActiveTab('home');
    } catch (error) {
      console.error('❌ Error adding transaction:', error);
      alert('Erro ao adicionar transação: ' + error.message);
    }
  };

  const handleDeleteTransaction = async (id) => {
    try {
      console.log('🗑️ Deleting transaction:', id);
      await dbService.deleteTransaction(id);
      setTransactions(transactions.filter(t => t.id !== id));
      console.log('✅ Transaction deleted!');
    } catch (error) {
      console.error('❌ Error deleting transaction:', error);
      alert('Erro ao apagar transação: ' + error.message);
    }
  };

  // Creates a matched pair of transfer transactions (out + in), prepends both,
  // and updates patrimony account balances so the patrimony view stays in sync.
  const handleTransfer = async (fromId, toId, amount) => {
    const value = parseFloat(amount);
    if (!value || value <= 0) return;
    const today = new Date().toISOString().split('T')[0];
    // Resolve IDs → names for human-readable descriptions
    const accs     = patrimony.accounts || [];
    const fromAcc  = accs.find(a => a.id === fromId);
    const toAcc    = accs.find(a => a.id === toId);
    const fromName = fromAcc?.name || fromId;
    const toName   = toAcc?.name   || toId;
    try {
      const rawOut = await dbService.addTransaction(currentUser.id, {
        description: `Transferência para ${toName}`,
        amount: value, type: 'transfer', category: fromName, date: today,
        account_id: fromId, account_name: fromName,
      });
      const rawIn = await dbService.addTransaction(currentUser.id, {
        description: `Transferência de ${fromName}`,
        amount: value, type: 'transfer', category: toName, date: today,
        account_id: toId, account_name: toName,
      });

      // Guarantee account fields on in-memory objects (addTransaction fallback already
      // preserves them, but apply defensively so computeCurrentBalance is never wrong)
      const outTx = { ...rawOut, account_id: rawOut.account_id || fromId, account_name: rawOut.account_name || fromName };
      const inTx  = { ...rawIn,  account_id: rawIn.account_id  || toId,   account_name: rawIn.account_name  || toName  };

      const both = [outTx, inTx].filter(t => t?.id);
      if (both.length) setTransactions(prev => [...both, ...prev]);

      // Persist both transfer legs to fallback map — survives reload regardless of DB columns
      const updatedMap = { ...transactionAccountMap };
      if (outTx.id) updatedMap[outTx.id] = { account_id: fromId, account_name: fromName };
      if (inTx.id)  updatedMap[inTx.id]  = { account_id: toId,   account_name: toName  };
      setTransactionAccountMap(updatedMap);
      dbService.updateUserSettings(currentUser.id, { transactionAccountMap: updatedMap }).catch(console.error);

      setActiveTab('home');
    } catch (err) {
      console.error('❌ Transfer error:', err);
      alert('Erro ao criar transferência: ' + err.message);
    }
  };

  // Called by ImportTab after saving to DB — prepends the new rows immediately
  // so Home and Stats update without waiting for a full reload.
  const handleImport = (savedTransactions) => {
    if (savedTransactions?.length) {
      setTransactions(prev => [...savedTransactions, ...prev]);
    } else {
      loadUserTransactions(); // fallback if caller passes nothing
    }
  };

  const handleEditTransaction = async (updatedTransaction) => {
    const original = transactions.find(t => t.id === updatedTransaction.id);
    try {
      console.log('✏️ Updating transaction:', updatedTransaction.id);
      const updated = await dbService.updateTransaction(updatedTransaction.id, {
        amount:       updatedTransaction.amount,
        type:         updatedTransaction.type,
        category:     updatedTransaction.category,
        subcategory:  updatedTransaction.subcategory || null,
        description:  updatedTransaction.description || '',
        date:         updatedTransaction.date,
        account_id:   updatedTransaction.account_id   || null,
        account_name: updatedTransaction.account_name || null,
      });
      // Merge DB result with intended account fields: if account columns don't exist
      // in the DB yet, updateTransaction returns the row without them. We keep the
      // caller's intent so the optimistic account data is never overwritten by stale DB data.
      const merged = {
        ...updated,
        account_id:   updatedTransaction.account_id   ?? updated.account_id   ?? null,
        account_name: updatedTransaction.account_name ?? updated.account_name ?? null,
      };
      setTransactions(prev => prev.map(t => t.id === merged.id ? merged : t));

      // Keep transactionAccountMap in sync with any account field changes
      if (merged.account_id !== (original?.account_id ?? null)) {
        const updatedMap = { ...transactionAccountMap };
        if (merged.account_id) {
          updatedMap[merged.id] = { account_id: merged.account_id, account_name: merged.account_name || null };
        } else {
          delete updatedMap[merged.id];
        }
        setTransactionAccountMap(updatedMap);
        dbService.updateUserSettings(currentUser.id, { transactionAccountMap: updatedMap }).catch(console.error);
      }
      console.log('✅ Transaction updated!');
    } catch (error) {
      console.error('❌ Error updating transaction:', error);
      alert('Erro ao editar transação: ' + error.message);
    }
  };

  // Called from Home and History when user links a transaction to a different account.
  // Always persists via two mechanisms in parallel:
  //   1. updateTransaction (DB columns when available; graceful no-op otherwise)
  //   2. transactionAccountMap in user_settings (guaranteed fallback)
  const handleAccountChange = async (transactionId, newAccountId, newAccountName) => {
    const original = transactions.find(t => t.id === transactionId);
    if (!original) return;

    // 1. Optimistic UI update
    setTransactions(prev => prev.map(t =>
      t.id === transactionId
        ? { ...t, account_id: newAccountId || null, account_name: newAccountName || null }
        : t
    ));

    // 2. Update in-memory map + persist to settings (guaranteed storage)
    const updatedMap = { ...transactionAccountMap };
    if (newAccountId) {
      updatedMap[transactionId] = { account_id: newAccountId, account_name: newAccountName || null };
    } else {
      delete updatedMap[transactionId];
    }
    setTransactionAccountMap(updatedMap);
    dbService.updateUserSettings(currentUser.id, { transactionAccountMap: updatedMap }).catch(console.error);

    // 3. Also attempt DB column update (no-op if columns don't exist)
    try {
      await dbService.updateTransaction(transactionId, {
        account_id:   newAccountId   || null,
        account_name: newAccountName || null,
      });
    } catch (err) {
      console.error('❌ Error persisting account change to DB:', err);
      // Don't rollback UI — the settings map already persisted the change
    }
  };

  // ── Hooks that must run unconditionally (before any early return) ──────────
  // Rules of Hooks: useMemo/useCallback/useState must never appear after a
  // conditional return — doing so causes React error #310.
  const safeTransactions = Array.isArray(transactions) ? transactions : [];

  // Derive defaultAccount from mainAccountId — no separate state needed
  const defaultAccount = useMemo(
    () => (patrimony.accounts || []).find(a => a.id === mainAccountId) || null,
    [patrimony.accounts, mainAccountId]
  );

  // Patrimony with live computed balances for accounts (never stored — always fresh)
  const patrimonyWithLiveBalances = useMemo(() => ({
    ...patrimony,
    accounts: (patrimony.accounts || []).map(acc => ({
      ...acc,
      currentBalance: computeCurrentBalance(acc, safeTransactions),
    })),
  }), [patrimony, safeTransactions]); // eslint-disable-line react-hooks/exhaustive-deps

  // All-time balance: income adds, expenses subtract, transfers are ignored
  const totalBalance = useMemo(() =>
    safeTransactions.reduce((acc, t) => {
      if (!t || !t.type) return acc;
      const amt = parseFloat(t.amount || 0);
      if (t.type === 'income')  return acc + amt;
      if (t.type === 'expense') return acc - amt;
      return acc;
    }, 0),
    [safeTransactions]
  );

  // ── Conditional early returns (AFTER all hooks) ────────────────────────────

  // Loading state
  if (loading) {
    return (
      <div className="app-new loading-screen">
        <div className="loading-content">
          <h1>💰 Finanças Familiares</h1>
          <div className="loading-spinner"></div>
        </div>
      </div>
    );
  }

  // Password recovery mode
  if (isRecoveryMode) {
    return (
      <div className="app-new">
        <ResetPassword onComplete={handleResetComplete} />
      </div>
    );
  }

  // Not logged in - show auth
  if (!currentUser) {
    return (
      <div className="app-new">
        <CloudAuth onSuccess={handleAuthSuccess} />
      </div>
    );
  }

  // Logged in — derive monthly figures (plain expressions, not hooks)
  const effectiveStartDay = useFinancialMonth ? financialMonthStartDay : 1;
  const filteredTransactions = safeTransactions.filter(
    t => t.date && isInFinancialMonth(t.date, currentMonth, effectiveStartDay)
  );
  const monthlyIncome = filteredTransactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);
  const monthlyExpenses = filteredTransactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);
  const balance = monthlyIncome - monthlyExpenses;

  const userName = currentUser.user_metadata?.full_name || currentUser.email.split('@')[0];

  return (
    <div className={`app-new ${theme}-ui${theme === 'fintech' ? ' modern-ui' : ''}`}>
      {/* Main Content */}
      <main className="main-content-new" ref={mainContentRef}>
      <ErrorBoundary>
        {activeTab === 'home' && (
          <HomeTab
            balance={balance}
            income={monthlyIncome}
            expenses={monthlyExpenses}
            totalBalance={totalBalance}
            transactions={filteredTransactions}
            currentMonth={currentMonth}
            onMonthChange={setCurrentMonth}
            patrimony={patrimonyWithLiveBalances}
            homePatrimonyView={homePatrimonyView}
            onPatrimonyViewChange={handlePatrimonyViewChange}
            onCategoryChange={handleCategoryChange}
            onAccountChange={handleAccountChange}
            onTransactionDeleted={handleDeleteTransaction}
            onTransactionEdited={handleEditTransaction}
            categories={categories}
            theme={theme}
            financialMonthStartDay={effectiveStartDay}
          />
        )}

        {activeTab === 'stats' && (
          <StatsTab
            transactions={safeTransactions}
            filteredTransactions={filteredTransactions}
            currentMonth={currentMonth}
            onMonthChange={setCurrentMonth}
            categories={categories}
            budgets={budgets}
            onTransactionDeleted={handleDeleteTransaction}
            onCategoryChange={handleCategoryChange}
            onAccountChange={handleAccountChange}
            patrimony={patrimonyWithLiveBalances}
            theme={theme}
            financialMonthStartDay={effectiveStartDay}
          />
        )}
        
        {activeTab === 'add' && (
          <AddTab
            user={currentUser}
            categories={categories}
            onTransactionAdded={handleAddTransaction}
            onTransfer={handleTransfer}
            patrimony={patrimonyWithLiveBalances}
            defaultAccount={defaultAccount}
            theme={theme}
          />
        )}

        {activeTab === 'budget' && (
          <BudgetTab
            user={currentUser}
            transactions={safeTransactions}
            currentMonth={currentMonth}
            categories={categories}
            budgets={budgets}
            onBudgetsChange={handleBudgetsChange}
            patrimony={patrimony}
            onPatrimonyChange={handlePatrimonyChange}
            mainAccountId={mainAccountId}
            onMainAccountChange={handleMainAccountChange}
            theme={theme}
            financialMonthStartDay={effectiveStartDay}
          />
        )}

        {activeTab === 'import' && (
          <ImportTab
            user={currentUser}
            onImportDone={handleImport}
            learnedRules={learnedRules}
            theme={theme}
          />
        )}

        {activeTab === 'profile' && (
          <ProfileTab
            user={currentUser}
            onNavigateToImport={() => setActiveTab('import')}
            userName={userName}
            onLogout={handleLogout}
            theme={theme}
            setTheme={setTheme}
            categories={categories}
            onCategoriesChange={handleCategoriesChange}
            patrimony={patrimonyWithLiveBalances}
            defaultAccount={defaultAccount}
            onDefaultAccountChange={(acc) => handleMainAccountChange(acc?.id || null)}
            useFinancialMonth={useFinancialMonth}
            financialMonthStartDay={financialMonthStartDay}
            onFinancialMonthChange={handleFinancialMonthChange}
            onDataDeleted={() => {
              loadRequestId.current++;
              setTransactions([]);
              setTransactionAccountMap({});
              setPatrimony({ accounts: [], stocks: [], bonds: [], realestate: [], vehicles: [], crypto: [] });
              setActiveTab("home");
            }}
          />
        )}
      </ErrorBoundary>
      </main>
      {/* Bottom Navigation */}
      <nav className="bottom-nav">
        <button
          className={`nav-item ${activeTab === 'home' ? 'active' : ''}`}
          onClick={() => setActiveTab('home')}
        >
          <span className="nav-icon">&#8962;</span>
          <span className="nav-label">Home</span>
        </button>

        <button
          className={`nav-item ${activeTab === 'stats' ? 'active' : ''}`}
          onClick={() => setActiveTab('stats')}
        >
          <span className="nav-icon">&#9671;</span>
          <span className="nav-label">Stats</span>
        </button>

        <button
          className={`nav-item ${activeTab === 'add' ? 'active' : ''}`}
          onClick={() => setActiveTab('add')}
        >
          <span className="nav-icon nav-icon-add">+</span>
          <span className="nav-label">Adicionar</span>
        </button>

        <button
          className={`nav-item ${activeTab === 'budget' ? 'active' : ''}`}
          onClick={() => setActiveTab('budget')}
        >
          <span className="nav-icon">&#9672;</span>
          <span className="nav-label">Budget</span>
        </button>

        <button
          className={`nav-item ${activeTab === 'profile' ? 'active' : ''}`}
          onClick={() => setActiveTab('profile')}
        >
          <span className="nav-icon">&#9689;</span>
          <span className="nav-label">Perfil</span>
        </button>
      </nav>

      {/* Bulk category update — rendered at App level so it overlays everything */}
      {bulkPending && (
        <BulkUpdateModal
          bulkPending={bulkPending}
          onConfirm={handleBulkConfirm}
          onDismiss={handleBulkDismiss}
        />
      )}
    </div>
  );
};

export default App;
