import React, { useState, useEffect } from 'react';
import CloudAuth from './components/CloudAuth';
import ResetPassword from './components/ResetPassword';
import { authService, dbService } from './lib/supabase';
import { CATEGORIES_EXPENSE, CATEGORIES_INCOME } from './utils/categories-professional';
import { getMonthKey } from './utils/data';

// New Tab Components
import HomeTab from './components/tabs/HomeTab';
import StatsTab from './components/tabs/StatsTab';
import AddTab from './components/tabs/AddTab';
import SearchTab from './components/tabs/SearchTab';
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
    <div className="app-new">
      {/* Header */}
      <header className="app-header-new">
        <div className="header-content">
          <h1>💰 Finanças Familiares</h1>
          <p className="header-month">{currentMonth}</p>
        </div>
      </header>

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
          />
        )}
        
        {activeTab === 'stats' && (
          <StatsTab
            transactions={transactions}
            currentMonthTransactions={filteredTransactions}
            currentMonth={currentMonth}
            categories={categoriesProfessional}
          />
        )}
        
        {activeTab === 'add' && (
          <AddTab
            onSubmit={handleAddTransaction}
            categories={categoriesProfessional}
          />
        )}
        
        {activeTab === 'search' && (
          <SearchTab
            transactions={filteredTransactions}
            allTransactions={transactions}
            categories={categoriesProfessional}
            onDelete={handleDeleteTransaction}
            onEdit={handleEditTransaction}
          />
        )}
        
        {activeTab === 'profile' && (
          <ProfileTab
            user={currentUser}
            userName={userName}
            onLogout={handleLogout}
          />
        )}
      </main>

      {/* Bottom Navigation */}
      <nav className="bottom-nav">
        <button
          className={`nav-item ${activeTab === 'home' ? 'active' : ''}`}
          onClick={() => setActiveTab('home')}
        >
          <span className="nav-icon">🏠</span>
          <span className="nav-label">Home</span>
        </button>
        
        <button
          className={`nav-item ${activeTab === 'stats' ? 'active' : ''}`}
          onClick={() => setActiveTab('stats')}
        >
          <span className="nav-icon">📊</span>
          <span className="nav-label">Stats</span>
        </button>
        
        <button
          className={`nav-item nav-item-add ${activeTab === 'add' ? 'active' : ''}`}
          onClick={() => setActiveTab('add')}
        >
          <span className="nav-icon-large">➕</span>
        </button>
        
        <button
          className={`nav-item ${activeTab === 'search' ? 'active' : ''}`}
          onClick={() => setActiveTab('search')}
        >
          <span className="nav-icon">🔍</span>
          <span className="nav-label">Search</span>
        </button>
        
        <button
          className={`nav-item ${activeTab === 'profile' ? 'active' : ''}`}
          onClick={() => setActiveTab('profile')}
        >
          <span className="nav-icon">👤</span>
          <span className="nav-label">Perfil</span>
        </button>
      </nav>
    </div>
  );
};

export default App;
