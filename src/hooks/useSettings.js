import { useState, useEffect, useCallback, useRef } from 'react';
import { dbService } from '../lib/supabase';
import { CATEGORIES_EXPENSE, CATEGORIES_INCOME } from '../utils/categories-professional';
import { getMonthKey } from '../utils/data';
import { getCurrentFinancialMonth } from '../utils/financialMonth';
import { toast } from '../utils/toast';

// Cores de fundo de cada paleta — usadas para atualizar <meta name="theme-color">
// e eliminar o artefacto de cor residual na zona do notch no iOS.
const PALETTE_BG = {
  midnight: '#0b0d10',
  dusk:     '#121008',
  stone:    '#f0ebe4',
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
    const requestId = ++loadRequestId.current;
    setIsLoadingData(true);

    try {
      const [txData, settings] = await Promise.all([
        dbService.getTransactions(currentUser.id).catch(() => []),
        dbService.getUserSettings(currentUser.id).catch(() => ({})),
      ]);
      if (requestId !== loadRequestId.current) return; // fetch superseded

      // Fundir o transactionAccountMap (fallback para colunas ausentes no DB)
      const accountMap = settings?.transactionAccountMap || {};
      const rows = (txData || []).map(t => ({
        ...t,
        type: t.type || 'expense',
        account_id:   t.account_id   || accountMap[t.id]?.account_id   || null,
        account_name: t.account_name || accountMap[t.id]?.account_name || null,
      }));

      // Inicializar o estado de transações via txHook
      const savedCategories = settings?.custom_categories;
      txHook.initFromLoad({
        rows,
        accountMap,
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
    setFinancialMonthStartDay(1);
    setUseFinancialMonth(false);
    setHomeUsesFinancialMonth(true);
    setCurrentMonth(getMonthKey(new Date().toISOString()));
  };

  // ── Paleta ────────────────────────────────────────────────────────────────
  const setColorPalette = useCallback((palette) => {
    setColorPaletteState(palette);
    applyPaletteToDOM(palette);
    localStorage.setItem('cosmos-palette', palette);
    if (currentUser?.id) {
      dbService.updateUserSettings(currentUser.id, { color_palette: palette }).catch(e => toast.error('Erro ao guardar paleta: ' + e.message));
    }
  }, [currentUser]);

  // ── Patrimony ─────────────────────────────────────────────────────────────
  const handlePatrimonyChange = async (newPatrimony) => {
    setPatrimony(newPatrimony);
    try {
      await dbService.updateUserSettings(currentUser.id, { patrimony: newPatrimony });
    } catch (error) {
      console.error('Error saving patrimony:', error);
      toast.error('Erro ao guardar património.');
    }
  };

  // Muda a conta principal. Se houver transações sem conta associada, guarda o
  // estado em `migrationPending` para que o ProfileTab mostre um modal de confirmação
  // (substitui o window.confirm bloqueante).
  const handleMainAccountChange = async (accountId) => {
    setMainAccountId(accountId);
    dbService.updateUserSettings(currentUser.id, { mainAccountId: accountId }).catch(e => toast.error('Erro ao guardar: ' + e.message));

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

    const unlinked = (txHook.transactions || []).filter(t => !t.account_id && t.type !== 'transfer');
    setMigrationPending(null);

    try {
      // dbCount is the source of truth — it's what the DB actually updated
      const dbCount = await dbService.migrateUnlinkedTransactions(currentUser.id, acc.id, acc.name);

      txHook.setTransactions(prev => prev.map(t =>
        (!t.account_id && t.type !== 'transfer')
          ? { ...t, account_id: acc.id, account_name: acc.name }
          : t
      ));

      const updatedMap = { ...txHook.transactionAccountMap };
      unlinked.forEach(t => {
        updatedMap[t.id] = { account_id: acc.id, account_name: acc.name };
      });
      txHook.setTransactionAccountMap(updatedMap);
      dbService.updateUserSettings(currentUser.id, { transactionAccountMap: updatedMap }).catch(e => toast.error('Erro ao guardar: ' + e.message));
      toast.success?.(`${dbCount} transação(ões) ligadas a "${acc.name}".`);
    } catch (err) {
      console.error('❌ Migration failed:', err);
      toast.error('Erro na migração: ' + err.message);
    }
  };

  const handleMigrateDismiss = () => setMigrationPending(null);

  // ── Orçamentos ────────────────────────────────────────────────────────────
  const handleBudgetsChange = async (newBudgets) => {
    setBudgets(newBudgets);
    try {
      await dbService.updateUserSettings(currentUser.id, { category_budgets: newBudgets });
    } catch (error) {
      console.error('Error saving budgets:', error);
      toast.error('Erro ao guardar orçamento.');
    }
  };

  // ── Mês financeiro ────────────────────────────────────────────────────────
  const handleFinancialMonthChange = ({ startDay, enabled }) => {
    const sd = Math.min(28, Math.max(1, startDay));
    setFinancialMonthStartDay(sd);
    setUseFinancialMonth(enabled);
    setCurrentMonth(getCurrentFinancialMonth(enabled ? sd : 1));
    dbService.updateUserSettings(currentUser.id, {
      financialMonthStartDay: sd,
      useFinancialMonth: enabled,
    }).catch(e => toast.error('Erro ao guardar: ' + e.message));
  };

  const handleHomeUsesFinancialMonthChange = (enabled) => {
    setHomeUsesFinancialMonth(enabled);
    dbService.updateUserSettings(currentUser.id, { homeUsesFinancialMonth: enabled }).catch(e => toast.error('Erro ao guardar: ' + e.message));
  };

  // ── Recorrentes ───────────────────────────────────────────────────────────
  const handleRecurringPaymentsChange = (updated) => {
    setRecurringPayments(updated);
    dbService.updateUserSettings(currentUser.id, { recurring_payments: updated })
      .catch(e => toast.error('Erro ao guardar recorrentes: ' + e.message));
  };

  // Confirma um pagamento recorrente: cria a transação real e regista a confirmação.
  // Usa txHook.setTransactions para adicionar a nova transação ao estado global.
  const handleConfirmRecurring = async ({ recurringPayment, dueDate, monthKey, amount, accountId }) => {
    const account = (patrimony.accounts || []).find(a => a.id === accountId);
    let newTx;
    try {
      newTx = await dbService.addTransaction(currentUser.id, {
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

    const txWithAccount = {
      ...newTx,
      account_id:   newTx.account_id   ?? accountId   ?? null,
      account_name: newTx.account_name ?? account?.name ?? null,
    };
    txHook.setTransactions(prev => [txWithAccount, ...prev]);

    const updated = {
      ...confirmedRecurring,
      [recurringPayment.id]: {
        ...(confirmedRecurring[recurringPayment.id] || {}),
        [monthKey]: { transactionId: newTx.id, amount, confirmedAt: new Date().toISOString() },
      },
    };
    setConfirmedRecurring(updated);

    // Merge ambos os saves num só para evitar race condition (READ→merge→WRITE concorrente)
    const settingsUpdate = { confirmed_recurring: updated };
    if (accountId && newTx.id) {
      const updatedMap = {
        ...txHook.transactionAccountMap,
        [newTx.id]: { account_id: accountId, account_name: account?.name || null },
      };
      txHook.setTransactionAccountMap(updatedMap);
      settingsUpdate.transactionAccountMap = updatedMap;
    }
    dbService.updateUserSettings(currentUser.id, settingsUpdate).catch(e => toast.error('Erro ao guardar: ' + e.message));
  };

  // Apaga um pagamento recorrente E as transações já confirmadas que ele criou,
  // repondo o saldo na conta. Limpa também as confirmações desse recorrente.
  const handleDeleteRecurring = async (id, { restore = true } = {}) => {
    const conf = confirmedRecurring[id] || {};
    // restore=true → apaga as transações lançadas (repõe o saldo).
    // restore=false → mantém as transações, remove só o agendamento.
    const txIds = restore ? Object.values(conf).map(c => c && c.transactionId).filter(Boolean) : [];

    // Apaga as transações no DB em paralelo e atualiza o estado UMA vez
    // (em vez de N escritas de settings, uma por transação).
    await Promise.all(txIds.map(txId => dbService.deleteTransaction(txId).catch(() => {})));
    if (txIds.length) {
      const idset = new Set(txIds);
      txHook.setTransactions(prev => prev.filter(t => !idset.has(t.id)));
    }
    const updatedMap = { ...txHook.transactionAccountMap };
    txIds.forEach(txId => delete updatedMap[txId]);
    txHook.setTransactionAccountMap(updatedMap);

    const updatedConf = { ...confirmedRecurring };
    delete updatedConf[id];
    setConfirmedRecurring(updatedConf);

    const updatedPayments = (recurringPayments || []).filter(p => p.id !== id);
    setRecurringPayments(updatedPayments);

    // UM único save com tudo (mapa de contas + confirmações + recorrentes)
    dbService.updateUserSettings(currentUser.id, {
      transactionAccountMap: updatedMap,
      confirmed_recurring:   updatedConf,
      recurring_payments:    updatedPayments,
    }).catch(e => toast.error('Erro ao guardar: ' + e.message));

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
    dbService.updateUserSettings(currentUser.id, { confirmed_recurring: updated })
      .catch(e => toast.error('Erro ao guardar: ' + e.message));
  };

  // ── Objetivos ─────────────────────────────────────────────────────────────
  const handleGoalsChange = async (updatedGoals) => {
    setGoals(updatedGoals);
    try {
      await dbService.updateUserSettings(currentUser.id, { goals: updatedGoals });
    } catch (error) {
      console.error('Error saving goals:', error);
      toast.error('Erro ao guardar objetivos.');
    }
  };

  // ── Focus financeiro ──────────────────────────────────────────────────────
  const handleFocusChange = (focus) => {
    setFinancialFocus(focus);
    dbService.updateUserSettings(currentUser.id, { financial_focus: focus }).catch(e => toast.error('Erro ao guardar: ' + e.message));
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
    handleDeleteRecurring,
    handleSkipRecurring,
    handleGoalsChange,
    handleFocusChange,
  };
}
