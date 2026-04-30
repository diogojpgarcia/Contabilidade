import React, { useState, useEffect } from 'react';
import { authService, dbService } from '../../lib/supabase';
import CategoryManager from '../CategoryManager';
import './ProfileTab.css';

const ProfileTab = ({ user, userName, onLogout, onNavigateToImport, onDataDeleted, theme = 'default', setTheme }) => {
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const deleteSucceededRef = React.useRef(false);
  const [showDeleteHistory, setShowDeleteHistory]     = useState(false);
  const [deleteConfirmText, setDeleteConfirmText]     = useState('');
  const [deleteStatus, setDeleteStatus]               = useState('');
  const [deleting, setDeleting]                       = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [colorTheme, setColorTheme] = useState('dark');
  const [resetEmail, setResetEmail] = useState('');
  const [resetStatus, setResetStatus] = useState('');

  useEffect(() => {
    loadUserPreferences();
  }, [user]);

  const loadUserPreferences = async () => {
    try {
      const settings = await dbService.getUserSettings(user.id);
      console.log('[ProfileTab] user_settings:', settings);

      // Colour theme (light / gray / dark)
      const saved = settings?.color_theme || 'dark';
      setColorTheme(saved);
      applyTheme(saved);

      // Layout theme (default / modern) — sync App state
      const savedLayout = settings?.ui_theme || 'default';
      if (setTheme) setTheme(savedLayout);
    } catch (error) {
      console.error('[ProfileTab] Error loading preferences:', error);
      applyTheme('dark');
    }
  };

  const applyTheme = (newTheme) => {
    document.documentElement.setAttribute('data-theme', newTheme);
  };

  const handleColorThemeChange = async (newColor) => {
    setColorTheme(newColor);   // instant
    applyTheme(newColor);
    try {
      await dbService.updateUserSettings(user.id, { color_theme: newColor });
    } catch (error) {
      console.error('[ProfileTab] Error saving color_theme:', error);
    }
  };

  const handleThemeChange = async (newTheme) => {
    setTheme(newTheme);        // instant — directly updates App state
    try {
      await dbService.updateUserSettings(user.id, { ui_theme: newTheme });
    } catch (error) {
      console.error('[ProfileTab] Error saving ui_theme:', error);
    }
  };

  const handleResetPassword = async () => {
    if (!resetEmail) {
      setResetStatus('Por favor insere o teu email');
      return;
    }

    try {
      await authService.resetPassword(resetEmail);
      setResetStatus('✓ Email de recuperação enviado! Verifica a tua caixa de entrada.');
      setTimeout(() => {
        setShowResetPassword(false);
        setResetStatus('');
        setResetEmail('');
      }, 3000);
    } catch (error) {
      setResetStatus('Erro ao enviar email: ' + error.message);
    }
  };

  return (
    <div className="profile-tab">
      {/* User Info */}
      <div className="user-info-section">
        <div className="user-avatar-large">
          {userName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
        </div>
        <h2 className="user-name">{userName}</h2>
        <p className="user-email">{user.email}</p>
      </div>

      {/* Appearance */}
      <div className="profile-section">
        <h3 className="section-title">Aparência</h3>
        <div className="theme-selector">
          <button
            className={`theme-option ${colorTheme === 'light' ? 'active' : ''}`}
            onClick={() => handleColorThemeChange('light')}
          >
            <span className="sf-icon">☀︎</span>
            <span>Claro</span>
          </button>
          <button
            className={`theme-option ${colorTheme === 'gray' ? 'active' : ''}`}
            onClick={() => handleColorThemeChange('gray')}
          >
            <span className="sf-icon">◐</span>
            <span>Cinza</span>
          </button>
          <button
            className={`theme-option ${colorTheme === 'dark' ? 'active' : ''}`}
            onClick={() => handleColorThemeChange('dark')}
          >
            <span className="sf-icon">☾</span>
            <span>Escuro</span>
          </button>
        </div>

      </div>

      {/* Theme */}
      <div className="profile-section">
        <h3 className="section-title">Theme</h3>
        <div className="theme-selector theme-selector-2">
          <button
            className={`theme-option ${theme === 'default' ? 'active' : ''}`}
            onClick={() => handleThemeChange('default')}
          >
            <span className="sf-icon">◫</span>
            <span>Default</span>
          </button>
          <button
            className={`theme-option ${theme === 'modern' ? 'active' : ''}`}
            onClick={() => handleThemeChange('modern')}
          >
            <span className="sf-icon">◧</span>
            <span>Modern</span>
          </button>
        </div>
      </div>

      {/* Account Options */}
      <div className="profile-section">
        <h3 className="section-title">Conta</h3>
        
        <button 
          className="profile-option"
          onClick={() => setShowCategoryManager(true)}
        >
          <span className="option-icon-sf">☷</span>
          <span className="option-label">Gerir Categorias</span>
          <span className="option-arrow-sf">›</span>
        </button>

        <div className="option-separator" />

        <button
          className="profile-option"
          onClick={() => onNavigateToImport && onNavigateToImport()}
        >
          <span className="option-icon-sf">&#11014;</span>
          <span className="option-label">Importar Extracto Bancário</span>
          <span className="option-arrow-sf">&#8250;</span>
        </button>

        <div className="option-separator" />

        <button
          className="profile-option"
          onClick={() => setShowResetPassword(true)}
        >
          <span className="option-icon-sf">⚿</span>
          <span className="option-label">Alterar Password</span>
          <span className="option-arrow-sf">›</span>
        </button>

        <div className="option-separator" />

        <button
          className="profile-option danger"
          onClick={() => { deleteSucceededRef.current = false; setShowDeleteHistory(true); setDeleteConfirmText(''); setDeleteStatus(''); }}
        >
          <span className="option-icon-sf">🗑</span>
          <span className="option-label">Apagar Todos os Dados</span>
          <span className="option-arrow-sf">›</span>
        </button>
      </div>

      {/* Logout */}
      <div className="profile-section">
        <button className="btn-logout" onClick={onLogout}>
          <span className="sf-icon">⏻</span>
          <span>Terminar Sessão</span>
        </button>
      </div>

      {/* Category Manager Modal */}
      {showCategoryManager && (
        <div className="modal-overlay" onClick={() => setShowCategoryManager(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <CategoryManager
              userId={user.id}
              onClose={() => setShowCategoryManager(false)}
              onUpdate={(newCategories) => {
                console.log('Categories updated:', newCategories);
              }}
            />
          </div>
        </div>
      )}

      {/* Delete History Modal */}
      {showDeleteHistory && (
        <div className="modal-overlay" onClick={() => {
          setShowDeleteHistory(false);
          if (deleteSucceededRef.current && onDataDeleted) {
            deleteSucceededRef.current = false;
            onDataDeleted();
          }
        }}>
          <div className="modal-content delete-history-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Apagar Todos os Dados</h3>
              <button className="btn-close" onClick={() => {
                setShowDeleteHistory(false);
                if (deleteSucceededRef.current && onDataDeleted) {
                  deleteSucceededRef.current = false;
                  onDataDeleted();
                }
              }}>
                <span className="sf-icon">✕</span>
              </button>
            </div>
            <div className="modal-body">
              <div className="delete-warning-icon">🗑</div>
              <p className="modal-description delete-warning-text">
                Esta ação é <strong>irreversível</strong>. Todas as transações, categorias, orçamentos e configurações serão apagados permanentemente.
              </p>
              <p className="delete-confirm-label">
                Escreve <strong>APAGAR</strong> para confirmar
              </p>
              <input
                type="text"
                placeholder="APAGAR"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                className="input-field"
                autoCapitalize="characters"
              />
              {deleteStatus && (
                <p className={`status-message ${deleteStatus.includes('✓') ? 'success' : 'error'}`}>
                  {deleteStatus}
                </p>
              )}
              <button
                className="btn-danger full-width"
                disabled={deleteConfirmText.trim().toUpperCase() !== 'APAGAR' || deleting}
                onClick={async () => {
                  setDeleting(true);
                  try {
                    await dbService.deleteAllUserData(user.id);
                    deleteSucceededRef.current = true;
                    // Flush parent state immediately so UI is clean before modal closes.
                    if (onDataDeleted) onDataDeleted();
                    setDeleteStatus('✓ Todos os dados apagados.');
                    setTimeout(() => {
                      deleteSucceededRef.current = false;
                      setShowDeleteHistory(false);
                      setDeleteConfirmText('');
                      setDeleteStatus('');
                    }, 1400);
                  } catch (err) {
                    setDeleteStatus('Erro: ' + err.message);
                  } finally {
                    setDeleting(false);
                  }
                }}
              >
                {deleting ? 'A apagar…' : 'Apagar tudo'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {showResetPassword && (
        <div className="modal-overlay" onClick={() => setShowResetPassword(false)}>
          <div className="modal-content reset-password-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Alterar Password</h3>
              <button className="btn-close" onClick={() => setShowResetPassword(false)}>
                <span className="sf-icon">✕</span>
              </button>
            </div>
            <div className="modal-body">
              <p className="modal-description">
                Vamos enviar um link de recuperação para o teu email
              </p>
              <input
                type="email"
                placeholder="Email"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                className="input-field"
              />
              {resetStatus && (
                <p className={`status-message ${resetStatus.includes('✓') ? 'success' : 'error'}`}>
                  {resetStatus}
                </p>
              )}
              <button className="btn-primary full-width" onClick={handleResetPassword}>
                Enviar Link
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfileTab;
