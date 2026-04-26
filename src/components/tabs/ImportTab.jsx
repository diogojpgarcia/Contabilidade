import React, { useState, useRef } from 'react';
import { dbService } from '../../lib/supabase';
import { parseBankFile } from '../../utils/parseBankFile';
import { enrichTransactions } from '../../utils/enrichTransactions.js';
import './ImportTab.css';

const ImportTab = ({ user, onImportDone }) => {
  const [preview,  setPreview]  = useState([]);
  const [insights, setInsights] = useState(null);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const [fileName, setFileName] = useState('');
  const [saving,   setSaving]   = useState(false);
  const [saved,    setSaved]    = useState(false);
  const inputRef = useRef();

  const handleFile = async (file) => {
    if (!file) return;
    setError(''); setSaved(false); setPreview([]); setInsights(null);
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

      const { transactions, insights: ins } = enrichTransactions(rows);
      console.log('[ImportTab] enriched transactions:', transactions.length, ins);

      setPreview(transactions);
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
    if (!preview.length || !user) return;
    setSaving(true);
    const toSave = preview.filter(tx => !tx.is_duplicate);
    try {
      for (const tx of toSave) {
        const payload = {
          date:        tx.date,
          description: tx.clean_description || tx.description,
          amount:      tx.amount,
          type:        tx.type,
          category:    tx.category || (tx.type === 'income' ? 'Income' : 'Other'),
        };
        console.log('[ImportTab] BEFORE INSERT:', payload);
        await dbService.addTransaction(user.id, payload);
      }
      setSaved(true);
      setPreview([]);
      setInsights(null);
      setFileName('');
      if (onImportDone) onImportDone();
    } catch (e) {
      setError('Erro ao guardar: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleClear = () => {
    setPreview([]); setInsights(null); setFileName('');
    setError(''); setSaved(false);
    if (inputRef.current) inputRef.current.value = '';
  };

  const nonDupe = preview.filter(t => !t.is_duplicate);

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
        <div className="import-success">✓ Transações importadas com sucesso!</div>
      )}

      {/* Insights bar */}
      {insights && (
        <div className="import-insights">
          <div className="import-insight-item">
            <span className="import-insight-value">{nonDupe.length}</span>
            <span className="import-insight-label">transações</span>
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
        </div>
      )}

      {/* Preview list */}
      {preview.length > 0 && (
        <div className="import-preview">
          <div className="import-preview-header">
            <span className="import-preview-title">Pré-visualização</span>
            <span className="import-preview-count">{preview.length} linhas</span>
          </div>
          <div className="import-preview-list">
            {preview.map((tx, i) => (
              <div
                key={i}
                className={`import-row ${tx.type}${tx.is_duplicate ? ' duplicate' : ''}`}
              >
                <div className="import-row-left">
                  <span className="import-row-meta">
                    {tx.date} · {tx.category}
                    {tx.is_duplicate && <span className="import-dupe-badge">duplicado</span>}
                  </span>
                  <span className="import-row-desc">{tx.clean_description}</span>
                  {tx.clean_description !== tx.description && (
                    <span className="import-row-original">{tx.description}</span>
                  )}
                </div>
                <span className={`import-row-amount ${tx.type}`}>
                  {tx.type === 'income' ? '+' : '-'}{tx.amount.toFixed(2)}€
                </span>
              </div>
            ))}
          </div>
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
              : `Confirmar ${nonDupe.length} transações${!keepDupes && insights?.duplicate_count > 0 ? ` (${insights.duplicate_count} duplicados excluídos)` : ''}`
            }
          </button>
        </div>
      )}
    </div>
  );
};

export default ImportTab;
