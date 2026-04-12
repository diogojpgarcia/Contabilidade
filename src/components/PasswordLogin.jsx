import React, { useState } from 'react';

const PasswordLogin = ({ user, onSuccess, onBack }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    if (password.length < 4) {
      setError('A password deve ter pelo menos 4 caracteres');
      return;
    }

    setIsLoading(true);
    
    // Simulate async validation
    setTimeout(() => {
      onSuccess(password);
      setIsLoading(false);
    }, 300);
  };

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
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoFocus
            autoComplete="current-password"
            className={error ? 'error' : ''}
            disabled={isLoading}
          />
        </div>

        {error && <div className="password-error">{error}</div>}

        <button 
          type="submit" 
          className="btn-login"
          disabled={isLoading || password.length === 0}
        >
          {isLoading ? 'A entrar...' : 'Entrar'}
        </button>

        {onBack && (
          <button 
            type="button" 
            onClick={onBack} 
            className="btn-back-link"
            disabled={isLoading}
          >
            ← Voltar
          </button>
        )}
      </form>
    </div>
  );
};

export default PasswordLogin;
