import React, { useState } from 'react';
import { authService } from '../lib/supabase';

const CloudAuth = ({ onSuccess }) => {
  const [mode, setMode] = useState('login'); // 'login', 'signup', 'reset'
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
        // Password reset
        console.log('🔑 Enviando email de reset...');
        const { error } = await authService.supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin
        });
        
        if (error) throw error;
        
        setSuccess('✅ Email enviado! Verifica a tua caixa de entrada.');
        setEmail('');
        setTimeout(() => setMode('login'), 3000);
        
      } else if (mode === 'login') {
        console.log('🔑 Fazendo login...');
        const { user } = await authService.signIn(email, password);
        console.log('✅ Login sucesso!', user);
        onSuccess(user);
        
      } else {
        // Signup
        console.log('📝 Criando conta...');
        if (!fullName.trim()) {
          setError('Nome é obrigatório');
          setLoading(false);
          return;
        }
        const { user } = await authService.signUp(email, password, fullName);
        console.log('✅ Conta criada!', user);
        
        if (user) {
          onSuccess(user);
        } else {
          alert('✅ Conta criada! Verifica o teu email para confirmar e depois faz login.');
          setMode('login');
          setPassword('');
        }
      }
    } catch (err) {
      console.error('❌ Erro:', err);
      
      if (err.message.includes('Invalid login credentials')) {
        setError('Email ou password incorretos');
      } else if (err.message.includes('User already registered')) {
        setError('Este email já está registado. Faz login.');
        setMode('login');
      } else if (err.message.includes('Password should be at least')) {
        setError('A password deve ter pelo menos 6 caracteres');
      } else {
        setError(err.message || 'Erro ao processar pedido');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleButtonClick = () => {
    handleSubmit(null);
  };

  const canSubmit = mode === 'reset' 
    ? email.length > 0
    : email.length > 0 && password.length >= 6 && (mode === 'login' || fullName.trim().length > 0);

  return (
    <div className="cloud-auth">
      <div className="auth-header">
        <h1>💰 Finanças Familiares</h1>
        <p>
          {mode === 'login' && 'Bem-vindo de volta!'}
          {mode === 'signup' && 'Cria a tua conta'}
          {mode === 'reset' && 'Recuperar Password'}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="auth-form">
        {mode === 'signup' && (
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
            autoFocus
          />
        </div>

        {mode !== 'reset' && (
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <div className="password-input-container">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                disabled={loading}
                className={error ? 'error' : ''}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="btn-toggle-password-inside"
                tabIndex="-1"
              >
                {showPassword ? '👁️' : '👁️‍🗨️'}
              </button>
            </div>
            {password.length > 0 && password.length < 6 && (
              <small style={{ color: 'orange', display: 'block', marginTop: '0.5rem' }}>
                Faltam {6 - password.length} caracteres
              </small>
            )}
          </div>
        )}

        {error && <div className="auth-error">{error}</div>}
        {success && <div className="auth-success">{success}</div>}

        <button
          type="submit"
          onClick={handleButtonClick}
          className={`btn-auth ${canSubmit ? 'active' : ''}`}
          disabled={!canSubmit || loading}
        >
          {loading ? '⏳ Aguarda...' : (
            mode === 'login' ? '🔓 Entrar' :
            mode === 'signup' ? '✨ Criar Conta' :
            '📧 Enviar Email'
          )}
        </button>

        {mode === 'login' && (
          <>
            <button
              type="button"
              onClick={() => {
                setMode('signup');
                setError('');
                setSuccess('');
              }}
              className="btn-toggle-mode"
              disabled={loading}
            >
              Não tens conta? Cria aqui
            </button>
            
            <button
              type="button"
              onClick={() => {
                setMode('reset');
                setError('');
                setSuccess('');
                setPassword('');
              }}
              className="btn-forgot-password"
              disabled={loading}
            >
              Esqueci a password
            </button>
          </>
        )}

        {mode === 'signup' && (
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setError('');
              setSuccess('');
            }}
            className="btn-toggle-mode"
            disabled={loading}
          >
            Já tens conta? Faz login
          </button>
        )}

        {mode === 'reset' && (
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setError('');
              setSuccess('');
            }}
            className="btn-toggle-mode"
            disabled={loading}
          >
            ← Voltar ao login
          </button>
        )}
      </form>
    </div>
  );
};

export default CloudAuth;
