import React, { useState, useEffect, useRef, useMemo, lazy, Suspense } from 'react';
import CloudAuth from './components/CloudAuth';
import ResetPassword from './components/ResetPassword';
import BulkUpdateModal from './components/BulkUpdateModal';
import ErrorBoundary from './components/ErrorBoundary';
import Onboarding, { isOnboardingDone } from './components/Onboarding';
import { isInFinancialMonth } from './utils/financialMonth';

// Hooks
import { useAuth } from './hooks/useAuth';
import { useTransactions } from './hooks/useTransactions';
import { useSettings } from './hooks/useSettings';

// Context
import { AppProvider } from './context/AppContext';
import { ToastProvider } from './context/ToastContext';
import { toast } from './utils/toast';

// Tabs — HomeTab e AddTab carregam de imediato (caminho crítico)
import HomeTab from './components/tabs/HomeTab';
import AddTab  from './components/tabs/AddTab';

// Tabs pesados — lazy loaded (só carregam quando o utilizador abre o tab)
const StatsTab    = lazy(() => import('./components/tabs/StatsTab'));
const BudgetTab   = lazy(() => import('./components/tabs/BudgetTab'));
const ImportTab   = lazy(() => import('./components/tabs/ImportTab'));
const ProfileTab  = lazy(() => import('./components/tabs/ProfileTab'));
const ExportModal = lazy(() => import('./components/budget/ExportModal'));

// Fallback leve durante o carregamento lazy
const TabFallback = () => (
  <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--cosmos-text-3)', fontSize: 13 }}>
    <div style={{ width: 24, height: 24, border: '2px solid var(--cosmos-accent)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'pat-spin 0.8s linear infinite' }} />
  </div>
);

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
  const [pendingAddMode,   setPendingAddMode]   = useState(null);
  const [showExport,       setShowExport]       = useState(false);
  const mainContentRef = useRef(null);

  // Haptic feedback — 10ms pulse on Android via Vibration API
  const haptic = (ms = 10) => { try { navigator.vibrate?.(ms); } catch {} };

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
    if (tab === 'add' && extra?.mode) {
      setPendingAddMode(extra.mode);
    } else if (tab === 'add') {
      setPendingAddMode(null);
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
  }), [s.patrimony, safeTransactions, tx.computeCurrentBalance]);

  // Context value — dados estáveis partilhados por toda a árvore.
  // Só entra aqui o que muda raramente e é lido por 3+ componentes.
  // Memoizado (e antes dos returns condicionais) para não re-renderizar todos
  // os consumidores do AppContext a cada render do App.
  const appContextValue = useMemo(() => ({
    currentUser: auth.currentUser,
    categories:  tx.categories,
    onCategoriesChange: tx.handleCategoriesChange,
  }), [auth.currentUser, tx.categories, tx.handleCategoriesChange]);

  // ── Returns condicionais (DEPOIS de todos os hooks) ───────────────────────
  if (auth.loading) {
    return (
      <div className="app-new loading-screen">
        <div className="loading-content">
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

  return (
    <ToastProvider>
    <AppProvider value={appContextValue}>
    <div className="app-new fintech-ui modern-ui">
      {s.isOffline && (
        <div className="offline-banner" role="alert">
          <span>📡 Sem ligação — a mostrar dados em cache</span>
          <button onClick={s.loadUserData} className="offline-retry-btn">Tentar novamente</button>
        </div>
      )}
      <main className="main-content-new" ref={mainContentRef}>
        {activeTab === 'home' && (
          <ErrorBoundary tab="Início">
            <HomeTab
              balance={balance}
              transactions={filteredTransactions}
              currentMonth={s.currentMonth}
              patrimony={patrimonyWithLiveBalances}
              financialMonthStartDay={effectiveStartDay}
              homeUsesFinancialMonth={s.homeUsesFinancialMonth}
              recurringPayments={s.recurringPayments}
              confirmedRecurring={s.confirmedRecurring}
              budgets={s.budgets}
              onNavigate={handleNavigateFromStats}
              userName={userName}
              isLoading={s.isLoadingData}
            />
          </ErrorBoundary>
        )}

        {activeTab === 'stats' && (
          <ErrorBoundary tab="Estatísticas">
            <Suspense fallback={<TabFallback />}>
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
            </Suspense>
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
              goals={s.goals}
              onGoalsChange={s.handleGoalsChange}
              initialMode={pendingAddMode}
            />
          </ErrorBoundary>
        )}

        {activeTab === 'budget' && (
          <ErrorBoundary tab="Orçamento">
            <Suspense fallback={<TabFallback />}>
            <BudgetTab
              transactions={safeTransactions}
              currentMonth={s.currentMonth}
              budgets={s.budgets}
              onBudgetsChange={s.handleBudgetsChange}
              patrimony={patrimonyWithLiveBalances}
              onPatrimonyChange={s.handlePatrimonyChange}
              onAccountRename={tx.handleAccountRename}
              mainAccountId={s.mainAccountId}
              onMainAccountChange={s.handleMainAccountChange}
              financialMonthStartDay={effectiveStartDay}
              pendingNav={pendingBudgetNav}
              onNavConsumed={() => setPendingBudgetNav(null)}
              recurringPayments={s.recurringPayments}
              onRecurringPaymentsChange={s.handleRecurringPaymentsChange}
              confirmedRecurring={s.confirmedRecurring}
              onConfirmRecurring={s.handleConfirmRecurring}
              goals={s.goals}
              onGoalsChange={s.handleGoalsChange}
            />
            </Suspense>
          </ErrorBoundary>
        )}

        {activeTab === 'import' && (
          <ErrorBoundary tab="Importar">
            <Suspense fallback={<TabFallback />}>
            <ImportTab
              onImportDone={tx.handleImport}
              learnedRules={tx.learnedRules}
            />
            </Suspense>
          </ErrorBoundary>
        )}

        {activeTab === 'profile' && (
          <ErrorBoundary tab="Perfil">
            <Suspense fallback={<TabFallback />}>
            <ProfileTab
              onNavigateToImport={() => setActiveTab('import')}
              userName={userName}
              onLogout={async () => {
                await auth.handleLogout();
                s.resetForLogout();
                tx.initFromLoad({ rows: [], accountMap: {} });
              }}
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
              migrationPending={s.migrationPending}
              onMigrateConfirm={s.handleMigrateConfirm}
              onMigrateDismiss={s.handleMigrateDismiss}
              onDataDeleted={() => {
                tx.initFromLoad({ rows: [], accountMap: {} });
                s.resetForLogout();
                setActiveTab('home');
              }}
              onExportOpen={() => setShowExport(true)}
            />
            </Suspense>
          </ErrorBoundary>
        )}
      </main>

      {/* Export Modal — at App level so it has access to all data */}
      {showExport && (
        <Suspense fallback={null}>
          <ExportModal
            open={showExport}
            onClose={() => setShowExport(false)}
            transactions={tx.transactions}
            patrimony={patrimonyWithLiveBalances}
            budgets={s.budgets}
            currentMonth={s.currentMonth}
            financialMonthStartDay={s.financialMonthStartDay}
          />
        </Suspense>
      )}

      {/* Bottom Navigation — unified 5-item bar */}
      <nav className="bottom-nav">
        <button className={`nav-item ${activeTab === 'home'    ? 'active' : ''}`} onClick={() => { haptic(8);  setActiveTab('home');    }}>
          <span className="nav-icon"><Home     size={22} strokeWidth={1.75} /></span>
          <span className="nav-label">Home</span>
        </button>
        <button className={`nav-item ${activeTab === 'stats'   ? 'active' : ''}`} onClick={() => { haptic(8);  setActiveTab('stats');   }}>
          <span className="nav-icon"><BarChart2 size={22} strokeWidth={1.75} /></span>
          <span className="nav-label">Stats</span>
        </button>

        {/* Centre Add button — part of the bar, projects above it */}
        <button
          className={`nav-item nav-item--add ${activeTab === 'add' ? 'nav-item--add-active' : ''}`}
          onClick={() => { haptic(15); setPendingAddMode(null); setActiveTab('add'); }}
          aria-label="Adicionar transação"
        >
          <span className="nav-add-inner">+</span>
        </button>

        <button className={`nav-item ${activeTab === 'budget'  ? 'active' : ''}`} onClick={() => { haptic(8);  setActiveTab('budget');  }}>
          <span className="nav-icon"><LayoutGrid size={20} strokeWidth={1.75} /></span>
          <span className="nav-label">Budget</span>
        </button>
        <button className={`nav-item ${activeTab === 'profile' ? 'active' : ''}`} onClick={() => { haptic(8);  setActiveTab('profile'); }}>
          <span className="nav-icon"><User      size={22} strokeWidth={1.75} /></span>
          <span className="nav-label">Perfil</span>
        </button>
      </nav>

      {/* Modal de atualização em massa de categoria */}
      {tx.bulkPending && (
        <BulkUpdateModal
          bulkPending={tx.bulkPending}
          onConfirm={tx.handleBulkConfirm}
          onDismiss={tx.handleBulkDismiss}
        />
      )}
    </div>
    </AppProvider>
    </ToastProvider>
  );
};

export default App;
