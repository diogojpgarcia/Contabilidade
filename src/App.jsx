import React, { useState, useEffect } from 'react';
import UserCard from './components/UserCard';
import PasswordLogin from './components/PasswordLogin';
import PasswordSetup from './components/PasswordSetup';
import RecoverySetup from './components/RecoverySetup';
import BackupSettings from './components/BackupSettings';
import EnhancedTransactionForm from './components/EnhancedTransactionForm';
import TransactionList from './components/TransactionList';
import FinancialOverview from './components/FinancialOverview';
import SmartSuggestions from './components/SmartSuggestions';
import ProfessionalDashboard from './components/ProfessionalDashboard';
import AdvancedAnalytics from './components/AdvancedAnalytics';
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
  loadTransactions,
  saveTransactions,
  formatCurrency,
  getMonthKey,
  getCategoryById,
  MONTHS
} from './utils/data';
import {
  calculateFinancialMetrics,
  calculateCategoryBreakdown,
  calculateTrends,
  calculateCategoryAverages,
  generateSmartSuggestions,
  calculateSavingsGoalProgress
} from './utils/financial-analysis';
import { getRecoveryCode, createAutoBackup } from './utils/security-system';
import './App.css';

const App = () => {
  // Authentication state
  const [authStage, setAuthStage] = useState('user-select');
  const [selectedUser, setSelectedUser] = useState(null);
  const [authError, setAuthError] = useState('');
  const [currentUser, setCurrentUser] = useState(null);

  // v3.0: Security & Recovery state
  const [showRecoverySetup, setShowRecoverySetup] = useState(false);
  const [showBackupSettings, setShowBackupSettings] = useState(false);

  // App state
  const [transactions, setTransactions] = useState([]);
  const [currentMonth, setCurrentMonth] = useState(getMonthKey(new Date().toISOString()));
  const [showTransactionForm, setShowTransactionForm] = useState(false);
  const [showAdvancedAnalytics, setShowAdvancedAnalytics] = useState(false);
  const [savingsGoal] = useState(null);

  // Check for existing session on mount
  useEffect(() => {
    const session = getCurrentSession();
    if (session && session.userId) {
      const user = USERS[session.userId];
      if (user) {
        setCurrentUser(user);
        setAuthStage('authenticated');
        loadUserTransactions(session.userId);
      }
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
    try {
      await createUserPIN(selectedUser.id, password);
      
      // v3.0: Show recovery setup after password creation
      setShowRecoverySetup(true);
    } catch (error) {
      setAuthError('Erro ao criar password. Tenta novamente.');
    }
  };

  const handlePasswordLoginComplete = async (password) => {
    try {
      const isValid = await validateUserPIN(selectedUser.id, password);
      if (isValid) {
        setCurrentSession(selectedUser.id);
        setCurrentUser(selectedUser);
        setAuthStage('authenticated');
        loadUserTransactions(selectedUser.id);
        setAuthError('');
      } else {
        setAuthError('Password incorreta. Tenta novamente.');
      }
    } catch (error) {
      setAuthError('Erro ao validar password. Tenta novamente.');
    }
  };

  const handleBackToUserSelect = () => {
    setAuthStage('user-select');
    setSelectedUser(null);
    setAuthError('');
  };

  // v3.0: Handle recovery setup completion
  const handleRecoverySetupComplete = (recoveryCode) => {
    setShowRecoverySetup(false);
    setCurrentSession(selectedUser.id);
    setCurrentUser(selectedUser);
    setAuthStage('authenticated');
    loadUserTransactions(selectedUser.id);
    
    // Create first auto backup
    createAutoBackup(selectedUser.id);
  };

  // v3.0: Skip recovery setup (not recommended)
  const handleSkipRecoverySetup = () => {
    if (window.confirm('Não recomendado! Sem recuperação, podes perder acesso aos dados. Continuar mesmo assim?')) {
      setShowRecoverySetup(false);
      setCurrentSession(selectedUser.id);
      setCurrentUser(selectedUser);
      setAuthStage('authenticated');
      loadUserTransactions(selectedUser.id);
    }
  };

  // v3.0: Handle PIN recovery success
    setCurrentSession(selectedUser.id);
    setCurrentUser(selectedUser);
    setAuthStage('authenticated');
    loadUserTransactions(selectedUser.id);
  };



    setPinLength(null);
  };

  const handleLogout = () => {
    clearCurrentSession();
    setCurrentUser(null);
    setAuthStage('user-select');
    setSelectedUser(null);
    setTransactions([]);
  };

  const handleAddTransaction = (transaction) => {
    const newTransactions = [...transactions, transaction];
    setTransactions(newTransactions);
    saveTransactions(currentUser.id, newTransactions);
    setShowTransactionForm(false);
  };

  const handleDeleteTransaction = (transactionId) => {
    if (window.confirm('Tem a certeza que deseja eliminar esta transação?')) {
      const newTransactions = transactions.filter(t => t.id !== transactionId);
      setTransactions(newTransactions);
      saveTransactions(currentUser.id, newTransactions);
    }
  };

  const handleMonthChange = (direction) => {
    const [year, month] = currentMonth.split('-').map(Number);
    const date = new Date(year, month - 1 + direction, 1);
    setCurrentMonth(getMonthKey(date.toISOString()));
  };

  // Calculate comprehensive financial metrics
  const metrics = calculateFinancialMetrics(transactions, currentMonth);
  const categoryBreakdown = calculateCategoryBreakdown(transactions, currentMonth);
  const trends = calculateTrends(transactions, currentMonth, 6);
  const categoryAverages = calculateCategoryAverages(transactions, currentMonth, 3);
  const smartSuggestions = generateSmartSuggestions(transactions, currentMonth);

  // Calculate savings goal progress if goal exists
  const savingsGoalProgress = savingsGoal 
    ? calculateSavingsGoalProgress(transactions, savingsGoal.amount, savingsGoal.startDate)
    : null;

  // Keep existing monthlyTotals for backward compatibility
  const monthlyTotals = {
    income: metrics.income,
    expenses: metrics.expenses,
    balance: metrics.balance
  };

  // Get top 3 categories
  const topCategories = Object.entries(categoryBreakdown)
    .sort(([, a], [, b]) => b.total - a.total)
    .slice(0, 3)
    .map(([catId, data]) => ({
      ...getCategoryById(catId, 'expense'),
      amount: data.total,
      percentage: metrics.expenses > 0 ? (data.total / metrics.expenses) * 100 : 0
    }));

  // Render authentication screens
  if (authStage === 'user-select') {
    return (
      <div className="app">
        <div className="auth-container">
          <div className="auth-header">
            <h1>💰 Finanças Familiares</h1>
            <p>Selecione o seu perfil</p>
          </div>
          <div className="user-cards">
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
          />
          <button 
            className="btn-forgot-password"
          >
            Esqueci a password
          </button>
        </div>
      </div>
    );
  }

  // Main app (authenticated)
  const [year, month] = currentMonth.split('-').map(Number);
  const monthName = MONTHS[month - 1];

  return (
    <div className="app authenticated">
      {/* Header */}
      <header className="app-header">
        <div className="header-user">
          <div className="user-avatar-small" style={{ '--user-color': currentUser.color }}>
            {currentUser.initials}
          </div>
          <span>{currentUser.name}</span>
        </div>
        <div className="header-actions">
          <button 
            onClick={() => setShowBackupSettings(true)} 
            className="btn-backup"
            title="Backup & Recuperação"
          >
            💾
          </button>
          <button onClick={handleLogout} className="btn-logout">
            Sair
          </button>
        </div>
      </header>

      {/* Month selector */}
      <div className="month-selector">
        <button onClick={() => handleMonthChange(-1)} className="month-nav">
          ‹
        </button>
        <h2>{monthName} {year}</h2>
        <button onClick={() => handleMonthChange(1)} className="month-nav">
          ›
        </button>
      </div>

      {/* Summary cards */}
      <div className="summary-cards">
        <div className="summary-card income">
          <div className="summary-label">Receitas</div>
          <div className="summary-value">{formatCurrency(monthlyTotals.income)}</div>
        </div>
        <div className="summary-card expense">
          <div className="summary-label">Despesas</div>
          <div className="summary-value">{formatCurrency(monthlyTotals.expenses)}</div>
        </div>
        <div className={`summary-card balance ${monthlyTotals.balance >= 0 ? 'positive' : 'negative'}`}>
          <div className="summary-label">Saldo</div>
          <div className="summary-value">{formatCurrency(monthlyTotals.balance)}</div>
        </div>
      </div>

      {/* Financial Overview */}
      <FinancialOverview 
        metrics={metrics} 
        savingsGoal={savingsGoalProgress} 
      />

      {/* v3.0: Professional Dashboard */}
      <ProfessionalDashboard
        metrics={metrics}
        transactions={transactions}
        currentMonth={currentMonth}
        categoryBreakdown={categoryBreakdown}
      />

      {/* Smart Suggestions */}
      {smartSuggestions.length > 0 && (
        <SmartSuggestions suggestions={smartSuggestions} />
      )}

      {/* Top categories */}
      {topCategories.length > 0 && (
        <div className="top-categories">
          <h3>Principais Categorias</h3>
          <div className="category-list">
            {topCategories.map(cat => (
              <div key={cat.id} className="category-item">
                <div className="category-info">
                  <span className="category-icon" style={{ backgroundColor: cat.color }}>
                    {cat.icon}
                  </span>
                  <span className="category-name">{cat.label}</span>
                </div>
                <div className="category-stats">
                  <span className="category-amount">{formatCurrency(cat.amount)}</span>
                  <span className="category-percentage">{cat.percentage.toFixed(0)}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Analytics Button */}
      {transactions.length > 0 && (
        <div className="analytics-actions">
          <button 
            onClick={() => setShowAdvancedAnalytics(true)}
            className="btn-analytics"
          >
            📊 Ver Análise Detalhada
          </button>
        </div>
      )}

      {/* Transactions */}
      <div className="transactions-section">
        <div className="section-header">
          <h3>Transações</h3>
        </div>
        <TransactionList
          transactions={transactions.filter(t => getMonthKey(t.date) === currentMonth)}
          onDelete={handleDeleteTransaction}
        />
      </div>

      {/* Add button */}
      <button
        onClick={() => setShowTransactionForm(true)}
        className="btn-add"
        aria-label="Adicionar transação"
      >
        +
      </button>

      {/* Transaction form modal */}
      {showTransactionForm && (
        <EnhancedTransactionForm
          onAdd={handleAddTransaction}
          onCancel={() => setShowTransactionForm(false)}
        />
      )}

      {/* Advanced Analytics Modal */}
      {showAdvancedAnalytics && (
        <AdvancedAnalytics
          trends={trends}
          categoryBreakdown={categoryBreakdown}
          averages={categoryAverages}
          onClose={() => setShowAdvancedAnalytics(false)}
        />
      )}

      {/* v3.0: Backup Settings Modal */}
      {showBackupSettings && (
        <BackupSettings
          user={currentUser}
          onClose={() => setShowBackupSettings(false)}
        />
      )}

      {/* v3.0: Recovery Setup Modal */}
      {showRecoverySetup && (
        <RecoverySetup
          user={selectedUser}
          onComplete={handleRecoverySetupComplete}
          onSkip={handleSkipRecoverySetup}
        />
      )}

      {/* v3.0: PIN Recovery Modal */}
          user={selectedUser}
        />
      )}
    </div>
  );
};

export default App;
