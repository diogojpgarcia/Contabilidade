import React, { useState } from 'react';
import { authService } from '../lib/supabase';

const CloudAuth = ({ onSuccess }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        console.log('🔑 Fazendo login...');
        const { user } = await authService.signIn(email, password);
        console.log('✅ Login sucesso!', user);
        onSuccess(user);
      } else {
        console.log('📝 Criando conta...');
        if (!fullName.trim()) {
          setError('Nome é obrigatório');
          setLoading(false);
          return;
        }
        const { user } = await authService.signUp(email, password, fullName);
        console.log('✅ Conta criada!', user);
        // Supabase pode requerer confirmação de email
        if (user) {
          alert('Conta criada! Verifica o teu email para confirmar.');
          setIsLogin(true);
        }
      }
    } catch (err) {
      console.error('❌ Erro:', err);
      setError(err.message || 'Erro ao autenticar');
    } finally {
      setLoading(false);
    }
  };

  const handleButtonClick = () => {
    console.log('🖱️ Button clicked!');
    handleSubmit(null);
  };

  const canSubmit = email.length > 0 && password.length >= 6 && (!isLogin ? fullName.trim().length > 0 : true);

  return (
    <div className="cloud-auth">
      <div className="auth-header">
        <h1>💰 Finanças Familiares</h1>
        <p>{isLogin ? 'Acesso Multi-Dispositivo' : 'Criar Conta Cloud'}</p>
      </div>

      <form onSubmit={handleSubmit} className="auth-form">
        {!isLogin && (
          <div className="form-group">
            <label htmlFor="fullName">Nome Completo</label>
            <input
              id="fullName"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Ex: Diogo Garcia"
              autoComplete="name"
              disabled={loading}
            />
          </div>
        )}

        <div className="form-group">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="seu@email.com"
            autoComplete="email"
            disabled={loading}
          />
        </div>

        <div className="form-group">
          <label htmlFor="password">Password</label>
          <div className="password-input-wrapper">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 6 caracteres"
              autoComplete={isLogin ? 'current-password' : 'new-password'}
              disabled={loading}
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

        {error && <div className="auth-error">{error}</div>}

        <button
          type="submit"
          onClick={handleButtonClick}
          className={`btn-auth ${canSubmit ? 'active' : ''}`}
          disabled={!canSubmit || loading}
        >
          {loading ? '⏳ Aguarda...' : (isLogin ? '🔓 Entrar' : '✨ Criar Conta')}
        </button>

        <button
          type="button"
          onClick={() => {
            setIsLogin(!isLogin);
            setError('');
          }}
          className="btn-toggle-mode"
          disabled={loading}
        >
          {isLogin ? 'Não tens conta? Cria aqui' : 'Já tens conta? Login'}
        </button>
      </form>

      <div className="cloud-benefits">
        <p>✅ Sincronização automática</p>
        <p>✅ Acesso em qualquer dispositivo</p>
        <p>✅ Backup na cloud</p>
      </div>
    </div>
  );
};

export default CloudAuth;
