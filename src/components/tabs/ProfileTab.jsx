import React, { useState, useEffect } from 'react';
import { authService } from '../../lib/supabase';
import CategoryManager from '../CategoryManager';
import './ProfileTab.css';

const ProfileTab = ({ user, userName, onLogout }) => {
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [theme, setTheme] = useState('dark');
  const [resetEmail, setResetEmail] = useState('');
  const [resetStatus, setResetStatus] = useState('');

  useEffect(() => {
    // Load theme from localStorage
    const savedTheme = localStorage.getItem('app-theme') || 'dark';
    setTheme(savedTheme);
    applyTheme(savedTheme);
  }, []);

  const applyTheme = (newTheme) => {
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('app-theme', newTheme);
  };

  const handleThemeChange = (newTheme) => {
    setTheme(newTheme);
    applyTheme(newTheme);
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
            className={`theme-option ${theme === 'light' ? 'active' : ''}`}
            onClick={() => handleThemeChange('light')}
          >
            <span className="sf-icon">☀︎</span>
            <span>Claro</span>
          </button>
          <button
            className={`theme-option ${theme === 'auto' ? 'active' : ''}`}
            onClick={() => handleThemeChange('auto')}
          >
            <span className="sf-icon">◐</span>
            <span>Auto</span>
          </button>
          <button
            className={`theme-option ${theme === 'dark' ? 'active' : ''}`}
            onClick={() => handleThemeChange('dark')}
          >
            <span className="sf-icon">☾</span>
            <span>Escuro</span>
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
          onClick={() => setShowResetPassword(true)}
        >
          <span className="option-icon-sf">⚿</span>
          <span className="option-label">Alterar Password</span>
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
