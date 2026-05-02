import React, { useState, useEffect } from 'react';
import { authService, dbService } from '../../lib/supabase';
import CategoryManager from '../CategoryManager';
import Overlay from '../Overlay';
import { useForm } from '../../hooks/useForm';
import './ProfileTab.css';

const ProfileTab = ({ user, userName, onLogout, onNavigateToImport, onDataDeleted, theme, setTheme }) => {
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const deleteSucceededRef = React.useRef(false);
  const [showDeleteHistory, setShowDeleteHistory] = useState(false);
  const [deleteStatus, setDeleteStatus]           = useState('');
  const [deleting, setDeleting]                   = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [colorTheme, setColorTheme]               = useState('dark');
  const [resetStatus, setResetStatus]             = useState('');

  // Modal form drafts — onChange → local only; DB/auth called on submit
  const { draft: deleteDraft, setField: setDeleteField, reset: resetDeleteDraft } = useForm({ confirmText: '' });
  const { draft: resetDraft,  setField: setResetField,  reset: resetResetDraft  } = useForm({ email: '' });

  useEffect(() => {
    loadUserPreferences();
  }, [user]);

  const loadUserPreferences = async () => {
    try {
      const settings = await dbService.getUserSettings(user.id);
      const saved = settings?.color_theme || 'dark';
      setColorTheme(saved);
      document.documentElement.setAttribute('data-theme', saved);
    } catch (error) {
      console.error('[ProfileTab] Error loading preferences:', error);
    }
  };

  const handleColorThemeChange = async (newColor) => {
    setColorTheme(newColor);
    document.documentElement.setAttribute('data-theme', newColor);
    dbService.updateUserSettings(user.id, { color_theme: newColor }).catch(console.error);
  };

  // Plain function — synchronous state update, fire-and-forget DB save
  const handleThemeChange = (newTheme) => {
    setTheme(newTheme);
    dbService.updateUserSettings(user.id, { theme: newTheme }).catch(console.error);
  };

  const handleResetPassword = async () => {
    if (!resetDraft.email) {
      setResetStatus('Por favor insere o teu email');
      return;
    }
    try {
      await authService.resetPassword(resetDraft.email);
      setResetStatus('✓ Email de recuperação enviado! Verifica a tua caixa de entrada.');
      setTimeout(() => {
        setShowResetPassword(false);
        setResetStatus('');
        resetResetDraft({ email: '' });
      }, 3000);
    } catch (error) {
      setResetStatus('Erro ao enviar email: ' + error.message);
    }
  };

  /* ── shared modals — called as {renderProfileModals()}, NOT as <ProfileModals />.
     Inline component definitions create a new React type every render
     → subtree unmounts → focused inputs lose the keyboard.                */
  const renderProfileModals = () => (
    <>
      {showCategoryManager && (
        <Overlay onClose={() => setShowCategoryManager(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <CategoryManager userId={user.id} onClose={() => setShowCategoryManager(false)} onUpdate={(c) => console.log('Categories updated:', c)} />
          </div>
        </Overlay>
      )}

      {showDeleteHistory && (
        <Overlay onClose={() => { setShowDeleteHistory(false); resetDeleteDraft({ confirmText: '' }); if (deleteSucceededRef.current && onDataDeleted) { deleteSucceededRef.current = false; onDataDeleted(); }}}>
          <div className="modal-content delete-history-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Apagar Todos os Dados</h3>
              <button className="btn-close" onClick={() => { setShowDeleteHistory(false); resetDeleteDraft({ confirmText: '' }); if (deleteSucceededRef.current && onDataDeleted) { deleteSucceededRef.current = false; onDataDeleted(); }}}>
                <span className="sf-icon">✕</span>
              </button>
            </div>
            <div className="modal-body">
              <div className="delete-warning-icon">🗑</div>
              <p className="modal-description delete-warning-text">Esta ação é <strong>irreversível</strong>. Todas as transações, categorias, orçamentos e configurações serão apagados permanentemente.</p>
              <p className="delete-confirm-label">Escreve <strong>APAGAR</strong> para confirmar</p>
              <input
                type="text"
                placeholder="APAGAR"
                value={deleteDraft.confirmText}
                onChange={(e) => setDeleteField('confirmText', e.target.value)}
                className="input-field"
                autoCapitalize="characters"
              />
              {deleteStatus && <p className={`status-message ${deleteStatus.includes('✓') ? 'success' : 'error'}`}>{deleteStatus}</p>}
              <button
                className="btn-danger full-width"
                disabled={deleteDraft.confirmText.trim().toUpperCase() !== 'APAGAR' || deleting}
                onClick={async () => {
                  setDeleting(true);
                  try {
                    await dbService.deleteAllUserData(user.id);
                    deleteSucceededRef.current = true;
                    if (onDataDeleted) onDataDeleted();
                    setDeleteStatus('✓ Todos os dados apagados.');
                    setTimeout(() => {
                      deleteSucceededRef.current = false;
                      setShowDeleteHistory(false);
                      resetDeleteDraft({ confirmText: '' });
                      setDeleteStatus('');
                    }, 1400);
                  } catch (err) {
                    setDeleteStatus('Erro: ' + err.message);
                  } finally {
                    setDeleting(false);
                  }
                }}
              >{deleting ? 'A apagar…' : 'Apagar tudo'}</button>
            </div>
          </div>
        </Overlay>
      )}

      {showResetPassword && (
        <Overlay onClose={() => { setShowResetPassword(false); resetResetDraft({ email: '' }); setResetStatus(''); }}>
          <div className="modal-content reset-password-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Alterar Password</h3>
              <button className="btn-close" onClick={() => { setShowResetPassword(false); resetResetDraft({ email: '' }); setResetStatus(''); }}>
                <span className="sf-icon">✕</span>
              </button>
            </div>
            <div className="modal-body">
              <p className="modal-description">Vamos enviar um link de recuperação para o teu email</p>
              <input
                type="email"
                placeholder="Email"
                value={resetDraft.email}
                onChange={(e) => setResetField('email', e.target.value)}
                className="input-field"
              />
              {resetStatus && <p className={`status-message ${resetStatus.includes('✓') ? 'success' : 'error'}`}>{resetStatus}</p>}
              <button className="btn-primary full-width" onClick={handleResetPassword}>Enviar Link</button>
            </div>
          </div>
        </Overlay>
      )}
    </>
  );

  /* ── MODERN BRANCH ─────────────────────────────────────────────────────── */
  if (theme === 'modern') {
    return (
      <div className="m-profile-page">
        {/* User info */}
        <div className="m-user-section">
          <div className="m-avatar">
            {userName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
          </div>
          <div className="m-user-name">{userName}</div>
          <div className="m-user-email">{user.email}</div>
        </div>

        {/* Aparência */}
        <div className="m-menu-section">
          <div className="m-menu-section-label">Aparência</div>
          <div className="m-menu-group">
            <div className="m-seg-wrap">
              <div className="m-seg-control">
                <button className={`m-seg-btn ${colorTheme === 'light' ? 'active' : ''}`} onClick={() => handleColorThemeChange('light')}>
                  <span className="m-seg-icon">☀︎</span><span>Claro</span>
                </button>
                <button className={`m-seg-btn ${colorTheme === 'gray'  ? 'active' : ''}`} onClick={() => handleColorThemeChange('gray')}>
                  <span className="m-seg-icon">◐</span><span>Cinza</span>
                </button>
                <button className={`m-seg-btn ${colorTheme === 'dark'  ? 'active' : ''}`} onClick={() => handleColorThemeChange('dark')}>
                  <span className="m-seg-icon">☾</span><span>Escuro</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Layout */}
        <div className="m-menu-section">
          <div className="m-menu-section-label">Layout</div>
          <div className="m-menu-group">
            <div className="m-seg-wrap">
              <div className="m-seg-control">
                <button className={`m-seg-btn ${theme === 'default' ? 'active' : ''}`} onClick={() => handleThemeChange('default')}>
                  <span>Default</span>
                </button>
                <button className={`m-seg-btn ${theme === 'modern'  ? 'active' : ''}`} onClick={() => handleThemeChange('modern')}>
                  <span>Modern</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Conta */}
        <div className="m-menu-section">
          <div className="m-menu-section-label">Conta</div>
          <div className="m-menu-group">
            <button className="m-menu-item" onClick={() => setShowCategoryManager(true)}>
              <span className="m-menu-icon">☷</span>
              <span className="m-menu-text">Gerir Categorias</span>
              <span className="m-menu-arrow">›</span>
            </button>
            <button className="m-menu-item" onClick={() => onNavigateToImport && onNavigateToImport()}>
              <span className="m-menu-icon">⬆</span>
              <span className="m-menu-text">Importar Extracto Bancário</span>
              <span className="m-menu-arrow">›</span>
            </button>
            <button className="m-menu-item" onClick={() => setShowResetPassword(true)}>
              <span className="m-menu-icon">⚿</span>
              <span className="m-menu-text">Alterar Password</span>
              <span className="m-menu-arrow">›</span>
            </button>
            <button className="m-menu-item danger" onClick={() => { deleteSucceededRef.current = false; setShowDeleteHistory(true); resetDeleteDraft({ confirmText: '' }); setDeleteStatus(''); }}>
              <span className="m-menu-icon">🗑</span>
              <span className="m-menu-text">Apagar Todos os Dados</span>
              <span className="m-menu-arrow">›</span>
            </button>
          </div>
        </div>

        {/* Logout */}
        <button className="m-logout-btn" onClick={onLogout}>Terminar Sessão</button>

        {renderProfileModals()}
      </div>
    );
  }

  /* ── DEFAULT BRANCH ──────────────────────────────────────────────────── */
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
          onClick={() => { deleteSucceededRef.current = false; setShowDeleteHistory(true); resetDeleteDraft({ confirmText: '' }); setDeleteStatus(''); }}
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

      {renderProfileModals()}
    </div>
  );
};

export default ProfileTab;
