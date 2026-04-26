import React, { useState, useRef } from 'react';
import { dbService } from '../../lib/supabase';
import { parseBankFile } from '../../utils/parseBankFile';
import { categorizeBatch } from '../../utils/categorize.js';
import './ImportTab.css';

const CATEGORY_MAP = {
  income: 'Outros Rendimentos',
  expense: 'Outros',
};

const ImportTab = ({ user, onImportDone }) => {
  const [preview, setPreview]     = useState([]);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');
  const [fileName, setFileName]   = useState('');
  const [saving, setSaving]       = useState(false);
  const [saved, setSaved]         = useState(false);
  const inputRef = useRef();

  const handleFile = async (file) => {
    if (!file) return;
    setError(''); setSaved(false); setPreview([]);
    setFileName(file.name);
    setLoading(true);
    try {
      const buffer = await file.arrayBuffer();
      const ext = file.name.split('.').pop().toLowerCase();
      const fileType = ext === 'pdf' ? 'pdf' : 'csv';
      const rows = await parseBankFile(buffer, fileType);
      const categorized = categorizeBatch(rows);
      if (!categorized.length) setError('Nenhuma transação reconhecida no ficheiro.');
      setPreview(categorized);
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
    try {
      for (const tx of preview) {
        const finalCategory = tx.category || CATEGORY_MAP[tx.type] || 'Outros';
        console.debug(`[import] ${tx.type} | ${tx.amount} | ${tx.description?.slice(0,30)} → ${finalCategory}`);
        await dbService.addTransaction(user.id, {
          date: tx.date,
          description: tx.description,
          amount: tx.amount,
          type: tx.type,
          category: finalCategory,
        });
      }
      setSaved(true);
      setPreview([]);
      setFileName('');
      if (onImportDone) onImportDone();
    } catch (e) {
      setError('Erro ao guardar: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleClear = () => {
    setPreview([]); setFileName(''); setError(''); setSaved(false);
    if (inputRef.current) inputRef.current.value = '';
  };

  const income  = preview.filter(t => t.type === 'income').reduce((s, t)  => s + t.amount, 0);
  const expense = preview.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

  return (
    <div className="import-tab">
      <div className="import-header">
        <h2>Importar Extracto</h2>
        <p>CSV ou PDF de qualquer banco</p>
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
          accept=".csv,.pdf,text/csv,application/pdf"
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
            <span className="import-dz-hint">CSV ou PDF · arrasta ou toca</span>
          </>
        )}
      </div>

      {error && <div className="import-error">{error}</div>}

      {saved && (
        <div className="import-success">
          ✓ Transações importadas com sucesso!
        </div>
      )}

      {/* Summary bar */}
      {preview.length > 0 && (
        <div className="import-summary">
          <div className="import-summary-item">
            <span className="import-summary-count">{preview.length}</span>
            <span className="import-summary-label">transações</span>
          </div>
          <div className="import-summary-item income">
            <span className="import-summary-count">+{income.toFixed(2)}€</span>
            <span className="import-summary-label">receitas</span>
          </div>
          <div className="import-summary-item expense">
            <span className="import-summary-count">-{expense.toFixed(2)}€</span>
            <span className="import-summary-label">despesas</span>
          </div>
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
              <div key={i} className={`import-row ${tx.type}`}>
                <div className="import-row-left">
                  <span className="import-row-date">{tx.date} · {tx.category}</span>
                  <span className="import-row-desc">{tx.description}</span>
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
          <button className="btn-import-confirm" onClick={handleConfirm} disabled={saving}>
            {saving ? 'A guardar…' : `Confirmar ${preview.length} transações`}
          </button>
        </div>
      )}
    </div>
  );
};

export default ImportTab;
