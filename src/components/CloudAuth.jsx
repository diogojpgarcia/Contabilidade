import React, { useState } from 'react';
import { authService } from '../lib/supabase';
import './CloudAuth.css';

const CloudAuth = ({ onSuccess }) => {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    setError('');
    setSuccess('');
    setLoading(true);

    try {
      if (mode === 'reset') {
        const { error } = await authService.supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin
        });
        
        if (error) throw error;
        
        setSuccess('Email enviado! Verifica a tua caixa de entrada.');
        setEmail('');
        setTimeout(() => setMode('login'), 3000);
        
      } else if (mode === 'login') {
        const { user } = await authService.signIn(email, password);
        onSuccess(user);
        
      } else {
        if (!fullName.trim()) {
          setError('Nome é obrigatório');
          setLoading(false);
          return;
        }
        
        const { user } = await authService.signUp(email, password, fullName);
        setSuccess('Conta criada! Verifica o email para confirmar.');
        setTimeout(() => {
          setMode('login');
          setEmail('');
          setPassword('');
          setFullName('');
        }, 3000);
      }
    } catch (err) {
      console.error('Erro:', err);
      
      if (err.message.includes('Invalid login credentials')) {
        setError('Email ou password incorretos');
      } else if (err.message.includes('User already registered')) {
        setError('Este email já está registado');
        setMode('login');
      } else if (err.message.includes('Password should be at least')) {
        setError('Password deve ter pelo menos 6 caracteres');
      } else {
        setError(err.message || 'Erro ao processar pedido');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-logo">💰</div>
          <h1 className="auth-title">Finanças Familiares</h1>
          <p className="auth-subtitle">
            {mode === 'login' && 'Bem-vindo de volta!'}
            {mode === 'signup' && 'Cria a tua conta'}
            {mode === 'reset' && 'Recuperar password'}
          </p>
        </div>

        {error && (
          <div className="alert alert-error">
            ⚠️ {error}
          </div>
        )}

        {success && (
          <div className="alert alert-success">
            ✓ {success}
          </div>
        )}

        <form className="auth-form" onSubmit={handleSubmit}>
          {mode === 'signup' && (
            <div className="form-group">
              <label className="form-label">Nome completo</label>
              <input
                type="text"
                className="form-input"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="O teu nome"
                required
                disabled={loading}
              />
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Email</label>
            <input
              type="email"
              className="form-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="exemplo@email.com"
              required
              disabled={loading}
            />
          </div>

          {mode !== 'reset' && (
            <div className="form-group">
              <label className="form-label">Password</label>
              <div className="form-input-wrapper">
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="form-input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  required
                  minLength={6}
                  style={{ paddingRight: '3rem' }}
                  disabled={loading}
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? '🙈' : '👁️'}
                </button>
              </div>
            </div>
          )}

          <button
            type="submit"
            className="btn-primary"
            disabled={loading}
          >
            {loading && <span className="spinner"></span>}
            {!loading && mode === 'login' && 'Entrar'}
            {!loading && mode === 'signup' && 'Criar conta'}
            {!loading && mode === 'reset' && 'Enviar email'}
            {loading && 'A processar...'}
          </button>

          {mode === 'login' && (
            <>
              <div className="auth-divider">ou</div>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setMode('signup')}
                disabled={loading}
              >
                Criar nova conta
              </button>
            </>
          )}

          <div className="auth-links">
            {mode !== 'reset' && (
              <button
                type="button"
                className="auth-link"
                onClick={() => setMode('reset')}
                disabled={loading}
              >
                Esqueci a password
              </button>
            )}
            {mode !== 'login' && (
              <button
                type="button"
                className="auth-link"
                onClick={() => {
                  setMode('login');
                  setError('');
                  setSuccess('');
                }}
                disabled={loading}
              >
                Já tenho conta
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

export default CloudAuth;
