import React, { useState, useEffect } from 'react';
import UserCard from './components/UserCard';
import PINInput from './components/PINInput';
import RecoverySetup from './components/RecoverySetup';
import PINRecovery from './components/PINRecovery';
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
  const [pinLength, setPinLength] = useState(null);
  const [pinError, setPinError] = useState('');
  const [currentUser, setCurrentUser] = useState(null);

  // v3.0: Security & Recovery state
  const [showRecoverySetup, setShowRecoverySetup] = useState(false);
  const [showPINRecovery, setShowPINRecovery] = useState(false);
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
    setPinError('');

    if (hasUserSetupPIN(userId)) {
      setAuthStage('pin-login');
    } else {
      setAuthStage('pin-setup');
    }
  };

  const handlePinLengthSelect = (length) => {
    setPinLength(length);
  };

  const handlePinSetupComplete = async (pin) => {
    try {
      await createUserPIN(selectedUser.id, pin);
      
      // v3.0: Show recovery setup after PIN creation
      setShowRecoverySetup(true);
    } catch (error) {
      setPinError('Erro ao criar PIN. Tente novamente.');
    }
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
  const handlePINRecoverySuccess = () => {
    setShowPINRecovery(false);
    setCurrentSession(selectedUser.id);
    setCurrentUser(selectedUser);
    setAuthStage('authenticated');
    loadUserTransactions(selectedUser.id);
  };

  const handlePinLoginComplete = async (pin) => {
    try {
      const isValid = await validateUserPIN(selectedUser.id, pin);
      if (isValid) {
        setCurrentSession(selectedUser.id);
        setCurrentUser(selectedUser);
        setAuthStage('authenticated');
        loadUserTransactions(selectedUser.id);
        setPinError('');
      } else {
        setPinError('PIN incorreto. Tente novamente.');
      }
    } catch (error) {
      setPinError('Erro ao validar PIN. Tente novamente.');
    }
  };

  const handleBackToUserSelect = () => {
    setAuthStage('user-select');
    setSelectedUser(null);
    setPinLength(null);
    setPinError('');
  };

  const handleBackToPinLength = () => {
    setPinLength(null);
    setPinError('');
  };

  const handleLogout = () => {
    clearCurrentSession();
    setCurrentUser(null);
    setAuthStage('user-select');
    setSelectedUser(null);
    setTransactions([]);
    setPinError('');
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

  if (authStage === 'pin-setup' && !pinLength) {
    return (
      <div className="app">
        <div className="auth-container">
          <div className="auth-header">
            <div className="user-avatar-large" style={{ '--user-color': selectedUser.color }}>
              {selectedUser.initials}
            </div>
            <h2>{selectedUser.name}</h2>
            <p>Escolha o tamanho do seu PIN</p>
          </div>
          <div className="pin-length-options">
            <button
              onClick={() => handlePinLengthSelect(4)}
              className="pin-length-btn"
            >
              <div className="pin-length-number">4</div>
              <div>dígitos</div>
            </button>
            <button
              onClick={() => handlePinLengthSelect(6)}
              className="pin-length-btn"
            >
              <div className="pin-length-number">6</div>
              <div>dígitos</div>
            </button>
          </div>
          <button onClick={handleBackToUserSelect} className="btn-back">
            ← Voltar
          </button>
        </div>
      </div>
    );
  }

  if (authStage === 'pin-setup' && pinLength) {
    return (
      <div className="app">
        <div className="auth-container">
          <div className="auth-header">
            <div className="user-avatar-large" style={{ '--user-color': selectedUser.color }}>
              {selectedUser.initials}
            </div>
            <h2>{selectedUser.name}</h2>
            <p>Crie o seu PIN de {pinLength} dígitos</p>
          </div>
          <PINInput
            length={pinLength}
            onComplete={handlePinSetupComplete}
            onBack={handleBackToPinLength}
            error={pinError}
            requireConfirmation={true}
          />
        </div>
      </div>
    );
  }

  if (authStage === 'pin-login') {
    return (
      <div className="app">
        <div className="auth-container">
          <div className="auth-header">
            <div className="user-avatar-large" style={{ '--user-color': selectedUser.color }}>
              {selectedUser.initials}
            </div>
            <h2>{selectedUser.name}</h2>
            <p>Introduza o seu PIN</p>
          </div>
          <PINInput
            length={4}
            onComplete={handlePinLoginComplete}
            onBack={handleBackToUserSelect}
            error={pinError}
          />
          <button 
            onClick={() => setShowPINRecovery(true)} 
            className="btn-forgot-pin"
          >
            Esqueci o PIN
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
      {showPINRecovery && (
        <PINRecovery
          user={selectedUser}
          onSuccess={handlePINRecoverySuccess}
          onBack={() => setShowPINRecovery(false)}
        />
      )}
    </div>
  );
};

export default App;
