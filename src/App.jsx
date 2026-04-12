import React, { useState, useEffect } from 'react';
import UserCard from './components/UserCard';
import PasswordLogin from './components/PasswordLogin';
import PasswordSetup from './components/PasswordSetup';
import RecoverySetup from './components/RecoverySetup';
import BackupSettings from './components/BackupSettings';
import EnhancedTransactionForm from './components/EnhancedTransactionForm';
import TransactionList from './components/TransactionList';
import ErrorBoundary from './components/ErrorBoundary';
import CloudSyncButton from './components/CloudSyncButton';
import {
  USERS,
  hasUserSetupPIN,
  createUserPIN,
  validateUserPIN,
  getCurrentSession,
  setCurrentSession,
  clearCurrentSession
} from './utils/auth';
import {
  getMonthKey,
  saveTransactions,
  loadTransactions
} from './utils/data';
import { CATEGORIES_EXPENSE, CATEGORIES_INCOME } from './utils/categories-professional';
import './App.css';

const categoriesProfessional = { expense: CATEGORIES_EXPENSE, income: CATEGORIES_INCOME };

const App = () => {
  const [authStage, setAuthStage] = useState('user-select');
  const [selectedUser, setSelectedUser] = useState(null);
  const [authError, setAuthError] = useState('');
  const [currentUser, setCurrentUser] = useState(null);
  const [showRecoverySetup, setShowRecoverySetup] = useState(false);
  const [showBackupSettings, setShowBackupSettings] = useState(false);
  const [transactions, setTransactions] = useState([]);
  const [currentMonth, setCurrentMonth] = useState(getMonthKey(new Date().toISOString()));
  const [showTransactionForm, setShowTransactionForm] = useState(false);
  const [savingsGoal] = useState(null);

  useEffect(() => {
    const sessionUserId = getCurrentSession();
    if (sessionUserId && USERS[sessionUserId]) {
      setCurrentUser(USERS[sessionUserId]);
      setAuthStage('authenticated');
      loadUserTransactions(sessionUserId);
    }
  }, []);

  const loadUserTransactions = (userId) => {
    const userTransactions = loadTransactions(userId);
    setTransactions(userTransactions);
  };

  const handleUserSelect = (userId) => {
    const user = USERS[userId];
    setSelectedUser(user);
    setAuthError('');

    if (hasUserSetupPIN(userId)) {
      setAuthStage('password-login');
    } else {
      setAuthStage('password-setup');
    }
  };

  const handlePasswordSetupComplete = async (password) => {
    console.log('🔐 Criando nova password...');
    setAuthError('');
    
    try {
      await createUserPIN(selectedUser.id, password);
      console.log('✅ Password criada com sucesso!');
      setShowRecoverySetup(true);
    } catch (error) {
      console.error('❌ Erro ao criar password:', error);
      setAuthError('Erro ao criar password: ' + error.message);
    }
  };

  const handlePasswordLoginComplete = async (password) => {
    console.log('🔑 Tentando login com password...');
    setAuthError('');
    
    try {
      const isValid = await validateUserPIN(selectedUser.id, password);
      console.log('✅ Validação resultado:', isValid);
      
      if (isValid) {
        console.log('✅ Password correta! Fazendo login...');
        setCurrentSession(selectedUser.id);
        setCurrentUser(selectedUser);
        setAuthStage('authenticated');
        loadUserTransactions(selectedUser.id);
      } else {
        console.log('❌ Password incorreta');
        setAuthError('Password incorreta. Tenta novamente.');
      }
    } catch (error) {
      console.error('❌ Erro na validação:', error);
      setAuthError('Erro ao validar password: ' + error.message);
    }
  };

  const handleBackToUserSelect = () => {
    setAuthStage('user-select');
    setSelectedUser(null);
    setAuthError('');
  };

  const handleSwitchToLogin = () => {
    setAuthStage('password-login');
    setAuthError('');
  };

  const handleRecoverySetupComplete = () => {
    setShowRecoverySetup(false);
    setCurrentSession(selectedUser.id);
    setCurrentUser(selectedUser);
    setAuthStage('authenticated');
    loadUserTransactions(selectedUser.id);
  };

  const handleLogout = () => {
    clearCurrentSession();
    setCurrentUser(null);
    setAuthStage('user-select');
    setSelectedUser(null);
    setTransactions([]);
    setAuthError('');
  };

  const handleAddTransaction = (transaction) => {
    const newTransactions = [...transactions, transaction];
    setTransactions(newTransactions);
    saveTransactions(currentUser.id, newTransactions);
    setShowTransactionForm(false);
  };

  const handleDeleteTransaction = (id) => {
    const newTransactions = transactions.filter(t => t.id !== id);
    setTransactions(newTransactions);
    saveTransactions(currentUser.id, newTransactions);
  };

  const handleEditTransaction = (updatedTransaction) => {
    const newTransactions = transactions.map(t =>
      t.id === updatedTransaction.id ? updatedTransaction : t
    );
    setTransactions(newTransactions);
    saveTransactions(currentUser.id, newTransactions);
  };

  const handleBackToCurrentMonth = () => {
    setCurrentMonth(getMonthKey(new Date().toISOString()));
  };

  if (authStage === 'user-select') {
    return (
      <div className="app">
        <div className="auth-container">
          <div className="auth-header">
            <h1>Finanças Familiares</h1>
            <p>Escolha o seu utilizador</p>
          </div>
          <div className="user-selection">
            {Object.values(USERS).map(user => (
              <UserCard
                key={user.id}
                user={user}
                onClick={() => handleUserSelect(user.id)}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (authStage === 'password-setup') {
    return (
      <div className="app">
        <div className="auth-container">
          <PasswordSetup
            user={selectedUser}
            onComplete={handlePasswordSetupComplete}
            onBack={handleBackToUserSelect}
            onSwitchToLogin={handleSwitchToLogin}
          />
        </div>
      </div>
    );
  }

  if (authStage === 'password-login') {
    return (
      <div className="app">
        <div className="auth-container">
          <PasswordLogin
            user={selectedUser}
            onSuccess={handlePasswordLoginComplete}
            onBack={handleBackToUserSelect}
            error={authError}
          />
        </div>
      </div>
    );
  }

  if (showRecoverySetup) {
    return (
      <div className="app">
        <RecoverySetup
          userId={selectedUser.id}
          onComplete={handleRecoverySetupComplete}
        />
      </div>
    );
  }

  const filteredTransactions = transactions.filter(t => getMonthKey(t.date) === currentMonth);
  const monthlyIncome = filteredTransactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);
  const monthlyExpenses = filteredTransactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);
  const balance = monthlyIncome - monthlyExpenses;

  // Safety check - ensure categories exist
  const safeCategories = categoriesProfessional || { expense: [], income: [] };

  console.log('📊 App state:', {
    currentUser: currentUser?.name,
    transactions: transactions?.length,
    filteredTransactions: filteredTransactions?.length,
    categories: !!categoriesProfessional,
    safeCategories: !!safeCategories
  });

  return (
    <div className="app" style={{ '--user-color': currentUser.color }}>
      <header className="app-header">
        <div className="header-left">
          <div className="user-avatar" style={{ '--user-color': currentUser.color }}>
            {currentUser.initials}
          </div>
          <div>
            <h2>{currentUser.name}</h2>
            <p className="month-display">{currentMonth}</p>
          </div>
        </div>
        <div className="header-actions">
          <CloudSyncButton 
            localTransactions={transactions}
            onSyncComplete={(userId) => {
              console.log('✅ Sync complete for user:', userId);
              alert('Dados sincronizados! Agora podes aceder de qualquer dispositivo.');
            }}
          />
          <button
            onClick={() => setShowBackupSettings(!showBackupSettings)}
            className="btn-icon"
            title="Backup & Segurança"
          >
            💾
          </button>
          <button onClick={handleLogout} className="btn-icon" title="Terminar sessão">
            🚪
          </button>
        </div>
      </header>

      {showBackupSettings && (
        <BackupSettings
          userId={currentUser.id}
          onClose={() => setShowBackupSettings(false)}
        />
      )}

      <main className="main-content">
        <div className="simple-overview">
          <div className="balance-card">
            <h3>Saldo do Mês</h3>
            <div className="balance-amount" style={{ 
              color: balance >= 0 ? '#10b981' : '#ef4444' 
            }}>
              {balance >= 0 ? '+' : ''}{balance.toFixed(2)}€
            </div>
            <div className="balance-details">
              <div>Receitas: <span style={{color: '#10b981'}}>+{monthlyIncome.toFixed(2)}€</span></div>
              <div>Despesas: <span style={{color: '#ef4444'}}>-{monthlyExpenses.toFixed(2)}€</span></div>
            </div>
          </div>
        </div>

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
            userColor={currentUser.color}
          />
        )}

          />
        )}
      </main>
    </div>
  );
};

export default App;
