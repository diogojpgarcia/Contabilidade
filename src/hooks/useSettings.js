import { useState, useEffect, useCallback, useRef } from 'react';
import { dbService } from '../lib/supabase';
import { CATEGORIES_EXPENSE, CATEGORIES_INCOME } from '../utils/categories-professional';
import { getMonthKey } from '../utils/data';
import { getCurrentFinancialMonth } from '../utils/financialMonth';
import { toast } from '../utils/toast';
import {
  isNetworkError, mergeSettingsPatch, getSettingsOverlay,
  hasSettingsOverlay, clearSettingsOverlay, remapSettingsTxIds,
} from '../lib/offlineQueue';

// Cores de fundo de cada paleta — usadas para atualizar <meta name="theme-color">
// e eliminar o artefacto de cor residual na zona do notch no iOS.
const PALETTE_BG = {
  midnight: '#0b0d10',
  dusk:     '#121008',
  stone:    '#e9e0d2',
};
const DEFAULT_BG = '#0b0d10'; // midnight — deve ser idêntico a PALETTE_BG.midnight

function applyPaletteToDOM(palette) {
  document.documentElement.setAttribute('data-palette', palette);
  document.documentElement.setAttribute('data-theme', palette === 'stone' ? 'light' : 'soft-future');
  // Atualizar theme-color para iOS (notch / status bar)
  const bg = PALETTE_BG[palette] ?? DEFAULT_BG;
  let meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = 'theme-color';
    document.head.appendChild(meta);
  }
  meta.content = bg;
}

/**
 * useSettings — responsável por TODAS as configurações do utilizador.
 *
 * Inclui:
 *  - Estado: patrimony, budgets, goals, recurring, confirmedRecurring,
 *            colorPalette, mainAccountId, financialMonth*,
 *            financialFocus, currentMonth
 *  - loadUserData(): fetch atómico de transações + settings (elimina race conditions)
 *  - Handlers para cada setting
 *
 * Recebe:
 *  - `currentUser` do useAuth
 *  - `txHook` do useTransactions (para inicializar transações durante o boot
 *    e para operações que criam/modificam transações, como confirmRecurring)
 */
export function useSettings(currentUser, txHook) {
  const [patrimony, setPatrimony] = useState({
    accounts: [], stocks: [], etfs: [], bonds: [], realestate: [], vehicles: [], crypto: [],
  });
  const [budgets, setBudgets] = useState({});
  const [colorPalette, setColorPaletteState] = useState(() => {
    const stored = localStorage.getItem('cosmos-palette') || 'midnight';
    // Migrate old theme names that no longer exist
    const VALID = ['midnight', 'dusk', 'stone'];
    return VALID.includes(stored) ? stored : 'midnight';
  });
  const [mainAccountId, setMainAccountId] = useState(null);
  const [financialMonthStartDay, setFinancialMonthStartDay] = useState(1);
  const [useFinancialMonth, setUseFinancialMonth] = useState(false);
  const [homeUsesFinancialMonth, setHomeUsesFinancialMonth] = useState(true);
  const [goals, setGoals] = useState([]);
  const [migrationPending, setMigrationPending] = useState(null); // { count, accName, accountId }
  const [recurringPayments, setRecurringPayments] = useState([]);
  const [confirmedRecurring, setConfirmedRecurring] = useState({});
  const [financialFocus, setFinancialFocus] = useState(null);
  const [financialProfile, setFinancialProfile] = useState(null);
  // Modo de utilização: 'manual' (lança à mão, recorrentes criam transações) ou
  // 'extrato' (importa extratos; recorrentes são previsão e casam com o import).
  // Default 'manual' = comportamento atual (não parte os utilizadores existentes).
  const [usageMode, setUsageMode] = useState('manual');
  const [currentMonth, setCurrentMonth] = useState(
    () => getMonthKey(new Date().toISOString())
  );
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [isOffline, setIsOffline] = useState(() => !navigator.onLine);

  const loadRequestId  = useRef(0);
  // Ref que aponta sempre para a versão mais recente de loadUserData.
  // Evita closures stale no handler `online` sem ter de re-registar os listeners.
  const loadUserDataRef = useRef(null);

  // Aplicar paleta ao <html> no primeiro render (antes de loadUserData)
  useEffect(() => {
    applyPaletteToDOM(colorPalette);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Detetar estado offline/online — quando volta online, recarrega dados automaticamente.
  // Usa loadUserDataRef para garantir que chama sempre a versão mais recente da função.
  useEffect(() => {
    const handleOffline = () => setIsOffline(true);
    const handleOnline  = () => {
      setIsOffline(false);
      loadUserDataRef.current?.(); // sempre chama a versão mais recente
    };
    window.addEventListener('offline', handleOffline);
    window.addEventListener('online',  handleOnline);
    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online',  handleOnline);
    };
  }, []); // sem deps — os listeners registam-se uma vez, o ref garante freshness

  // ── Boot atómico ──────────────────────────────────────────────────────────
  // Busca transações e settings em paralelo para eliminar a race condition
  // que existia quando os dois eram carregados em useEffect separados.
  const loadUserData = async () => {
    if (!currentUser) return;
    if (!navigator.onLine) {
      setIsOffline(true);
      toast.error('Sem ligação à internet. Os dados serão carregados quando voltares a ficar online.');
      return;
    }
    setIsOffline(false);

    // Empurra escritas offline pendentes ANTES de puxar do servidor — senão o
    // reload sobrepunha-se às transações/settings criadas sem rede.
    const remap = (await txHook.flushQueue?.().catch(() => ({}))) || {};
    if (hasSettingsOverlay()) {
      remapSettingsTxIds(remap); // tempId → realId em confirmed_recurring
      try {
        await dbService.updateUserSettings(currentUser.id, getSettingsOverlay());
        clearSettingsOverlay();
      } catch { /* ainda offline/erro — mantém a overlay para a próxima */ }
    }

    const requestId = ++loadRequestId.current;
    setIsLoadingData(true);

    try {
      const [txData, settings] = await Promise.all([
        dbService.getTransactions(currentUser.id).catch(() => []),
        dbService.getUserSettings(currentUser.id).catch(() => ({})),
      ]);
      if (requestId !== loadRequestId.current) return; // fetch superseded

      // account_id/account_name vêm agora das colunas reais (migração 001).
      const rows = (txData || []).map(t => ({ ...t, type: t.type || 'expense' }));

      // Inicializar o estado de transações via txHook
      const savedCategories = settings?.custom_categories;
      txHook.initFromLoad({
        rows,
        learnedRulesData: settings?.learned_rules || null,
        categoriesData: savedCategories
          ? {
              expense: Array.isArray(savedCategories.expense) ? savedCategories.expense : CATEGORIES_EXPENSE,
              income:  Array.isArray(savedCategories.income)  ? savedCategories.income  : CATEGORIES_INCOME,
            }
          : null,
      });

      // Aplicar settings
      if (settings?.patrimony)        setPatrimony(settings.patrimony);
      if (settings?.category_budgets) setBudgets(settings.category_budgets);
      if (settings?.financial_focus)  setFinancialFocus(settings.financial_focus);
      if (settings?.financial_profile) setFinancialProfile(settings.financial_profile);
      if (settings?.usage_mode) setUsageMode(settings.usage_mode);
      if (Array.isArray(settings?.goals)) setGoals(settings.goals);

      const mid = settings?.mainAccountId ?? settings?.defaultTransactionAccount?.id ?? null;
      if (mid) setMainAccountId(mid);

      if (Array.isArray(settings?.recurring_payments)) setRecurringPayments(settings.recurring_payments);
      if (settings?.confirmed_recurring && typeof settings.confirmed_recurring === 'object') {
        setConfirmedRecurring(settings.confirmed_recurring);
      }

      // Paleta de cor — aplica ao DOM (inclui theme-color do notch iOS)
      const VALID_PALETTES = ['midnight', 'dusk', 'stone'];
      const rawPalette = settings?.color_palette || colorPalette;
      const currentPalette = VALID_PALETTES.includes(rawPalette) ? rawPalette : 'midnight';
      applyPaletteToDOM(currentPalette);
      if (settings?.color_palette) {
        setColorPaletteState(currentPalette);
        localStorage.setItem('cosmos-palette', currentPalette);
      }

      // Mês financeiro
      const sd  = settings?.financialMonthStartDay ?? 1;
      const ufm = settings?.useFinancialMonth      ?? false;
      const hufm = settings?.homeUsesFinancialMonth ?? true;
      setFinancialMonthStartDay(sd);
      setUseFinancialMonth(ufm);
      setHomeUsesFinancialMonth(hufm);
      setCurrentMonth(getCurrentFinancialMonth(ufm ? sd : 1));

    } catch (error) {
      console.error('❌ Error loading user data:', error);
      toast.error('Erro ao carregar dados. Tenta recarregar a página.');
    } finally {
      setIsLoadingData(false);
    }
  };
  // Manter o ref sempre actualizado com a versão mais recente de loadUserData
  loadUserDataRef.current = loadUserData;

  // Cancelar fetches pendentes quando o utilizador fizer logout
  const resetForLogout = () => {
    loadRequestId.current++;
    setPatrimony({ accounts: [], stocks: [], etfs: [], bonds: [], realestate: [], vehicles: [], crypto: [] });
    setBudgets({});
    setGoals([]);
    setMainAccountId(null);
    setRecurringPayments([]);
    setConfirmedRecurring({});
    setFinancialFocus(null);
    setFinancialProfile(null);
    setUsageMode('manual');
    setFinancialMonthStartDay(1);
    setUseFinancialMonth(false);
    setHomeUsesFinancialMonth(true);
    setCurrentMonth(getMonthKey(new Date().toISOString()));
  };

  // Persiste um patch de user_settings; offline (ou falha de rede) acumula numa
  // overlay que é empurrada na reconexão, ANTES do reload (ver loadUserData).
  const persistSettings = useCallback((patch) => {
    if (!currentUser?.id) return;
    if (!navigator.onLine) { mergeSettingsPatch(patch); return; }
    dbService.updateUserSettings(currentUser.id, patch).catch((e) => {
      if (isNetworkError(e)) mergeSettingsPatch(patch);
      else toast.error('Erro ao guardar: ' + e.message);
    });
  }, [currentUser]);

  // ── Paleta ────────────────────────────────────────────────────────────────
  const setColorPalette = useCallback((palette) => {
    setColorPaletteState(palette);
    applyPaletteToDOM(palette);
    localStorage.setItem('cosmos-palette', palette);
    persistSettings({ color_palette: palette });
  }, [persistSettings]);

  // ── Patrimony ─────────────────────────────────────────────────────────────
  const handlePatrimonyChange = (newPatrimony) => {
    setPatrimony(newPatrimony);
    persistSettings({ patrimony: newPatrimony });
  };

  // Muda a conta principal. Se houver transações sem conta associada, guarda o
  // estado em `migrationPending` para que o ProfileTab mostre um modal de confirmação
  // (substitui o window.confirm bloqueante).
  const handleMainAccountChange = async (accountId) => {
    setMainAccountId(accountId);
    persistSettings({ mainAccountId: accountId });

    if (!accountId) return;
    const acc = (patrimony.accounts || []).find(a => a.id === accountId);
    if (!acc) return;

    const unlinked = (txHook.transactions || []).filter(t => !t.account_id && t.type !== 'transfer');
    if (unlinked.length === 0) return;

    // Pedir confirmação via modal — não bloquear com window.confirm
    setMigrationPending({ count: unlinked.length, accName: acc.name, accountId });
  };

  // Executar a migração depois do utilizador confirmar no modal.
  const handleMigrateConfirm = async () => {
    if (!migrationPending) return;
    const { accountId } = migrationPending;
    const acc = (patrimony.accounts || []).find(a => a.id === accountId);
    if (!acc) { setMigrationPending(null); return; }

    setMigrationPending(null);

    try {
      // dbCount is the source of truth — it's what the DB actually updated
      const dbCount = await dbService.migrateUnlinkedTransactions(currentUser.id, acc.id, acc.name);

      txHook.setTransactions(prev => prev.map(t =>
        (!t.account_id && t.type !== 'transfer')
          ? { ...t, account_id: acc.id, account_name: acc.name }
          : t
      ));
      toast.success?.(`${dbCount} transação(ões) ligadas a "${acc.name}".`);
    } catch (err) {
      console.error('❌ Migration failed:', err);
      toast.error('Erro na migração: ' + err.message);
    }
  };

  const handleMigrateDismiss = () => setMigrationPending(null);

  // ── Orçamentos ────────────────────────────────────────────────────────────
  const handleBudgetsChange = (newBudgets) => {
    setBudgets(newBudgets);
    persistSettings({ category_budgets: newBudgets });
  };

  // ── Mês financeiro ────────────────────────────────────────────────────────
  const handleFinancialMonthChange = ({ startDay, enabled }) => {
    const sd = Math.min(28, Math.max(1, startDay));
    setFinancialMonthStartDay(sd);
    setUseFinancialMonth(enabled);
    setCurrentMonth(getCurrentFinancialMonth(enabled ? sd : 1));
    persistSettings({ financialMonthStartDay: sd, useFinancialMonth: enabled });
  };

  const handleHomeUsesFinancialMonthChange = (enabled) => {
    setHomeUsesFinancialMonth(enabled);
    persistSettings({ homeUsesFinancialMonth: enabled });
  };

  // ── Recorrentes ───────────────────────────────────────────────────────────
  const handleRecurringPaymentsChange = (updated) => {
    setRecurringPayments(updated);
    persistSettings({ recurring_payments: updated });
  };

  // Confirma um pagamento recorrente: cria a transação (com suporte offline via
  // txHook.handleAddTransaction) e regista a confirmação. Se offline, a transação
  // fica com id temporário; o flush reconcilia-o e o remap corrige o
  // transactionId guardado aqui (ver loadUserData / remapSettingsTxIds).
  const handleConfirmRecurring = async ({ recurringPayment, dueDate, monthKey, amount, accountId }) => {
    const account = (patrimony.accounts || []).find(a => a.id === accountId);
    let newTx;
    try {
      newTx = await txHook.handleAddTransaction({
        date:         dueDate,
        description:  recurringPayment.title,
        amount,
        type:         'expense',
        category:     recurringPayment.categoryId || 'Outros',
        account_id:   accountId   || null,
        account_name: account?.name || null,
      });
    } catch (e) {
      toast.error('Erro ao confirmar pagamento: ' + e.message);
      return;
    }
    if (!newTx) return;

    const updated = {
      ...confirmedRecurring,
      [recurringPayment.id]: {
        ...(confirmedRecurring[recurringPayment.id] || {}),
        // source 'created' → esta transação foi criada por nós (apagável no restore).
        [monthKey]: { transactionId: newTx.id, amount, confirmedAt: new Date().toISOString(), source: 'created' },
      },
    };
    setConfirmedRecurring(updated);
    persistSettings({ confirmed_recurring: updated });
  };

  // Associa uma ocorrência prevista a uma transação JÁ existente (importada/manual)
  // — modo extrato. NÃO cria transação nova (evita duplicação). source 'matched'.
  const handleLinkRecurring = ({ recurringPayment, monthKey, transactionId, amount }) => {
    if (!recurringPayment || !monthKey || !transactionId) return;
    const updated = {
      ...confirmedRecurring,
      [recurringPayment.id]: {
        ...(confirmedRecurring[recurringPayment.id] || {}),
        [monthKey]: { transactionId, amount, confirmedAt: new Date().toISOString(), source: 'matched' },
      },
    };
    setConfirmedRecurring(updated);
    persistSettings({ confirmed_recurring: updated });
  };

  // Apaga um pagamento recorrente E as transações já confirmadas que ele criou,
  // repondo o saldo na conta. Limpa também as confirmações desse recorrente.
  const handleDeleteRecurring = async (id, { restore = true } = {}) => {
    const conf = confirmedRecurring[id] || {};
    // restore=true → apaga as transações que NÓS criámos (source 'created' ou
    // legacy sem source). NUNCA apaga transações importadas/associadas ('matched').
    const txIds = restore
      ? Object.values(conf).filter(c => c && c.transactionId && c.source !== 'matched').map(c => c.transactionId)
      : [];

    // Apaga via txHook (lida com online/offline e ids temporários ainda na fila).
    await Promise.all(txIds.map(txId => txHook.handleDeleteTransaction(txId).catch(() => {})));

    const updatedConf = { ...confirmedRecurring };
    delete updatedConf[id];
    setConfirmedRecurring(updatedConf);

    const updatedPayments = (recurringPayments || []).filter(p => p.id !== id);
    setRecurringPayments(updatedPayments);

    persistSettings({ confirmed_recurring: updatedConf, recurring_payments: updatedPayments });

    if (txIds.length > 0) toast.success?.(`Recorrente removido · ${txIds.length} pagamento(s) repostos.`);
  };

  // Dispensa uma ocorrência pendente sem criar transação (marca o mês como
  // tratado para sair de "aguardam confirmação"). Reversível por re-confirmação.
  const handleSkipRecurring = ({ recurringPayment, monthKey }) => {
    if (!recurringPayment || !monthKey) return;
    const updated = {
      ...confirmedRecurring,
      [recurringPayment.id]: {
        ...(confirmedRecurring[recurringPayment.id] || {}),
        [monthKey]: { skipped: true, at: new Date().toISOString() },
      },
    };
    setConfirmedRecurring(updated);
    persistSettings({ confirmed_recurring: updated });
  };

  // ── Objetivos ─────────────────────────────────────────────────────────────
  const handleGoalsChange = (updatedGoals) => {
    setGoals(updatedGoals);
    persistSettings({ goals: updatedGoals });
  };

  // ── Focus financeiro ──────────────────────────────────────────────────────
  const handleFocusChange = (focus) => {
    setFinancialFocus(focus);
    persistSettings({ financial_focus: focus });
  };

  // ── Perfil financeiro (questionário que personaliza a análise) ─────────────
  const handleProfileChange = (profile) => {
    setFinancialProfile(profile);
    persistSettings({ financial_profile: profile });
  };

  // ── Modo de utilização (extrato vs manual) ─────────────────────────────────
  const handleUsageModeChange = (mode) => {
    setUsageMode(mode);
    persistSettings({ usage_mode: mode });
  };

  return {
    // Estado
    patrimony, setPatrimony,
    budgets,
    goals,
    migrationPending,
    colorPalette, setColorPalette,
    mainAccountId,
    financialMonthStartDay,
    useFinancialMonth,
    homeUsesFinancialMonth,
    recurringPayments,
    confirmedRecurring,
    financialFocus,
    financialProfile,
    usageMode,
    currentMonth, setCurrentMonth,
    isLoadingData,
    isOffline,
    // Boot
    loadUserData,
    resetForLogout,
    // Handlers
    handlePatrimonyChange,
    handleMainAccountChange,
    handleMigrateConfirm,
    handleMigrateDismiss,
    handleBudgetsChange,
    handleFinancialMonthChange,
    handleHomeUsesFinancialMonthChange,
    handleRecurringPaymentsChange,
    handleConfirmRecurring,
    handleLinkRecurring,
    handleDeleteRecurring,
    handleSkipRecurring,
    handleGoalsChange,
    handleFocusChange,
    handleProfileChange,
    handleUsageModeChange,
  };
}
