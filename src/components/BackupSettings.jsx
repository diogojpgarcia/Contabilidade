import React, { useState } from 'react';
import {
  exportData,
  importData,
  createAutoBackup,
  getRecoveryCode
} from '../utils/security-system';

const BackupSettings = ({ user, onClose }) => {
  const [importing, setImporting] = useState(false);
  const [recoveryCodeInput, setRecoveryCodeInput] = useState('');
  const [file, setFile] = useState(null);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [lastBackup, setLastBackup] = useState(null);

  const recoveryCode = getRecoveryCode(user.id);

  const handleExport = async () => {
    try {
      const { url, filename } = await exportData(user.id);
      
      // Create download link
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      
      URL.revokeObjectURL(url);
      
      setMessage({ 
        type: 'success', 
        text: 'Dados exportados com sucesso! Ficheiro descarregado.' 
      });
    } catch (error) {
      setMessage({ 
        type: 'error', 
        text: error.message || 'Erro ao exportar dados' 
      });
    }
  };

  const handleImport = async (e) => {
    e.preventDefault();
    
    if (!file || !recoveryCodeInput) {
      setMessage({ type: 'error', text: 'Escolhe um ficheiro e introduz o código' });
      return;
    }

    try {
      const result = await importData(file, recoveryCodeInput);
      setMessage({ 
        type: 'success', 
        text: `Dados importados! ${result.transactionCount} transações restauradas.` 
      });
      setImporting(false);
      
      // Reload page to show imported data
      setTimeout(() => window.location.reload(), 2000);
    } catch (error) {
      setMessage({ 
        type: 'error', 
        text: 'Código inválido ou ficheiro corrompido' 
      });
    }
  };

  const handleAutoBackup = async () => {
    try {
      const timestamp = await createAutoBackup(user.id);
      if (timestamp) {
        setLastBackup(new Date(timestamp));
        setMessage({ 
          type: 'success', 
          text: 'Backup automático criado com sucesso!' 
        });
      } else {
        setMessage({ 
          type: 'error', 
          text: 'Erro ao criar backup. Verifica se tens código de recuperação.' 
        });
      }
    } catch (error) {
      setMessage({ 
        type: 'error', 
        text: 'Erro ao criar backup automático' 
      });
    }
  };

  return (
    <div className="backup-settings-overlay" onClick={onClose}>
      <div className="backup-settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>💾 Backup & Recuperação</h2>
          <button onClick={onClose} className="btn-close">×</button>
        </div>

        <div className="modal-content">
          {/* Recovery Code Display */}
          {recoveryCode && (
            <section className="settings-section">
              <h3>🔐 Código de Recuperação</h3>
              <div className="recovery-code-box">
                <div className="code-display">{recoveryCode}</div>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(recoveryCode);
                    setMessage({ type: 'success', text: 'Código copiado!' });
                  }}
                  className="btn-copy-small"
                >
                  📋 Copiar
                </button>
              </div>
              <p className="hint">
                Guarda este código! Vais precisar dele para recuperar dados.
              </p>
            </section>
          )}

          {/* Export Data */}
          <section className="settings-section">
            <h3>📤 Exportar Dados</h3>
            <p>Cria um ficheiro de backup encriptado com todos os teus dados.</p>
            <button onClick={handleExport} className="btn-action">
              <span className="btn-icon">💾</span>
              <span>Exportar para Ficheiro</span>
            </button>
          </section>

          {/* Import Data */}
          <section className="settings-section">
            <h3>📥 Importar Dados</h3>
            {!importing ? (
              <button 
                onClick={() => setImporting(true)} 
                className="btn-action secondary"
              >
                <span className="btn-icon">📂</span>
                <span>Importar de Ficheiro</span>
              </button>
            ) : (
              <form onSubmit={handleImport} className="import-form">
                <div className="form-group">
                  <label>Ficheiro de Backup</label>
                  <input
                    type="file"
                    accept=".encrypted,.txt"
                    onChange={(e) => setFile(e.target.files[0])}
                    required
                    className="file-input"
                  />
                </div>
                <div className="form-group">
                  <label>Código de Recuperação</label>
                  <input
                    type="text"
                    value={recoveryCodeInput}
                    onChange={(e) => setRecoveryCodeInput(e.target.value.toUpperCase())}
                    placeholder="XX-XXXX-XXXX"
                    required
                    pattern="[A-Z0-9]{2}-[A-Z0-9]{4}-[A-Z0-9]{4}"
                  />
                </div>
                <div className="form-actions">
                  <button 
                    type="button" 
                    onClick={() => setImporting(false)}
                    className="btn-secondary"
                  >
                    Cancelar
                  </button>
                  <button type="submit" className="btn-primary">
                    Importar
                  </button>
                </div>
              </form>
            )}
          </section>

          {/* Auto Backup */}
          <section className="settings-section">
            <h3>🔄 Backup Automático</h3>
            <p>Cria um backup local encriptado (guardado no browser).</p>
            <button onClick={handleAutoBackup} className="btn-action">
              <span className="btn-icon">⚡</span>
              <span>Criar Backup Agora</span>
            </button>
            {lastBackup && (
              <p className="backup-info">
                Último backup: {lastBackup.toLocaleString('pt-PT')}
              </p>
            )}
          </section>

          {/* Message Display */}
          {message.text && (
            <div className={`settings-message ${message.type}`}>
              {message.type === 'success' ? '✅' : '❌'} {message.text}
            </div>
          )}

          {/* Info */}
          <section className="settings-info">
            <h4>ℹ️ Informação Importante</h4>
            <ul>
              <li>Todos os backups são encriptados com o teu código de recuperação</li>
              <li>Ninguém pode aceder aos teus dados sem o código</li>
              <li>Guarda o código num local seguro (papel, password manager)</li>
              <li>Exporta regularmente os dados para não perder informação</li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
};

export default BackupSettings;
