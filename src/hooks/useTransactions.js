import { useState, useRef, useCallback } from 'react';
import { dbService } from '../lib/supabase';
import { toast } from '../utils/toast';
import { CATEGORIES_EXPENSE, CATEGORIES_INCOME } from '../utils/categories-professional';
import { computeAccountBalance } from '../utils/budgetUtils';
import { tokensOf, derivePattern, descMatchesPattern } from '../utils/textMatch';
import { validateTransaction } from '../utils/validateTransaction';
import {
  newTempId, isTempId, enqueueAdd, enqueueUpdate, enqueueDelete,
  amendQueuedAdd, removeQueuedAdd, removeEntry, getAll as getQueue, size as queueSize,
  isNetworkError,
} from '../lib/offlineQueue';

const isOffline = () => typeof navigator !== 'undefined' && !navigator.onLine;

/**
 * useTransactions — responsável por TODA a lógica de transações.
 *
 * Inclui:
 *  - Estado: transactions, learnedRules, bulkPending, categories
 *  - CRUD: add, edit, delete, import, transfer
 *  - Categorização: handleCategoryChange, bulk update, learned rules
 *  - Contas: handleAccountChange
 *  - initFromLoad(): chamado pelo useSettings após o boot atómico
 *
 * Recebe `currentUser` como parâmetro (vem do useAuth).
 */
export function useTransactions(currentUser) {
  const [transactions, setTransactions] = useState([]);
  const [learnedRules, setLearnedRules] = useState([]);
  const [bulkPending, setBulkPending] = useState(null);
  const [pendingCount, setPendingCount] = useState(() => queueSize());
  const [categories, setCategories] = useState({
    expense: CATEGORIES_EXPENSE,
    income: CATEGORIES_INCOME,
  });
  const loadRequestId = useRef(0);

  // ── Boot ──────────────────────────────────────────────────────────────────
  // Chamado pelo useSettings.loadUserData depois de ter os dados do servidor.
  const initFromLoad = ({ rows, learnedRulesData, categoriesData }) => {
    setTransactions(rows || []);
    if (learnedRulesData) setLearnedRules(learnedRulesData);
    if (categoriesData) setCategories(categoriesData);
  };

  // Recarrega só transações (sem re-aplicar settings) — usado após delete/import.
  const loadUserTransactions = async () => {
    if (!currentUser) return;
    const requestId = ++loadRequestId.current;
    try {
      const txData = await dbService.getTransactions(currentUser.id).catch(() => []);
      if (requestId !== loadRequestId.current) return;
      // account_id/account_name vêm agora das colunas reais (migração 001).
      const rows = (txData || []).map(t => ({ ...t, type: t.type || 'expense' }));
      setTransactions(rows);
    } catch (error) {
      console.error('❌ Error loading transactions:', error);
    }
  };

  // ── CRUD ──────────────────────────────────────────────────────────────────

  const refreshPending = () => setPendingCount(queueSize());

  const handleAddTransaction = async (transaction, mainAccountId, patrimonyAccounts) => {
    const accId   = transaction.account_id || mainAccountId || null;
    const accName = transaction.account_name
      || (accId ? (patrimonyAccounts || []).find(a => a.id === accId)?.name || null : null);
    // Rede de segurança: normaliza/valida (amount finito, data válida) antes de
    // tocar no estado ou na BD. Lança em dados inutilizáveis (apanhado a montante).
    const enriched = validateTransaction({ ...transaction, account_id: accId, account_name: accName });

    // Sem rede → cria com id temporário, otimista, e enfileira para sincronizar.
    const queueLocally = () => {
      const tempId = newTempId();
      const optimistic = {
        ...enriched,
        id: tempId,
        amount: parseFloat(enriched.amount) || 0,
        type: enriched.type || 'expense',
        _pending: true,
      };
      setTransactions(prev => [optimistic, ...prev]);
      enqueueAdd(enriched, tempId);
      refreshPending();
      return optimistic;
    };

    if (isOffline()) return queueLocally();

    try {
      const newTx = await dbService.addTransaction(currentUser.id, enriched);
      const txWithAccount = {
        ...newTx,
        account_id:   newTx.account_id   || accId   || null,
        account_name: newTx.account_name || accName || null,
      };
      setTransactions(prev => [txWithAccount, ...prev]);
      return txWithAccount;
    } catch (error) {
      if (isNetworkError(error)) return queueLocally();
      console.error('❌ Error adding transaction:', error);
      throw error;
    }
  };

  const handleDeleteTransaction = async (id) => {
    // Transação ainda pendente (offline) → cancela a criação enfileirada.
    if (isTempId(id)) {
      removeQueuedAdd(id);
      setTransactions(prev => prev.filter(t => t.id !== id));
      refreshPending();
      return;
    }

    const removeLocally = () => {
      enqueueDelete(id);
      setTransactions(prev => prev.filter(t => t.id !== id));
      refreshPending();
    };

    if (isOffline()) return removeLocally();

    try {
      await dbService.deleteTransaction(id);
      setTransactions(prev => prev.filter(t => t.id !== id));
    } catch (error) {
      if (isNetworkError(error)) return removeLocally();
      console.error('❌ Error deleting transaction:', error);
      throw error;
    }
  };

  const handleEditTransaction = async (updatedTransaction) => {
    // Rede de segurança: valida/normaliza (lança em valor/data inválidos).
    const clean = validateTransaction(updatedTransaction);
    const original = transactions.find(t => t.id === clean.id);
    const fields = {
      amount:       clean.amount,
      type:         clean.type,
      category:     clean.category,
      subcategory:  clean.subcategory || null,
      description:  clean.description || '',
      date:         clean.date,
      account_id:   clean.account_id   || null,
      account_name: clean.account_name || null,
    };

    // Optimistic update
    setTransactions(prev => prev.map(t =>
      t.id === clean.id ? { ...t, ...clean } : t
    ));

    // Editar uma transação ainda pendente → altera a própria entrada `add`
    // (mantém o invariante: a fila nunca tem update/delete com id temporário).
    if (isTempId(updatedTransaction.id)) {
      amendQueuedAdd(updatedTransaction.id, fields);
      refreshPending();
      return;
    }

    const queueLocally = () => {
      enqueueUpdate(updatedTransaction.id, fields);
      setTransactions(prev => prev.map(t => t.id === updatedTransaction.id ? { ...t, _pending: true } : t));
      refreshPending();
    };

    if (isOffline()) return queueLocally();

    try {
      const updated = await dbService.updateTransaction(updatedTransaction.id, fields);
      const merged = {
        ...updated,
        account_id:   updatedTransaction.account_id   ?? updated.account_id   ?? null,
        account_name: updatedTransaction.account_name ?? updated.account_name ?? null,
      };
      setTransactions(prev => prev.map(t => t.id === merged.id ? merged : t));
    } catch (error) {
      if (isNetworkError(error)) return queueLocally();
      console.error('❌ Error updating transaction:', error);
      if (original) setTransactions(prev => prev.map(t => t.id === updatedTransaction.id ? original : t));
      throw error;
    }
  };

  // Reproduz a fila offline contra o Supabase, por ordem. Chamado no boot e na
  // reconexão (ANTES de recarregar do servidor, senão o reload perdia as
  // escritas offline). Para no primeiro erro de rede e tenta de novo depois.
  // Devolve o remap { tempId: realId } das criações reconciliadas, para que o
  // chamador corrija referências (ex. transactionId em confirmed_recurring).
  const flushQueue = async () => {
    const remap = {};
    if (!currentUser || isOffline()) return remap;

    for (const entry of getQueue()) {
      try {
        if (entry.kind === 'add') {
          const tx = entry.payload.transaction;
          const saved = await dbService.addTransaction(currentUser.id, tx);
          const reconciled = {
            ...saved,
            account_id:   saved.account_id   ?? tx.account_id   ?? null,
            account_name: saved.account_name ?? tx.account_name ?? null,
          };
          remap[entry.payload.tempId] = saved.id;
          setTransactions(prev => prev.some(t => t.id === entry.payload.tempId)
            ? prev.map(t => t.id === entry.payload.tempId ? reconciled : t)
            : [reconciled, ...prev]);
        } else if (entry.kind === 'update') {
          await dbService.updateTransaction(entry.payload.id, entry.payload.updates);
          setTransactions(prev => prev.map(t => t.id === entry.payload.id ? { ...t, _pending: false } : t));
        } else if (entry.kind === 'delete') {
          await dbService.deleteTransaction(entry.payload.id);
        }
        removeEntry(entry.id);
        refreshPending();
      } catch (error) {
        if (isNetworkError(error)) break; // ainda offline — mantém o resto
        // Erro real (validação/RLS): descarta para não bloquear a fila.
        console.error('[offlineQueue] mutação descartada após erro:', entry, error);
        removeEntry(entry.id);
        refreshPending();
      }
    }
    return remap;
  };

  // Chamado pelo ImportTab depois de guardar no DB.
  const handleImport = (savedTransactions, fallbackReload) => {
    if (savedTransactions?.length) {
      setTransactions(prev => [...savedTransactions, ...prev]);
    } else if (fallbackReload) {
      fallbackReload();
    } else {
      loadUserTransactions();
    }
  };

  // Cria o par de transações de transferência (saída + entrada).
  // Recebe `patrimonyAccounts` para resolver nomes a partir dos IDs.
  const handleTransfer = async (fromId, toId, amount, patrimonyAccounts) => {
    const value = parseFloat(amount);
    if (!value || value <= 0) return;
    const today = new Date().toISOString().split('T')[0];
    const accs     = patrimonyAccounts || [];
    const fromAcc  = (accs || []).find(a => a.id === fromId);
    const toAcc    = (accs || []).find(a => a.id === toId);
    const fromName = fromAcc?.name || fromId;
    const toName   = toAcc?.name   || toId;

    const outPayload = {
      description: `Transferência para ${toName}`,
      amount: value, type: 'transfer', category: fromName, date: today,
      account_id: fromId, account_name: fromName, subcategory: 'out',
    };
    const inPayload = {
      description: `Transferência de ${fromName}`,
      amount: value, type: 'transfer', category: toName, date: today,
      account_id: toId, account_name: toName, subcategory: 'in',
    };

    // Sem rede → cria os dois lados com ids temporários e enfileira ambos.
    const queueLocally = () => {
      const outTx = { ...outPayload, id: newTempId(), _pending: true };
      const inTx  = { ...inPayload,  id: newTempId(), _pending: true };
      setTransactions(prev => [outTx, inTx, ...prev]);
      enqueueAdd(outPayload, outTx.id);
      enqueueAdd(inPayload, inTx.id);
      refreshPending();
    };

    if (isOffline()) return queueLocally();

    try {
      const rawOut = await dbService.addTransaction(currentUser.id, outPayload);
      const rawIn  = await dbService.addTransaction(currentUser.id, inPayload);

      const outTx = { ...rawOut, account_id: rawOut.account_id || fromId, account_name: rawOut.account_name || fromName };
      const inTx  = { ...rawIn,  account_id: rawIn.account_id  || toId,   account_name: rawIn.account_name  || toName  };

      const both = [outTx, inTx].filter(t => t?.id);
      if (both.length) setTransactions(prev => [...both, ...prev]);
    } catch (err) {
      if (isNetworkError(err)) return queueLocally();
      console.error('❌ Transfer error:', err);
      throw err;
    }
  };

  const handleAccountChange = async (transactionId, newAccountId, newAccountName) => {
    const original = transactions.find(t => t.id === transactionId);
    if (!original) return;

    setTransactions(prev => prev.map(t =>
      t.id === transactionId
        ? { ...t, account_id: newAccountId || null, account_name: newAccountName || null }
        : t
    ));

    try {
      await dbService.updateTransaction(transactionId, {
        account_id:   newAccountId   || null,
        account_name: newAccountName || null,
      });
    } catch (err) {
      console.error('❌ Error persisting account change to DB:', err);
    }
  };

  // ── Categorização ─────────────────────────────────────────────────────────

  const saveLearnedRule = (pattern, category) => {
    const updated = [
      { pattern, category },
      ...learnedRules.filter(r => r.pattern !== pattern),
    ];
    setLearnedRules(updated);
    dbService.updateUserSettings(currentUser.id, { learned_rules: updated }).catch(e => toast.error('Erro ao guardar: ' + e.message));
  };

  const handleCategoryChange = async (transactionId, newCategory, description) => {
    const original = transactions.find(t => t.id === transactionId);

    setTransactions(prev => prev.map(t =>
      t.id === transactionId ? { ...t, category: newCategory } : t
    ));

    try {
      await dbService.updateTransaction(transactionId, { category: newCategory });

      const pattern = tokensOf(description)[0] || null;
      if (pattern) {
        const similar = transactions.filter(t =>
          t.id !== transactionId &&
          t.category !== newCategory &&
          descMatchesPattern(t.description, pattern)
        );

        if (similar.length > 0) {
          setBulkPending({ transactionId, newCategory, description, pattern, similar });
        } else {
          saveLearnedRule(pattern, newCategory);
        }
      }
    } catch (err) {
      console.error('Error updating category:', err);
      if (original) setTransactions(prev => prev.map(t => t.id === transactionId ? original : t));
    }
  };

  // Aplica a nova categoria APENAS às transações selecionadas no modal.
  // selectedIds: array de ids (subconjunto de bulkPending.similar). Se omitido,
  // assume todas (retrocompatível).
  const handleBulkConfirm = async (selectedIds) => {
    if (!bulkPending) return;
    const { newCategory, pattern, description, similar } = bulkPending;

    const ids = Array.isArray(selectedIds) ? selectedIds : similar.map(s => s.id);
    const selected = similar.filter(s => ids.includes(s.id));
    const rejected = similar.filter(s => !ids.includes(s.id));

    if (selected.length > 0) {
      setTransactions(prev => prev.map(t =>
        ids.includes(t.id) ? { ...t, category: newCategory } : t
      ));
      for (const tx of selected) {
        dbService.updateTransaction(tx.id, { category: newCategory })
          .catch(e => toast.error('Erro ao guardar: ' + e.message));
      }
    }

    // Aprende o padrão mais específico que cobre a transação alterada + os
    // selecionados, mas NENHUM dos rejeitados → imports futuros respeitam a
    // divisão (ex. "uber eats" em vez de "uber"). Sem rejeitados, usa o amplo.
    const precise = derivePattern(
      description,
      [description, ...selected.map(s => s.description || '')],
      rejected.map(s => s.description || ''),
    ) || (rejected.length === 0 ? pattern : null);
    if (precise) saveLearnedRule(precise, newCategory);

    setBulkPending(null);
  };

  const handleBulkDismiss = () => {
    if (bulkPending) {
      const { description, newCategory, similar } = bulkPending;
      // Só a transação alterada foi aplicada. Aprende uma regra específica que
      // NÃO toque nas similares deixadas de fora (evita recategorizar os irmãos).
      const precise = derivePattern(description, [description], similar.map(s => s.description || ''));
      if (precise) saveLearnedRule(precise, newCategory);
    }
    setBulkPending(null);
  };

  const handleCategoriesChange = useCallback((updated) => {
    setCategories(updated);
  }, []);

  // ── Utilitários ───────────────────────────────────────────────────────────

  // Wrapper de conveniência — delega em computeAccountBalance (budgetUtils).
  // useCallback com [] → referência estável, para que os useMemo dos chamadores
  // (ex. patrimonyWithLiveBalances no App) possam cachear corretamente.
  const computeCurrentBalance = useCallback(
    (account, allTransactions) => computeAccountBalance(account, allTransactions),
    []
  );

  // Propaga o novo nome de uma conta a todas as transações ligadas.
  // Chamado pelo PatrimonyView quando o utilizador renomeia uma conta.
  const handleAccountRename = async (accountId, newName) => {
    // Actualizar em memória
    setTransactions(prev => prev.map(t =>
      t.account_id === accountId ? { ...t, account_name: newName } : t
    ));
    // Persistir no DB
    try {
      await dbService.updateAccountName(currentUser.id, accountId, newName);
    } catch (err) {
      toast.error('Erro ao actualizar nome da conta nas transações: ' + err.message);
    }
  };

  return {
    // Estado
    transactions,
    setTransactions,
    learnedRules,
    bulkPending,
    categories,
    pendingCount,
    // Boot
    initFromLoad,
    loadUserTransactions,
    flushQueue,
    // CRUD
    handleAddTransaction,
    handleDeleteTransaction,
    handleEditTransaction,
    handleImport,
    handleTransfer,
    handleAccountChange,
    // Categorização
    handleCategoryChange,
    handleBulkConfirm,
    handleBulkDismiss,
    handleCategoriesChange,
    // Utilitários
    computeCurrentBalance,
    handleAccountRename,
  };
}
