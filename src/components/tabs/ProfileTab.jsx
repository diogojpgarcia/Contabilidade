import React, { useState, useEffect } from 'react';
import { authService, dbService } from '../../lib/supabase';
import CategoryManager from '../CategoryManager';
import Overlay from '../Overlay';
import { useForm } from '../../hooks/useForm';
import PageHeader from '../PageHeader';
import './ProfileTab.css';

const ProfileTab = ({ user, userName, onLogout, onNavigateToImport, onDataDeleted, theme, setTheme, categories, onCategoriesChange, patrimony = {}, defaultAccount, onDefaultAccountChange, useFinancialMonth = false, financialMonthStartDay = 1, onFinancialMonthChange }) => {
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
            <CategoryManager userId={user.id} categories={categories} onClose={() => setShowCategoryManager(false)} onUpdate={onCategoriesChange} />
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
    const accountCount = patrimony?.accounts?.length || 0;
    const catCount = (categories?.income?.length || 0) + (categories?.expense?.length || 0);
    const contextLine = useFinancialMonth
      ? `Ciclo: dia ${financialMonthStartDay} de cada mês`
      : catCount > 0 ? `${catCount} categorias ativas` : null;

    return (
      <div className="m-profile-page">
        <PageHeader title="Perfil" />

        {/* Compact profile header */}
        <div className="m-profile-header">
          <div className="m-profile-avatar">
            {userName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
          </div>
          <div className="m-profile-info">
            <div className="m-profile-name">{userName}</div>
            <div className="m-profile-email">{user.email}</div>
            {contextLine && <div className="m-profile-context">{contextLine}</div>}
          </div>
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

        {/* Ciclo Financeiro */}
        {onFinancialMonthChange && (
          <div className="m-menu-section">
            <div className="m-menu-section-label">Ciclo Financeiro</div>
            <div className="m-menu-group">
              <div className="m-menu-item m-fmonth-row">
                <div className="m-fmonth-left">
                  <span className="m-menu-text">Mês financeiro personalizado</span>
                  <span className="m-fmonth-hint">
                    {useFinancialMonth
                      ? `Dia ${financialMonthStartDay} → dia ${financialMonthStartDay - 1} do mês seguinte`
                      : 'Usa o mês calendário por omissão'}
                  </span>
                </div>
                <label className="m-toggle">
                  <input
                    type="checkbox"
                    checked={useFinancialMonth}
                    onChange={e => onFinancialMonthChange({ startDay: financialMonthStartDay, enabled: e.target.checked })}
                  />
                  <span className="m-toggle-track" />
                </label>
              </div>
              {useFinancialMonth && (
                <div className="m-menu-item m-fmonth-day-row">
                  <span className="m-fmonth-day-label">Início do ciclo</span>
                  <div className="m-fmonth-day-ctrl">
                    <input
                      type="number"
                      min="1"
                      max="28"
                      value={financialMonthStartDay}
                      onChange={e => onFinancialMonthChange({ startDay: parseInt(e.target.value) || 1, enabled: true })}
                      className="m-fmonth-day-input"
                    />
                    <span className="m-fmonth-day-unit">de cada mês</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Preferências */}
        <div className="m-menu-section">
          <div className="m-menu-section-label">Preferências</div>
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
          </div>
        </div>

        {/* Segurança */}
        <div className="m-menu-section">
          <div className="m-menu-section-label">Segurança</div>
          <div className="m-menu-group">
            <button className="m-menu-item" onClick={() => setShowResetPassword(true)}>
              <span className="m-menu-icon">⚿</span>
              <span className="m-menu-text">Alterar Password</span>
              <span className="m-menu-arrow">›</span>
            </button>
          </div>
        </div>

        {/* Logout */}
        <button className="m-logout-btn" onClick={onLogout}>Terminar Sessão</button>

        {/* Danger zone — isolated, low visual weight */}
        <div className="m-danger-zone">
          <button
            className="m-danger-item"
            onClick={() => { deleteSucceededRef.current = false; setShowDeleteHistory(true); resetDeleteDraft({ confirmText: '' }); setDeleteStatus(''); }}
          >
            <span className="m-danger-text">Apagar todos os dados</span>
          </button>
        </div>

        {renderProfileModals()}
      </div>
    );
  }

  /* ── DEFAULT BRANCH ──────────────────────────────────────────────────── */
  return (
    <div className="profile-tab">
      <PageHeader title="Perfil" />
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

      {/* Mês Financeiro */}
      {onFinancialMonthChange && (
        <div className="profile-section">
          <h3 className="section-title">Mês Financeiro</h3>
          <div style={{ padding: '0 4px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Ativar mês financeiro</label>
              <input
                type="checkbox"
                checked={useFinancialMonth}
                onChange={e => onFinancialMonthChange({ startDay: financialMonthStartDay, enabled: e.target.checked })}
                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
              />
            </div>
            {useFinancialMonth && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>Dia de início</label>
                <input
                  type="number"
                  min="1"
                  max="28"
                  value={financialMonthStartDay}
                  onChange={e => onFinancialMonthChange({ startDay: parseInt(e.target.value) || 1, enabled: true })}
                  className="date-input"
                  style={{ width: '64px', textAlign: 'center' }}
                />
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>de cada mês</span>
              </div>
            )}
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0 }}>
              {useFinancialMonth
                ? `Ciclo: dia ${financialMonthStartDay} → dia ${financialMonthStartDay - 1} do mês seguinte`
                : 'Agrupa por mês calendário (padrão)'}
            </p>
          </div>
        </div>
      )}

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
