import React, { useState, useEffect, useRef, useMemo } from 'react';
import CloudAuth from './components/CloudAuth';
import ResetPassword from './components/ResetPassword';
import BulkUpdateModal from './components/BulkUpdateModal';
import ErrorBoundary from './components/ErrorBoundary';
import { isInFinancialMonth } from './utils/financialMonth';

// Hooks
import { useAuth } from './hooks/useAuth';
import { useTransactions } from './hooks/useTransactions';
import { useSettings } from './hooks/useSettings';

// Context
import { AppProvider } from './context/AppContext';
import { toast } from './utils/toast';
import { ToastProvider } from './context/ToastContext';

// Tabs
import HomeTab from './components/tabs/HomeTab';
import StatsTab from './components/tabs/StatsTab';
import AddTab from './components/tabs/AddTab';
import BudgetTab from './components/tabs/BudgetTab';
import ImportTab from './components/tabs/ImportTab';
import ProfileTab from './components/tabs/ProfileTab';

import { Home, BarChart2, LayoutGrid, User } from './components/icons';

import './styles/cosmos-tokens.css';
import './styles/modern.css';
import './styles/fintech.css';
import './styles/soft-future.css';
import './styles/palette-overrides.css'; /* LAST — always wins the cascade */

const App = () => {
  // ── Hooks ─────────────────────────────────────────────────────────────────
  const auth = useAuth();
  const tx   = useTransactions(auth.currentUser);
  const s    = useSettings(auth.currentUser, tx);

  // ── UI state (único estado que fica no App) ────────────────────────────────
  const [activeTab, setActiveTab]         = useState('home');
  const [pendingBudgetNav, setPendingBudgetNav] = useState(null);
  const mainContentRef = useRef(null);

  // Scroll para o topo ao mudar de tab
  useEffect(() => {
    if (mainContentRef.current) mainContentRef.current.scrollTop = 0;
  }, [activeTab]);

  // Boot: carregar dados quando o utilizador fizer login
  useEffect(() => {
    if (auth.currentUser) s.loadUserData();
  }, [auth.currentUser]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Navegação cross-tab (Stats → Budget) ──────────────────────────────────
  const handleNavigateFromStats = (tab, extra = null) => {
    setActiveTab(tab);
    if (tab === 'budget' && (extra?.categoryLabel || extra?.view)) {
      setPendingBudgetNav({ ...extra, ts: Date.now() });
    }
  };

  // ── Hooks obrigatórios antes de qualquer return condicional ───────────────
  const safeTransactions = Array.isArray(tx.transactions) ? tx.transactions : [];
  const effectiveStartDay = s.useFinancialMonth ? s.financialMonthStartDay : 1;

  const defaultAccount = useMemo(
    () => (s.patrimony.accounts || []).find(a => a.id === s.mainAccountId) || null,
    [s.patrimony.accounts, s.mainAccountId]
  );

  const patrimonyWithLiveBalances = useMemo(() => ({
    ...s.patrimony,
    accounts: (s.patrimony.accounts || []).map(acc => ({
      ...acc,
      currentBalance: tx.computeCurrentBalance(acc, safeTransactions),
    })),
  }), [s.patrimony, safeTransactions]); // eslint-disable-line react-hooks/exhaustive-deps

  const totalBalance = useMemo(() =>
    safeTransactions.reduce((acc, t) => {
      if (!t?.type) return acc;
      const amt = parseFloat(t.amount || 0);
      if (t.type === 'income')  return acc + amt;
      if (t.type === 'expense') return acc - amt;
      return acc;
    }, 0),
    [safeTransactions]
  );

  // ── Returns condicionais (DEPOIS de todos os hooks) ───────────────────────
  if (auth.loading) {
    return (
      <div className="app-new loading-screen">
        <div className="loading-content">
          <h1>💰 Finanças Familiares</h1>
          <div className="loading-spinner"></div>
        </div>
      </div>
    );
  }

  if (auth.isRecoveryMode) {
    return (
      <div className="app-new">
        <ResetPassword onComplete={auth.handleResetComplete} />
      </div>
    );
  }

  if (!auth.currentUser) {
    return (
      <div className="app-new">
        <CloudAuth onSuccess={auth.handleAuthSuccess} />
      </div>
    );
  }

  // ── Valores derivados (pós-login) ─────────────────────────────────────────
  const filteredTransactions = safeTransactions.filter(
    t => t.date && isInFinancialMonth(t.date, s.currentMonth, effectiveStartDay)
  );
  const monthlyIncome    = filteredTransactions.filter(t => t.type === 'income').reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);
  const monthlyExpenses  = filteredTransactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);
  const balance          = monthlyIncome - monthlyExpenses;
  const userName         = auth.currentUser.user_metadata?.full_name || auth.currentUser.email.split('@')[0];

  // Context value — dados estáveis partilhados por toda a árvore.
  // Só entra aqui o que muda raramente e é lido por 3+ componentes.
  const appContextValue = {
    currentUser: auth.currentUser,
    categories:  tx.categories,
    onCategoriesChange: tx.handleCategoriesChange,
    theme: s.theme,
  };

  return (
    <ToastProvider>
    <AppProvider value={appContextValue}>
    <div className={`app-new ${s.theme}-ui${s.theme === 'fintech' ? ' modern-ui' : ''}`}>
      <main className="main-content-new" ref={mainContentRef}>
        {activeTab === 'home' && (
          <ErrorBoundary tab="Início">
            <HomeTab
              balance={balance}
              income={monthlyIncome}
              expenses={monthlyExpenses}
              totalBalance={totalBalance}
              transactions={filteredTransactions}
              currentMonth={s.currentMonth}
              onMonthChange={s.setCurrentMonth}
              patrimony={patrimonyWithLiveBalances}
              homePatrimonyView={s.homePatrimonyView}
              onPatrimonyViewChange={s.handlePatrimonyViewChange}
              onCategoryChange={tx.handleCategoryChange}
              onAccountChange={tx.handleAccountChange}
              onTransactionDeleted={tx.handleDeleteTransaction}
              onTransactionEdited={tx.handleEditTransaction}
              financialMonthStartDay={effectiveStartDay}
              homeUsesFinancialMonth={s.homeUsesFinancialMonth}
              recurringPayments={s.recurringPayments}
              confirmedRecurring={s.confirmedRecurring}
              onNavigate={handleNavigateFromStats}
              userName={userName}
              financialFocus={s.financialFocus}
            />
          </ErrorBoundary>
        )}

        {activeTab === 'stats' && (
          <ErrorBoundary tab="Estatísticas">
            <StatsTab
              transactions={safeTransactions}
              filteredTransactions={filteredTransactions}
              currentMonth={s.currentMonth}
              onMonthChange={s.setCurrentMonth}
              budgets={s.budgets}
              onTransactionDeleted={tx.handleDeleteTransaction}
              onCategoryChange={tx.handleCategoryChange}
              onAccountChange={tx.handleAccountChange}
              onTransactionEdited={tx.handleEditTransaction}
              patrimony={patrimonyWithLiveBalances}
              financialMonthStartDay={effectiveStartDay}
              onNavigate={handleNavigateFromStats}
              financialFocus={s.financialFocus}
            />
          </ErrorBoundary>
        )}

        {activeTab === 'add' && (
          <ErrorBoundary tab="Adicionar">
            <AddTab
              onTransactionAdded={(transaction) =>
                tx.handleAddTransaction(transaction, s.mainAccountId, s.patrimony.accounts)
                  .then(() => setActiveTab('home'))
                  .catch(err => toast.error('Erro ao adicionar transação: ' + err.message))
              }
              onTransfer={(fromId, toId, amount) =>
                tx.handleTransfer(fromId, toId, amount, s.patrimony.accounts)
                  .then(() => setActiveTab('home'))
                  .catch(err => toast.error('Erro ao criar transferência: ' + err.message))
              }
              patrimony={patrimonyWithLiveBalances}
              defaultAccount={defaultAccount}
            />
          </ErrorBoundary>
        )}

        {activeTab === 'budget' && (
          <ErrorBoundary tab="Orçamento">
            <BudgetTab
              transactions={safeTransactions}
              currentMonth={s.currentMonth}
              budgets={s.budgets}
              onBudgetsChange={s.handleBudgetsChange}
              patrimony={s.patrimony}
              onPatrimonyChange={s.handlePatrimonyChange}
              mainAccountId={s.mainAccountId}
              onMainAccountChange={s.handleMainAccountChange}
              financialMonthStartDay={effectiveStartDay}
              pendingNav={pendingBudgetNav}
              onNavConsumed={() => setPendingBudgetNav(null)}
              recurringPayments={s.recurringPayments}
              onRecurringPaymentsChange={s.handleRecurringPaymentsChange}
              confirmedRecurring={s.confirmedRecurring}
              onConfirmRecurring={s.handleConfirmRecurring}
            />
          </ErrorBoundary>
        )}

        {activeTab === 'import' && (
          <ErrorBoundary tab="Importar">
            <ImportTab
              onImportDone={tx.handleImport}
              learnedRules={tx.learnedRules}
            />
          </ErrorBoundary>
        )}

        {activeTab === 'profile' && (
          <ErrorBoundary tab="Perfil">
            <ProfileTab
              onNavigateToImport={() => setActiveTab('import')}
              userName={userName}
              onLogout={async () => {
                await auth.handleLogout();
                s.resetForLogout();
                tx.initFromLoad({ rows: [], accountMap: {} });
              }}
              setTheme={s.setTheme}
              colorPalette={s.colorPalette}
              setColorPalette={s.setColorPalette}
              patrimony={patrimonyWithLiveBalances}
              defaultAccount={defaultAccount}
              onDefaultAccountChange={(acc) => s.handleMainAccountChange(acc?.id || null)}
              useFinancialMonth={s.useFinancialMonth}
              financialMonthStartDay={s.financialMonthStartDay}
              onFinancialMonthChange={s.handleFinancialMonthChange}
              homeUsesFinancialMonth={s.homeUsesFinancialMonth}
              onHomeUsesFinancialMonthChange={s.handleHomeUsesFinancialMonthChange}
              financialFocus={s.financialFocus}
              onFocusChange={s.handleFocusChange}
              onDataDeleted={() => {
                tx.initFromLoad({ rows: [], accountMap: {} });
                s.resetForLogout();
                setActiveTab('home');
              }}
            />
          </ErrorBoundary>
        )}
      </main>

      {/* Bottom Navigation */}
      <nav className="bottom-nav">
        <button className={`nav-item ${activeTab === 'home'   ? 'active' : ''}`} onClick={() => setActiveTab('home')}>
          <span className="nav-icon"><Home size={22} strokeWidth={1.75} /></span>
          <span className="nav-label">Home</span>
        </button>
        <button className={`nav-item ${activeTab === 'stats'  ? 'active' : ''}`} onClick={() => setActiveTab('stats')}>
          <span className="nav-icon"><BarChart2 size={22} strokeWidth={1.75} /></span>
          <span className="nav-label">Stats</span>
        </button>
        <div style={{ width: '52px', flexShrink: 0 }} />
        <button className={`nav-item ${activeTab === 'budget' ? 'active' : ''}`} onClick={() => setActiveTab('budget')}>
          <span className="nav-icon"><LayoutGrid size={22} strokeWidth={1.75} /></span>
          <span className="nav-label">Budget</span>
        </button>
        <button className={`nav-item ${activeTab === 'profile'? 'active' : ''}`} onClick={() => setActiveTab('profile')}>
          <span className="nav-icon"><User size={22} strokeWidth={1.75} /></span>
          <span className="nav-label">Perfil</span>
        </button>
      </nav>

      {/* FAB central */}
      <button
        onClick={() => setActiveTab('add')}
        aria-label="Adicionar transação"
        style={{
          position: 'fixed', bottom: '28px', left: '50%', transform: 'translateX(-50%)',
          width: '52px', height: '52px', borderRadius: '50%',
          background: '#00DDFF', color: '#000000',
          fontSize: '26px', fontWeight: '300',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 0 24px rgba(0,221,255,0.5)',