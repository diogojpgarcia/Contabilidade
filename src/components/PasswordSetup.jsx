import React, { useState } from 'react';

const PasswordSetup = ({ user, onComplete, onBack, onSwitchToLogin }) => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    console.log('🔐 Setup submit! Passwords:', password.length, confirmPassword.length);
    setError('');

    if (password.length < 4) {
      setError('A password deve ter pelo menos 4 caracteres');
      return;
    }

    if (password !== confirmPassword) {
      setError('As passwords não coincidem');
      return;
    }

    console.log('✅ Calling onComplete...');
    onComplete(password);
  };

  const handleButtonClick = () => {
    console.log('🖱️ Create button clicked!');
    handleSubmit(null);
  };

  const canSubmit = password.length >= 4 && confirmPassword.length >= 4;

  return (
    <div className="password-setup">
      <div className="setup-header">
        <div className="user-avatar-large" style={{ '--user-color': user.color }}>
          {user.initials}
        </div>
        <h2>{user.name}</h2>
        <p>Cria a tua password</p>
      </div>

      <form onSubmit={handleSubmit} className="password-form">
        <div className="form-group">
          <label htmlFor="password">Password</label>
          <div className="password-input-wrapper">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 4 caracteres"
              autoFocus
              autoComplete="new-password"
              className={error ? 'error' : ''}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="btn-toggle-password"
              tabIndex="-1"
            >
              {showPassword ? '👁️' : '👁️‍🗨️'}
            </button>
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="confirm-password">Confirmar Password</label>
          <input
            id="confirm-password"
            type={showPassword ? 'text' : 'password'}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Repete a password"
            autoComplete="new-password"
            className={error ? 'error' : ''}
          />
        </div>

        {error && <div className="password-error">{error}</div>}

        <button 
          type="submit"
          onClick={handleButtonClick}
          className={`btn-create ${canSubmit ? 'active' : ''}`}
          disabled={!canSubmit}
        >
          Criar Conta
        </button>

        {onSwitchToLogin && (
          <button
            type="button"
            onClick={onSwitchToLogin}
            className="btn-switch-mode"
          >
            Já tens conta? Faz login aqui
          </button>
        )}

        {onBack && (
          <button type="button" onClick={onBack} className="btn-back-link">
            ← Voltar
          </button>
        )}
      </form>
    </div>
  );
};

export default PasswordSetup;
