import React, { useState } from 'react';

const PasswordLogin = ({ user, onSuccess, onBack }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    console.log('📝 handleSubmit called! Password:', password.length);
    setError('');
    
    if (password.length < 4) {
      console.log('❌ Password too short');
      setError('A password deve ter pelo menos 4 caracteres');
      return;
    }

    console.log('✅ Calling onSuccess...');
    onSuccess(password);
  };

  // Mobile-friendly: Direct click handler (não depende de form submit)
  const handleButtonClick = () => {
    console.log('🖱️ Button clicked directly!');
    handleSubmit(null);
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
              onKeyPress={(e) => {
                if (e.key === 'Enter' && canSubmit) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
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
            <small style={{ color: 'orange', display: 'block', marginTop: '0.5rem' }}>
              Faltam {4 - password.length} caracteres
            </small>
          )}
        </div>

        {error && <div className="password-error">{error}</div>}

        {/* Botão com DUPLO handler: submit E click direto */}
        <button 
          type="submit"
          onClick={handleButtonClick}
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
