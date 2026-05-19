import React, { useState, useEffect } from 'react';
import { authService, dbService } from '../../lib/supabase';
import CategoryManager from '../CategoryManager';
import Overlay from '../Overlay';
import { useForm } from '../../hooks/useForm';
import PageHeader from '../PageHeader';
import './ProfileTab.css';

const ProfileTab = ({ user, userName, onLogout, onNavigateToImport, onDataDeleted, theme, setTheme, categories, onCategoriesChange, patrimony = {}, defaultAccount, onDefaultAccountChange, useFinancialMonth = false, financialMonthStartDay = 1, onFinancialMonthChange, financialFocus = null, onFocusChange, homeUsesFinancialMonth = true, onHomeUsesFinancialMonthChange }) => {
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const deleteSucceededRef = React.useRef(false);
  const [showDeleteHistory, setShowDeleteHistory] = useState(false);
  const [deleteStatus, setDeleteStatus]           = useState('');
  const [deleting, setDeleting]                   = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [resetStatus, setResetStatus]             = useState('');

  // Modal form drafts — onChange → local only; DB/auth called on submit
  const { draft: deleteDraft, setField: setDeleteField, reset: resetDeleteDraft } = useForm({ confirmText: '' });
  const { draft: resetDraft,  setField: setResetField,  reset: resetResetDraft  } = useForm({ email: '' });

  // Cosmos is the only theme — always enforce soft-future on mount
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'soft-future');
    if (user?.id) {
      dbService.getUserSettings(user.id).then(settings => {
        if (settings?.color_theme !== 'soft-future') {
          dbService.updateUserSettings(user.id, { color_theme: 'soft-future' }).catch(console.error);
        }
      }).catch(console.error);
    }
  }, [user]);

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

  /* ── RENDER ─────────────────────────────────────────────────────────────── */
  const accountCount = patrimony?.accounts?.length || 0;
  const catCount = (categories?.income?.length || 0) + (categories?.expense?.length || 0);
  const endDay = financialMonthStartDay <= 1 ? 28 : financialMonthStartDay - 1;
  const decDay = () => onFinancialMonthChange?.({ startDay: Math.max(1, financialMonthStartDay - 1), enabled: true });
  const incDay = () => onFinancialMonthChange?.({ startDay: Math.min(28, financialMonthStartDay + 1), enabled: true });

  return (
    <div className="m-profile-page">
      <PageHeader title="Perfil" />

      {/* Identity card */}
      <div className="m-prof-card">
        <div className="m-prof-identity">
          <div className="m-prof-avatar">
            {userName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
          </div>
          <div>
            <span className="m-prof-name">{userName}</span>
            <span className="m-prof-email">{user.email}</span>
          </div>
        </div>
        {(accountCount > 0 || catCount > 0 || useFinancialMonth) && (
          <div className="m-prof-chips">
            {accountCount > 0 && (
              <span className="m-prof-chip">
                <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
                {accountCount} conta{accountCount !== 1 ? 's' : ''}
              </span>
            )}
            {catCount > 0 && (
              <span className="m-prof-chip">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
                {catCount} categori{catCount !== 1 ? 'as' : 'a'}
              </span>
            )}
            {useFinancialMonth && (
              <span className="m-prof-chip m-prof-chip--on">
                <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                Dia {financialMonthStartDay}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Financial cycle */}
      {onFinancialMonthChange && (
        <div style={{ marginTop: 10 }}>
          <div className="m-card">
            <div className="m-cycle-header">
              <div>
                <div className="m-cycle-title">Ciclo Financeiro</div>
                {useFinancialMonth && (
                  <span className="m-cycle-badge">dia {financialMonthStartDay} → {endDay}</span>
                )}
              </div>
              <label className="m-pill-toggle">
                <input
                  type="checkbox"
                  checked={useFinancialMonth}
                  onChange={e => onFinancialMonthChange({ startDay: financialMonthStartDay, enabled: e.target.checked })}
                />
                <span className="m-pill-toggle-track" />
              </label>
            </div>
            {useFinancialMonth ? (
              <div className="m-cycle-body">
                <div className="m-cycle-day-row">
                  <span className="m-cycle-day-label">Início de cada ciclo</span>
                  <div className="m-cycle-stepper">
                    <button className="m-cycle-step" onClick={decDay} aria-label="Diminuir">−</button>
                    <span className="m-cycle-day-val">{financialMonthStartDay}</span>
                    <button className="m-cycle-step" onClick={incDay} aria-label="Aumentar">+</button>
                  </div>
                </div>
                <div className="m-cycle-desc">
                  Cada ciclo: dia {financialMonthStartDay} → dia {endDay} do mês seguinte
                </div>
                <div className="m-cycle-divider" />
                <div className="m-cycle-home-row">
                  <span className="m-cycle-home-label">Cartão Home usa o ciclo</span>
                  <label className="m-pill-toggle">
                    <input
                      type="checkbox"
                      checked={homeUsesFinancialMonth}
                      onChange={e => onHomeUsesFinancialMonthChange?.(e.target.checked)}
                    />
                    <span className="m-pill-toggle-track" />
                  </label>
                </div>
              </div>
            ) : (
              <p className="m-cycle-off">Agrupa por mês calendário padrão</p>
            )}
          </div>
        </div>
      )}

      {/* Preferences */}
      <span className="m-section-label">Preferências</span>
      <div className="m-card">
        <button className="m-flat-row" onClick={() => setShowCategoryManager(true)}>
          <div className="m-flat-row-icon">
            <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
          </div>
          <div className="m-flat-row-body">
            <span className="m-flat-row-title">Gerir Categorias</span>
            <span className="m-flat-row-sub">{catCount} categorias activas</span>
          </div>
          <span className="m-flat-row-chev">›</span>
        </button>
        <button className="m-flat-row" onClick={() => onNavigateToImport && onNavigateToImport()}>
          <div className="m-flat-row-icon">
            <svg viewBox="0 0 24 24" aria-hidden="true"><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/></svg>
          </div>
          <div className="m-flat-row-body">
            <span className="m-flat-row-title">Importar Extracto</span>
            <span className="m-flat-row-sub">CSV, OFX, PDF</span>
          </div>
          <span className="m-flat-row-chev">›</span>
        </button>
      </div>

      {/* Security */}
      <span className="m-section-label">Segurança</span>
      <div className="m-card">
        <button className="m-flat-row" onClick={() => setShowResetPassword(true)}>
          <div className="m-flat-row-icon">
            <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          </div>
          <div className="m-flat-row-body">
            <span className="m-flat-row-title">Alterar Password</span>
            <span className="m-flat-row-sub">Enviar link de recuperação</span>
          </div>
          <span className="m-flat-row-chev">›</span>
        </button>
      </div>

      {/* Logout */}
      <button className="m-logout-btn" onClick={onLogout}>Terminar Sessão</button>

      {/* Danger zone */}
      <div className="m-danger-zone">
        <button
          className="m-danger-item"
          onClick={() => { deleteSucceededRef.current = false; setShowDeleteHistory(true); resetDeleteDraft({ confirmText: '' }); setDeleteStatus(''); }}
        >
          Apagar todos os dados
        </button>
      </div>

      {renderProfileModals()}
    </div>
  );
};

export default ProfileTab;
