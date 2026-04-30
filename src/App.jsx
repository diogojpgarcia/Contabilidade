import React, { useState, useEffect } from 'react';
import CloudAuth from './components/CloudAuth';
import ResetPassword from './components/ResetPassword';
import BulkUpdateModal from './components/BulkUpdateModal';
import { authService, dbService } from './lib/supabase';
import { CATEGORIES_EXPENSE, CATEGORIES_INCOME } from './utils/categories-professional';
import { getMonthKey } from './utils/data';

// New Tab Components
import HomeTab from './components/tabs/HomeTab';
import StatsTab from './components/tabs/StatsTab';
import AddTab from './components/tabs/AddTab';
import BudgetTab from './components/tabs/BudgetTab';
import ImportTab from './components/tabs/ImportTab';
import ProfileTab from './components/tabs/ProfileTab';

import './styles/modern.css';

const categoriesProfessional = { expense: CATEGORIES_EXPENSE, income: CATEGORIES_INCOME };

const App = () => {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isRecoveryMode, setIsRecoveryMode] = useState(false);
  const [activeTab, setActiveTab] = useState('home');
  const [transactions, setTransactions] = useState([]);
  const [currentMonth, setCurrentMonth] = useState(getMonthKey(new Date().toISOString()));
  const [patrimony, setPatrimony] = useState({ accounts: [], stocks: [], bonds: [], realestate: [], vehicles: [], crypto: [] });
  const [homePatrimonyView, setHomePatrimonyView] = useState("total");
  const [learnedRules, setLearnedRules] = useState([]); // [{ pattern, category }]
  const [theme, setTheme] = useState('default'); // 'default' | 'modern'
  const [bulkPending, setBulkPending]   = useState(null); // { transactionId, newCategory, pattern, similar[] }
  const loadRequestId = React.useRef(0); // incremented to cancel stale loadUserTransactions fetches

  // Check for existing session on mount
  useEffect(() => {
    checkUserSession();
    checkRecoveryMode();
  }, []);

  useEffect(() => {
    console.log("APP THEME:", theme);
  }, [theme]);

  // Load transactions when user changes
  useEffect(() => {
    if (currentUser) {
      loadUserTransactions();
      loadUserSettings();
    }
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

  const loadUserTransactions = async () => {
    if (!currentUser) return;
    const requestId = ++loadRequestId.current;
    try {
      console.log('📥 Loading transactions for:', currentUser.id);
      const data = await dbService.getTransactions(currentUser.id);
      if (requestId !== loadRequestId.current) return; // superseded by delete or newer load
      console.log('✅ Loaded', data.length, 'transactions');
      setTransactions(data);
    } catch (error) {
      console.error('❌ Error loading transactions:', error);
    }
  };

  const loadUserSettings = async () => {
    try {
      const settings = await dbService.getUserSettings(currentUser.id);
      if (settings?.patrimony) setPatrimony(settings.patrimony);
      if (settings?.homePatrimonyView) setHomePatrimonyView(settings.homePatrimonyView);
      if (settings?.learned_rules) setLearnedRules(settings.learned_rules);
      // Load layout theme — guard against old colour values ('dark','light','gray')
      const t = settings?.theme;
      if (t === 'default' || t === 'modern') setTheme(t);
    } catch (error) { console.error("Error loading settings:", error); }
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
      console.log('➕ Adding transaction...');
      const newTransaction = await dbService.addTransaction(currentUser.id, transaction);
      setTransactions([newTransaction, ...transactions]);
      setActiveTab('home');
      console.log('✅ Transaction added!');
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

  const handleEditTransaction = async (updatedTransaction) => {
    try {
      console.log('✏️ Updating transaction:', updatedTransaction.id);
      const updated = await dbService.updateTransaction(updatedTransaction.id, {
        amount: updatedTransaction.amount,
        type: updatedTransaction.type,
        category: updatedTransaction.category,
        subcategory: updatedTransaction.subcategory || null,
        description: updatedTransaction.description || '',
        date: updatedTransaction.date
      });
      setTransactions(transactions.map(t => t.id === updated.id ? updated : t));
      console.log('✅ Transaction updated!');
    } catch (error) {
      console.error('❌ Error updating transaction:', error);
      alert('Erro ao editar transação: ' + error.message);
    }
  };

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

  // Logged in - show main app with bottom navigation
  const filteredTransactions = transactions.filter(t => getMonthKey(t.date) === currentMonth);
  const monthlyIncome = filteredTransactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + parseFloat(t.amount), 0);
  const monthlyExpenses = filteredTransactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + parseFloat(t.amount), 0);
  const balance = monthlyIncome - monthlyExpenses;

  const userName = currentUser.user_metadata?.full_name || currentUser.email.split('@')[0];

  return (
    <div className={`app-new ${theme}-ui`}>
      {/* Main Content */}
      <main className="main-content-new">
        {activeTab === 'home' && (
          <HomeTab
            balance={balance}
            income={monthlyIncome}
            expenses={monthlyExpenses}
            transactions={filteredTransactions}
            currentMonth={currentMonth}
            onMonthChange={setCurrentMonth}
            patrimony={patrimony}
            homePatrimonyView={homePatrimonyView}
            onPatrimonyViewChange={handlePatrimonyViewChange}
            onCategoryChange={handleCategoryChange}
            onTransactionDeleted={handleDeleteTransaction}
            onTransactionEdited={handleEditTransaction}
            theme={theme}
          />
        )}

        {activeTab === 'stats' && (
          <StatsTab
            transactions={transactions}
            filteredTransactions={filteredTransactions}
            currentMonth={currentMonth}
            onMonthChange={setCurrentMonth}
            categories={categoriesProfessional}
            onTransactionDeleted={handleDeleteTransaction}
            onCategoryChange={handleCategoryChange}
            theme={theme}
          />
        )}
        
        {activeTab === 'add' && (
          <AddTab
            user={currentUser}
            categories={categoriesProfessional}
            onTransactionAdded={handleAddTransaction}
          />
        )}
        
        {activeTab === 'budget' && (
          <BudgetTab
            user={currentUser}
            transactions={transactions}
            currentMonth={currentMonth}
            categories={categoriesProfessional}
            patrimony={patrimony}
            onPatrimonyChange={handlePatrimonyChange}
          />
        )}
        
        {activeTab === 'import' && (
          <ImportTab
            user={currentUser}
            onImportDone={loadUserTransactions}
            learnedRules={learnedRules}
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
            onDataDeleted={() => {
              // Kill any in-flight loadUserTransactions so a stale fetch
              // cannot overwrite this clear after it resolves.
              loadRequestId.current++;
              setTransactions([]);
              setPatrimony({ accounts: [], stocks: [], bonds: [], realestate: [], vehicles: [], crypto: [] });
              setActiveTab("home");         // navigate to Home so empty state is visible immediately
            }}
          />
        )}
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
          className={`nav-item nav-item-add ${activeTab === 'add' ? 'active' : ''}`}
          onClick={() => setActiveTab('add')}
        >
          <span className="nav-icon-large">+</span>
        </button>

        <button
          className={`nav-item ${activeTab === 'budget' ? 'active' : ''}`}
          onClick={() => setActiveTab('budget')}
        >
          <span className="nav-icon">&#9672;</span>
          <span className="nav-label">Budget</span>
        </button>

        <button
          className={`nav-item ${activeTab === 'import' ? 'active' : ''}`}
          onClick={() => setActiveTab('import')}
        >
          <span className="nav-icon">&#11014;</span>
          <span className="nav-label">Import</span>
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
