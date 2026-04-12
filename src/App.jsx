import React, { useState, useEffect } from 'react';
import CloudAuth from './components/CloudAuth';
import ResetPassword from './components/ResetPassword';
import ProfessionalDashboard from './components/ProfessionalDashboard';
import AdvancedAnalytics from './components/AdvancedAnalytics';
import TransactionFilters from './components/TransactionFilters';
import CategoryManager from './components/CategoryManager';
import BackupSettings from './components/BackupSettings';
import EnhancedTransactionForm from './components/EnhancedTransactionForm';
import TransactionList from './components/TransactionList';
import ErrorBoundary from './components/ErrorBoundary';
import CloudSyncButton from './components/CloudSyncButton';
import { authService, dbService } from './lib/supabase';
import { CATEGORIES_EXPENSE, CATEGORIES_INCOME } from './utils/categories-professional';
import { getMonthKey } from './utils/data';
import { exportToExcel } from './utils/exportUtils';
import './App.css';

const categoriesProfessional = { expense: CATEGORIES_EXPENSE, income: CATEGORIES_INCOME };

const App = () => {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isRecoveryMode, setIsRecoveryMode] = useState(false);
  const [showBackupSettings, setShowBackupSettings] = useState(false);
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [transactions, setTransactions] = useState([]);
  const [currentMonth, setCurrentMonth] = useState(getMonthKey(new Date().toISOString()));
  const [showTransactionForm, setShowTransactionForm] = useState(false);
  const [filters, setFilters] = useState({
    search: '',
    category: 'all',
    minAmount: null,
    maxAmount: null,
    startDate: null,
    endDate: null
  });

  // Check for existing session on mount
  useEffect(() => {
    checkUserSession();
    checkRecoveryMode();
  }, []);

  // Load transactions when user changes
  useEffect(() => {
    if (currentUser) {
      loadUserTransactions();
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
    // Check if URL has recovery token (from password reset email)
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
    window.location.hash = ''; // Clear hash
    window.location.reload(); // Reload to fresh state
  };

  const loadUserTransactions = async () => {
    if (!currentUser) return;
    
    try {
      console.log('📥 Loading transactions for:', currentUser.id);
      const data = await dbService.getTransactions(currentUser.id);
      console.log('✅ Loaded', data.length, 'transactions');
      setTransactions(data);
    } catch (error) {
      console.error('❌ Error loading transactions:', error);
    }
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
      setShowTransactionForm(false);
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

  const handleBackToCurrentMonth = () => {
    setCurrentMonth(getMonthKey(new Date().toISOString()));
  };

  // Loading state
  if (loading) {
    return (
      <div className="app loading-screen">
        <div className="loading-content">
          <h1>💰 Finanças Familiares</h1>
          <p>A carregar...</p>
        </div>
      </div>
    );
  }

  // Password recovery mode
  if (isRecoveryMode) {
    return (
      <div className="app">
        <ResetPassword onComplete={handleResetComplete} />
      </div>
    );
  }

  // Not logged in - show auth
  if (!currentUser) {
    return (
      <div className="app">
        <CloudAuth onSuccess={handleAuthSuccess} />
      </div>
    );
  }

  // Logged in - show dashboard
  // Apply filters
  let filteredTransactions = transactions.filter(t => getMonthKey(t.date) === currentMonth);
  
  // Apply search filter
  if (filters.search) {
    filteredTransactions = filteredTransactions.filter(t => 
      (t.description || '').toLowerCase().includes(filters.search.toLowerCase())
    );
  }
  
  // Apply category filter
  if (filters.category && filters.category !== 'all') {
    filteredTransactions = filteredTransactions.filter(t => t.category === filters.category);
  }
  
  // Apply amount filters
  if (filters.minAmount !== null) {
    filteredTransactions = filteredTransactions.filter(t => parseFloat(t.amount) >= filters.minAmount);
  }
  if (filters.maxAmount !== null) {
    filteredTransactions = filteredTransactions.filter(t => parseFloat(t.amount) <= filters.maxAmount);
  }
  
  // Apply date filters
  if (filters.startDate) {
    filteredTransactions = filteredTransactions.filter(t => t.date >= filters.startDate);
  }
  if (filters.endDate) {
    filteredTransactions = filteredTransactions.filter(t => t.date <= filters.endDate);
  }
  
  const monthlyIncome = filteredTransactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + parseFloat(t.amount), 0);
  const monthlyExpenses = filteredTransactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + parseFloat(t.amount), 0);
  const balance = monthlyIncome - monthlyExpenses;

  const safeCategories = categoriesProfessional || { expense: [], income: [] };

  console.log('📊 App state:', {
    currentUser: currentUser?.email,
    transactions: transactions?.length,
    filteredTransactions: filteredTransactions?.length,
    categories: !!categoriesProfessional,
    safeCategories: !!safeCategories
  });

  // Get user initials and color
  const userName = currentUser.user_metadata?.full_name || currentUser.email.split('@')[0];
  const userInitials = userName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const userColor = '#3b82f6'; // Default blue

  // Handle filter changes
  const handleFilterChange = (newFilters) => {
    setFilters(newFilters);
  };

  // Handle export
  const handleExport = () => {
    exportToExcel(filteredTransactions, `transacoes_${currentMonth}`);
  };

  return (
    <div className="app" style={{ '--user-color': userColor }}>
      <header className="app-header">
        <div className="header-left">
          <div className="user-avatar" style={{ '--user-color': userColor }}>
            {userInitials}
          </div>
          <div>
            <h2>{userName}</h2>
            <p className="month-display">{currentMonth}</p>
          </div>
        </div>
        <div className="header-actions">
          <button 
            onClick={() => setShowCategoryManager(true)} 
            className="btn-icon" 
            title="Gerir Categorias"
          >
            🏷️
          </button>
          <button onClick={handleLogout} className="btn-icon" title="Terminar sessão">
            🚪
          </button>
        </div>
      </header>

      {showCategoryManager && (
        <CategoryManager
          userId={currentUser.id}
          onClose={() => setShowCategoryManager(false)}
          onUpdate={(newCategories) => {
            console.log('Categories updated:', newCategories);
          }}
        />
      )}

      {showBackupSettings && (
        <BackupSettings
          userId={currentUser.id}
          onClose={() => setShowBackupSettings(false)}
        />
      )}

      <main className="main-content">
        <ProfessionalDashboard
          income={monthlyIncome}
          expenses={monthlyExpenses}
          balance={balance}
          transactions={filteredTransactions}
          categories={safeCategories}
        />

        <AdvancedAnalytics
          currentMonthTransactions={filteredTransactions}
          allTransactions={transactions}
          currentMonthKey={currentMonth}
          currentIncome={monthlyIncome}
          currentExpenses={monthlyExpenses}
          currentBalance={balance}
        />

        <TransactionFilters
          onFilterChange={handleFilterChange}
          categories={safeCategories}
          onExport={handleExport}
        />

        <ErrorBoundary>
          <TransactionList
            transactions={filteredTransactions}
            onDelete={handleDeleteTransaction}
            onEdit={handleEditTransaction}
            categories={safeCategories}
          />
        </ErrorBoundary>

        <button
          className="btn-add-transaction"
          onClick={() => setShowTransactionForm(true)}
        >
          + Nova Transação
        </button>

        {showTransactionForm && (
          <EnhancedTransactionForm
            onSubmit={handleAddTransaction}
            onCancel={() => setShowTransactionForm(false)}
            categories={safeCategories}
            userColor={userColor}
          />
        )}
      </main>
    </div>
  );
};

export default App;
