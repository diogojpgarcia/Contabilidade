import { useState, useEffect, useCallback, useRef } from 'react';
import { dbService } from '../lib/supabase';
import { CATEGORIES_EXPENSE, CATEGORIES_INCOME } from '../utils/categories-professional';
import { getMonthKey } from '../utils/data';
import { getCurrentFinancialMonth } from '../utils/financialMonth';

/**
 * useSettings — responsável por TODAS as configurações do utilizador.
 *
 * Inclui:
 *  - Estado: patrimony, budgets, recurring, confirmedRecurring, theme,
 *            colorPalette, mainAccountId, financialMonth*, homePatrimonyView,
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
    accounts: [], stocks: [], bonds: [], realestate: [], vehicles: [], crypto: [],
  });
  const [homePatrimonyView, setHomePatrimonyView] = useState('total');
  const [budgets, setBudgets] = useState({});
  const [theme, setTheme] = useState('fintech');
  const [colorPalette, setColorPaletteState] = useState(
    () => localStorage.getItem('cosmos-palette') || 'midnight'
  );
  const [mainAccountId, setMainAccountId] = useState(null);
  const [financialMonthStartDay, setFinancialMonthStartDay] = useState(1);
  const [useFinancialMonth, setUseFinancialMonth] = useState(false);
  const [homeUsesFinancialMonth, setHomeUsesFinancialMonth] = useState(true);
  const [recurringPayments, setRecurringPayments] = useState([]);
  const [confirmedRecurring, setConfirmedRecurring] = useState({});
  const [financialFocus, setFinancialFocus] = useState(null);
  const [currentMonth, setCurrentMonth] = useState(
    () => getMonthKey(new Date().toISOString())
  );

  const loadRequestId = useRef(0);

  // Aplicar paleta ao <html> no primeiro render (antes de loadUserData)
  useEffect(() => {
    document.documentElement.setAttribute('data-palette', colorPalette);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Boot atómico ──────────────────────────────────────────────────────────
  // Busca transações e settings em paralelo para eliminar a race condition
  // que existia quando os dois eram carregados em useEffect separados.
  const loadUserData = async () => {
    if (!currentUser) return;
    const requestId = ++loadRequestId.current;

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
      if (settings?.homePatrimonyView) setHomePatrimonyView(settings.homePatrimonyView);
      if (settings?.category_budgets) setBudgets(settings.category_budgets);
      if (settings?.financial_focus)  setFinancialFocus(settings.financial_focus);

      const mid = settings?.mainAccountId ?? settings?.defaultTransactionAccount?.id ?? null;
      if (mid) setMainAccountId(mid);

      if (Array.isArray(settings?.recurring_payments)) setRecurringPayments(settings.recurring_payments);
      if (settings?.confirmed_recurring && typeof settings.confirmed_recurring === 'object') {
        setConfirmedRecurring(settings.confirmed_recurring);
      }

      // Cosmos é o único tema visual — forçar soft-future independentemente do valor guardado
      document.documentElement.setAttribute('data-theme', 'soft-future');

      // Paleta de cor
      if (settings?.color_palette) {
        setColorPaletteState(settings.color_palette);
        document.documentElement.setAttribute('data-palette', settings.color_palette);
        localStorage.setItem('cosmos-palette', settings.color_palette);
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
    }
  };

  // Cancelar fetches pendentes quando o utilizador fizer logout
  const resetForLogout = () => {
    loadRequestId.current++;
    setPatrimony({ accounts: [], stocks: [], bonds: [], realestate: [], vehicles: [], crypto: [] });
    setBudgets({});
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
    document.documentElement.setAttribute('data-palette', palette);
    localStorage.setItem('cosmos-palette', palette);
    if (currentUser?.id) {
      dbService.updateUserSettings(currentUser.id, { color_palette: palette }).catch(console.error);
    }
  }, [currentUser]);

  // ── Patrimony ─────────────────────────────────────────────────────────────
  const handlePatrimonyChange = async (newPatrimony) => {
    setPatrimony(newPatrimony);
    try {
      await dbService.updateUserSettings(currentUser.id, { patrimony: newPatrimony });
    } catch (error) {
      console.error('Error saving patrimony:', error);
    }
  };

  const handlePatrimonyViewChange = async (view) => {
    setHomePatrimonyView(view);
    try {
      await dbService.updateUserSettings(currentUser.id, { homePatrimonyView: view });
    } catch (error) {
      console.error('Error saving patrimony view:', error);
    }
  };

  // Muda a conta principal e, opcionalmente, migra transações sem conta associada.
  // Precisa de txHook.transactions e txHook.setTransactions para a migração.
  const handleMainAccountChange = async (accountId) => {
    setMainAccountId(accountId);
    dbService.updateUserSettings(currentUser.id, { mainAccountId: accountId }).catch(console.error);

    if (!accountId) return;
    const acc = (patrimony.accounts || []).find(a => a.id === accountId);
    if (!acc) return;

    const unlinked = txHook.transactions.filter(t => !t.account_id && t.type !== 'transfer');
    if (unlinked.length === 0) return;

    const confirmed = window.confirm(
      `${unlinked.length} transação(ões) sem conta associada.\n\nAplicar "${acc.name}" a estas transações antigas?`
    );
    if (!confirmed) return;

    try {
      await dbService.migrateUnlinkedTransactions(currentUser.id, acc.id, acc.name);

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
      dbService.updateUserSettings(currentUser.id, { transactionAccountMap: updatedMap }).catch(console.error);
    } catch (err) {
      console.error('❌ Migration failed:', err);
      alert('Erro na migração: ' + err.message);
    }
  };

  // ── Orçamentos ────────────────────────────────────────────────────────────
  const handleBudgetsChange = async (newBudgets) => {
    setBudgets(newBudgets);
    try {
      await dbService.updateUserSettings(currentUser.id, { category_budgets: newBudgets });
    } catch (error) {
      console.error('Error saving budgets:', error);
      alert('Erro ao guardar orçamento');
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
    }).catch(console.error);
  };

  const handleHomeUsesFinancialMonthChange = (enabled) => {
    setHomeUsesFinancialMonth(enabled);
    dbService.updateUserSettings(currentUser.id, { homeUsesFinancialMonth: enabled });
  };

  // ── Recorrentes ───────────────────────────────────────────────────────────
  const handleRecurringPaymentsChange = (updated) => {
    setRecurringPayments(updated);
    // A persistência é feita dentro do RecurringView para dar feedback imediato
  };

  // Confirma um pagamento recorrente: cria a transação real e regista a confirmação.
  // Usa txHook.setTransactions para adicionar a nova transação ao estado global.
  const handleConfirmRecurring = async ({ recurringPayment, dueDate, monthKey, amount, accountId }) => {
    const account = patrimony.accounts.find(a => a.id === accountId);
    const newTx = await dbService.addTransaction(currentUser.id, {
      date:         dueDate,
      description:  recurringPayment.title,
      amount,
      type:         'expense',
      category:     recurringPayment.categoryId || 'Outros',
      account_id:   accountId   || null,
      account_name: account?.name || null,
    });

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
    dbService.updateUserSettings(currentUser.id, { confirmed_recurring: updated }).catch(console.error);

    if (accountId && newTx.id) {
      const updatedMap = {
        ...txHook.transactionAccountMap,
        [newTx.id]: { account_id: accountId, account_name: account?.name || null },
      };
      txHook.setTransactionAccountMap(updatedMap);
      dbService.updateUserSettings(currentUser.id, { transactionAccountMap: updatedMap }).catch(console.error);
    }
  };

  // ── Focus financeiro ──────────────────────────────────────────────────────
  const handleFocusChange = (focus) => {
    setFinancialFocus(focus);
    dbService.updateUserSettings(currentUser.id, { financial_focus: focus }).catch(console.error);
  };

  return {
    // Estado
    patrimony, setPatrimony,
    homePatrimonyView,
    budgets,
    theme, setTheme,
    colorPalette, setColorPalette,
    mainAccountId,
    financialMonthStartDay,
    useFinancialMonth,
    homeUsesFinancialMonth,
    recurringPayments,
    confirmedRecurring,
    financialFocus,
    currentMonth, setCurrentMonth,
    // Boot
    loadUserData,
    resetForLogout,
    // Handlers
    handlePatrimonyChange,
    handlePatrimonyViewChange,
    handleMainAccountChange,
    handleBudgetsChange,
    handleFinancialMonthChange,
    handleHomeUsesFinancialMonthChange,
    handleRecurringPaymentsChange,
    handleConfirmRecurring,
    handleFocusChange,
  };
}
