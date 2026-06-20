import React, { useState } from 'react';
import { authService, dbService } from '../../lib/supabase';
import CategoryManager from '../CategoryManager';
import Overlay from '../Overlay';
import { useForm } from '../../hooks/useForm';
import PageHeader from '../PageHeader';
import { useAppContext } from '../../context/AppContext';
import './ProfileTab.css';

const PALETTES = [
  { id: 'midnight', name: 'Midnight', bg: '#0b0d10', accent: '#06b6d4' },
  { id: 'dusk',     name: 'Dusk',     bg: '#121008', accent: '#c49a6c' },
  { id: 'stone',    name: 'Stone',    bg: '#f0ebe4', accent: '#9f6b48' },
];

const ProfileTab = ({ userName, onLogout, onNavigateToImport, onDataDeleted, colorPalette = 'midnight', setColorPalette, patrimony = {}, useFinancialMonth = false, financialMonthStartDay = 1, onFinancialMonthChange, homeUsesFinancialMonth = true, onHomeUsesFinancialMonthChange, usageMode = 'manual', onUsageModeChange, migrationPending = null, onMigrateConfirm, onMigrateDismiss, onExportOpen }) => {
  const { currentUser, categories, onCategoriesChange } = useAppContext();
  const user = currentUser; // alias para compatibilidade com referências existentes
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

  // Cosmos theme is always soft-future — enforced by App.jsx on load
  // palette changes are managed by App.jsx via colorPalette / setColorPalette props

  const handleResetPassword = async () => {
    if (!resetDraft.email) {
      setResetStatus('Por favor insere o teu email');
      return;
    }
    try {
      await authService.supabase.auth.resetPasswordForEmail(resetDraft.email, {
        redirectTo: window.location.origin,
      });
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

      {migrationPending && (
        <Overlay onClose={onMigrateDismiss}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Ligar Transações à Conta</h3>
              <button className="btn-close" onClick={onMigrateDismiss}>
                <span className="sf-icon">✕</span>
              </button>
            </div>
            <div className="modal-body">
              <p className="modal-description">
                Tens <strong>{migrationPending.count} transação(ões)</strong> sem conta associada.
              </p>
              <p className="modal-description">
                Queres aplicar <strong>"{migrationPending.accName}"</strong> a estas transações antigas?
              </p>
              <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                <button className="btn-primary full-width" onClick={onMigrateConfirm}>
                  Sim, ligar todas
                </button>
                <button className="btn-secondary full-width" onClick={onMigrateDismiss}>
                  Não, manter assim
                </button>
              </div>
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

      {/* Modo de utilização */}
      {onUsageModeChange && (
        <div style={{ marginTop: 10 }}>
          <div className="m-card">
            <div className="m-cycle-title" style={{ marginBottom: 4 }}>Como usas a app?</div>
            <p style={{ fontSize: '0.78rem', color: 'var(--cosmos-text-3)', margin: '0 0 12px', lineHeight: 1.45 }}>
              Define de onde vêm os teus dados. Isto muda a forma como as transações entram e como as recorrentes se comportam — escolhe o que mais se parece contigo.
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              {[
                { id: 'extrato', label: 'Importo extratos', desc: 'Atualizo de tempos a tempos' },
                { id: 'manual',  label: 'Lanço à mão',      desc: 'Registo cada transação' },
              ].map(opt => {
                const on = usageMode === opt.id;
                return (
                  <button
                    key={opt.id}
                    onClick={() => onUsageModeChange(opt.id)}
                    style={{
                      flex: 1, textAlign: 'left', padding: '12px', borderRadius: 12, cursor: 'pointer',
                      border: on ? '1.5px solid var(--cosmos-accent)' : '1.5px solid var(--cosmos-border-divider)',
                      background: on ? 'var(--cosmos-accent-soft, rgba(6,182,212,0.10))' : 'var(--cosmos-surface-2)',
                      color: 'var(--cosmos-text-1)', fontFamily: 'inherit',
                    }}
                  >
                    <div style={{ fontSize: '0.86rem', fontWeight: 600 }}>{opt.label}</div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--cosmos-text-3)', marginTop: 2 }}>{opt.desc}</div>
                  </button>
                );
              })}
            </div>

            {/* Explicação do modo selecionado */}
            <div style={{
              marginTop: 10, padding: '10px 12px', borderRadius: 10,
              background: 'var(--cosmos-surface-2)', fontSize: '0.76rem',
              color: 'var(--cosmos-text-2)', lineHeight: 1.5,
            }}>
              {usageMode === 'extrato' ? (
                <>
                  <strong style={{ color: 'var(--cosmos-text-1)' }}>Importo extratos:</strong> a verdade está no teu banco e a app é um espelho que atualizas quando importas. As <strong>recorrentes servem de lembrete</strong> e <strong>associam-se</strong> à transação que importas — nunca criam um registo duplicado.
                </>
              ) : (
                <>
                  <strong style={{ color: 'var(--cosmos-text-1)' }}>Lanço à mão:</strong> a app é o teu registo principal e cada transação entra por ti. Ao confirmar uma recorrente, a app <strong>cria a transação</strong> automaticamente, para não teres de a escrever.
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Appearance */}
      <span className="m-section-label">Aparência</span>
      <div className="m-card">
        <div className="m-palette-row">
          {PALETTES.map(p => (
            <button
              key={p.id}
              className={`m-palette-swatch${colorPalette === p.id ? ' m-palette-swatch--active' : ''}`}
              onClick={() => setColorPalette?.(p.id)}
              aria-label={`Palette ${p.name}`}
            >
              <span className="m-palette-preview" style={{ background: p.bg }}>
                <span className="m-palette-dot" style={{ background: p.accent }} />
              </span>
              <span className="m-palette-name">{p.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Export */}
      {onExportOpen && (
        <>
          <span className="m-section-label">Relatórios</span>
          <div className="m-card">
            <button className="m-flat-row" onClick={onExportOpen}>
              <div className="m-flat-row-icon">
                <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
              </div>
              <div className="m-flat-row-body">
                <span className="m-flat-row-title">Exportar Relatório PDF</span>
                <span className="m-flat-row-sub">Resumo mensal, trimestral ou anual com análise AI</span>
              </div>
              <span className="m-flat-row-chev">›</span>
            </button>
          </div>
        </>
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
