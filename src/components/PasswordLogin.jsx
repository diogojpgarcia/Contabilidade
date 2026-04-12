import React, { useState } from 'react';

const PasswordLogin = ({ user, onSuccess, onBack }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log('📝 Form submitted! Password length:', password.length);
    setError('');
    
    if (password.length < 4) {
      console.log('❌ Password muito curta');
      setError('A password deve ter pelo menos 4 caracteres');
      return;
    }

    console.log('✅ Chamando onSuccess...');
    onSuccess(password);
  };

  const canSubmit = password.length >= 4;

  return (
    <div className="password-login">
      <div className="login-header">
        <div className="user-avatar-large" style={{ '--user-color': user.color }}>
          {user.initials}
        </div>
        <h2>{user.name}</h2>
        <p>Introduz a tua password</p>
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
              autoComplete="current-password"
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
          {password.length > 0 && password.length < 4 && (
            <small style={{ color: 'orange' }}>Faltam {4 - password.length} caracteres</small>
          )}
        </div>

        {error && <div className="password-error">{error}</div>}

        <button 
          type="submit" 
          className={`btn-login ${canSubmit ? 'active' : ''}`}
          disabled={!canSubmit}
        >
          Entrar
        </button>

        {onBack && (
          <button 
            type="button" 
            onClick={onBack} 
            className="btn-back-link"
          >
            ← Voltar
          </button>
        )}
      </form>
    </div>
  );
};

export default PasswordLogin;
