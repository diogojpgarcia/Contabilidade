import React, { useState, useRef, useMemo } from 'react';
import { dbService, computeImportHash } from '../../lib/supabase';
import { parseBankFile, extractClosingBalance } from '../../utils/parseBankFile';
import { enrichTransactions } from '../../utils/enrichTransactions.js';
import { assignImportSeqs, findExistingDuplicates } from '../../utils/importDedup';
import { descMatchesPattern } from '../../utils/textMatch';
import FintechTransactionCard from '../FintechTransactionCard';
import AccountReconcileSheet from '../budget/AccountReconcileSheet';
import { useAppContext } from '../../context/AppContext';
import './ImportTab.css';

/* Map a preview row to the shape FintechTransactionCard expects */
const toFtcShape = (tx, i) => ({
  id:          `preview-${i}`,
  date:        tx.date,
  description: tx.clean_description || tx.description || '',
  amount:      tx.amount,
  type:        tx.type,
  category:    tx.category || (tx.type === 'income' ? 'Outros Rendimentos' : 'Outros'),
});

const ImportTab = ({
  onImportDone,
  learnedRules = [],
  accounts = [],
  mainAccountId = null,
  transactions = [],
  recurringPayments = [],
  confirmedRecurring = {},
  onConfirmRecurring,
  onSaveAccount,
}) => {
  const { currentUser } = useAppContext();
  const [preview,  setPreview]  = useState([]);
  const [insights, setInsights] = useState(null);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const [fileName, setFileName] = useState('');
  const [saving,      setSaving]      = useState(false);
  const [saved,       setSaved]       = useState(false);
  const [keepDupes,   setKeepDupes]   = useState(false);
  const [skippedCount, setSkippedCount] = useState(0);
  const [accountId,   setAccountId]   = useState('');   // conta destino do import
  const [closing,     setClosing]     = useState(null); // { balance, date } do extrato
  const [reconcileOpen, setReconcileOpen] = useState(false);
  const inputRef = useRef();

  // Conta destino efetiva: escolha explícita ou, por defeito, a conta principal.
  const effAccountId = accountId || mainAccountId || '';
  const targetAccount = accounts.find(a => a.id === effAccountId) || null;

  // Linhas do import que JÁ existem na conta destino (re-import / sobreposição /
  // lançadas à mão antes) — para não duplicar. Recalcula ao mudar de conta.
  const existingDupIdx = useMemo(() => {
    if (!targetAccount) return new Set();
    const accTxns = transactions.filter(t => t.account_id === targetAccount.id);
    return findExistingDuplicates(preview, accTxns);
  }, [preview, transactions, targetAccount]);
  const existingDupCount = existingDupIdx.size;

  const handleFile = async (file) => {
    if (!file) return;
    setError(''); setSaved(false); setPreview([]); setInsights(null); setClosing(null);
    setFileName(file.name);
    setLoading(true);
    try {
      const buffer   = await file.arrayBuffer();
      const ext      = file.name.split('.').pop().toLowerCase();
      const fileType = ext === 'pdf' ? 'pdf'
        : ['xlsx','xls','ods'].includes(ext) ? ext
        : 'csv';

      const rows = await parseBankFile(buffer, fileType);
      if (!rows.length) {
        setError('Nenhuma transação reconhecida no ficheiro.');
        return;
      }

      // Saldo final do extrato (CSV/XLSX) → pré-preenche a conferência pós-import.
      setClosing(extractClosingBalance(rows));

      const { transactions, insights: ins } = enrichTransactions(rows);

      // Apply learned rules locally
      const categorized = transactions.map(tx => {
        if (tx.category) return tx;
        // Mais específico primeiro: regras com padrão mais longo ganham
        // (ex. "uber eats" antes de "uber"), para respeitar diferenciações.
        const match = [...learnedRules]
          .filter(r => r.pattern && descMatchesPattern(tx.description, r.pattern))
          .sort((a, b) => b.pattern.length - a.pattern.length)[0];
        return match ? { ...tx, category: match.category } : tx;
      });

      setPreview(categorized);
      setInsights(ins);
    } catch (e) {
      setError('Erro ao processar ficheiro: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleConfirm = async () => {
    if (!preview.length || !currentUser) return;
    setSaving(true);
    // seq por linha (índice de ocorrência) — desempata linhas iguais para não
    // serem descartadas pela UNIQUE(import_hash). Calculado sobre TODO o preview
    // (estável entre re-imports do mesmo ficheiro).
    const seqs = assignImportSeqs(preview);
    const toSave = preview
      .map((tx, i) => ({ tx, i }))
      .filter(({ tx, i }) =>
        (keepDupes || !tx.is_duplicate)   // duplicados dentro do ficheiro
        && !existingDupIdx.has(i)          // já existentes na conta — nunca re-importar
      )
      .map(({ tx, i }) => ({
        date:        tx.date,
        description: tx.clean_description || tx.description,
        amount:      tx.amount,
        type:        tx.type,
        category:    tx.category || (tx.type === 'income' ? 'Outros Rendimentos' : 'Outros'),
        // Liga as transações importadas à conta destino (reconciliação por conta).
        ...(targetAccount ? { account_id: targetAccount.id, account_name: targetAccount.name } : {}),
        import_hash: computeImportHash(
          tx.date,
          tx.amount,
          tx.clean_description || tx.description,
          seqs[i],
        ),
      }));
    try {
      const { saved, skipped } = await dbService.addTransactionsBulk(currentUser.id, toSave);
      setSaved(true);
      setSkippedCount(skipped);
      setPreview([]);
      setInsights(null);
      setFileName('');
      if (onImportDone) onImportDone(saved);
      // Fecha o ciclo: oferece conferir o saldo da conta importada (pré-preenchido
      // com o saldo final do extrato, quando disponível).
      if (targetAccount && onSaveAccount) setReconcileOpen(true);
    } catch (e) {
      setError('Erro ao guardar: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleClear = () => {
    setPreview([]); setInsights(null); setFileName('');
    setError(''); setSaved(false); setSkippedCount(0); setClosing(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  // Linhas que vão mesmo ser importadas: exclui duplicados no ficheiro (salvo
  // keepDupes) e os que já existem na conta.
  const willImport = preview.filter((t, i) => (keepDupes || !t.is_duplicate) && !existingDupIdx.has(i));

  return (
    <div className="import-tab">
      <div className="import-header">
        <h2>Importar Extracto</h2>
        <p>CSV, XLSX ou PDF de qualquer banco</p>
      </div>

      {/* Drop zone */}
      <div
        className={`import-dropzone ${loading ? 'loading' : ''}`}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        onClick={() => !loading && inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.pdf,.xlsx,.xls,.ods,text/csv,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
          style={{ display: 'none' }}
          onChange={(e) => handleFile(e.target.files[0])}
        />
        {loading ? (
          <div className="import-spinner-wrap">
            <div className="import-spinner" />
            <span>A processar…</span>
          </div>
        ) : (
          <>
            <span className="import-dz-icon">⬆</span>
            <span className="import-dz-label">
              {fileName || 'Toca para escolher ficheiro'}
            </span>
            <span className="import-dz-hint">CSV, XLSX ou PDF · arrasta ou toca</span>
          </>
        )}
      </div>

      {error && <div className="import-error">{error}</div>}

      {saved && (
        <div className="import-success">✓ Transações importadas com sucesso!{skippedCount > 0 ? ` · ${skippedCount} ignoradas (já existiam)` : ''}</div>
      )}

      {/* Insights bar */}
      {insights && (
        <div className="import-insights">
          <div className="import-insight-item">
            <span className="import-insight-value">{willImport.length}</span>
            <span className="import-insight-label">a importar</span>
          </div>
          <div className="import-insight-item income">
            <span className="import-insight-value">+{insights.total_income.toFixed(2)}€</span>
            <span className="import-insight-label">receitas</span>
          </div>
          <div className="import-insight-item expense">
            <span className="import-insight-value">-{insights.total_spent.toFixed(2)}€</span>
            <span className="import-insight-label">despesas</span>
          </div>
          <div className="import-insight-item category">
            <span className="import-insight-value">{insights.top_category}</span>
            <span className="import-insight-label">top categoria</span>
          </div>
          {insights.duplicate_count > 0 && (
            <div
              className={`import-insight-item duplicate${keepDupes ? ' active' : ''}`}
              onClick={() => setKeepDupes(v => !v)}
              title={keepDupes ? 'Clica para excluir duplicados' : 'Clica para manter duplicados'}
            >
              <span className="import-insight-value">{insights.duplicate_count}</span>
              <span className="import-insight-label">
                {keepDupes ? 'manter dupl.' : 'duplicados'}
              </span>
            </div>
          )}
          {existingDupCount > 0 && (
            <div className="import-insight-item duplicate" title="Já existem nesta conta — não serão re-importados">
              <span className="import-insight-value">{existingDupCount}</span>
              <span className="import-insight-label">já na conta</span>
            </div>
          )}
        </div>
      )}

      {/* Preview list */}
      {preview.length > 0 && (
        <div className="import-preview">
          <div className="import-preview-header">
            <span className="import-preview-title">Pré-visualização</span>
            <span className="import-preview-count">{preview.length} linhas</span>
          </div>
          <div className="ftc-list import-ftc-list">
              {preview.map((tx, i) => (
                <FintechTransactionCard
                  key={i}
                  tx={toFtcShape(tx, i)}
                  isDuplicate={!!tx.is_duplicate || existingDupIdx.has(i)}
                  onCategoryChange={null}
                  onDelete={null}
                />
              ))}
            </div>
        </div>
      )}

      {/* Conta destino — liga as transações importadas a uma conta (reconciliação) */}
      {preview.length > 0 && accounts.length > 0 && (
        <div className="import-account-select">
          <label className="import-account-label">Conta destino</label>
          <select
            className="import-account-input"
            value={effAccountId}
            onChange={(e) => setAccountId(e.target.value)}
          >
            <option value="">— Sem conta —</option>
            {accounts.map(a => (
              <option key={a.id} value={a.id}>{a.name}{a.bank ? ` · ${a.bank}` : ''}</option>
            ))}
          </select>
          {targetAccount && (
            <span className="import-account-hint">
              No fim podes conferir o saldo desta conta{closing ? ' (saldo do extrato detetado)' : ''}.
            </span>
          )}
        </div>
      )}

      {/* Actions */}
      {preview.length > 0 && (
        <div className="import-actions">
          <button className="btn-import-clear" onClick={handleClear}>Limpar</button>
          <button
            className="btn-import-confirm"
            onClick={handleConfirm}
            disabled={saving}
          >
            {saving
              ? 'A guardar…'
              : `Confirmar ${willImport.length} transações${existingDupCount > 0 ? ` (${existingDupCount} já na conta)` : ''}`
            }
          </button>
        </div>
      )}

      {/* Conferir saldo da conta importada (pré-preenchido com o saldo do extrato) */}
      {reconcileOpen && targetAccount && (
        <AccountReconcileSheet
          open={reconcileOpen}
          onClose={() => setReconcileOpen(false)}
          account={targetAccount}
          transactions={transactions}
          recurringPayments={recurringPayments}
          confirmedRecurring={confirmedRecurring}
          onConfirmRecurring={onConfirmRecurring}
          onSaveAccount={onSaveAccount}
          prefillBalance={closing?.balance ?? null}
          prefillDate={closing?.date ?? null}
        />
      )}
    </div>
  );
};

export default ImportTab;