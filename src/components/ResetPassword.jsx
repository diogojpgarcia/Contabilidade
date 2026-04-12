import React, { useState } from 'react';
import { authService } from '../lib/supabase';

const ResetPassword = ({ onComplete }) => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    setError('');

    if (password.length < 6) {
      setError('A password deve ter pelo menos 6 caracteres');
      return;
    }

    if (password !== confirmPassword) {
      setError('As passwords não coincidem');
      return;
    }

    setLoading(true);

    try {
      console.log('🔐 Atualizando password...');
      const { error } = await authService.supabase.auth.updateUser({
        password: password
      });

      if (error) throw error;

      console.log('✅ Password atualizada!');
      alert('✅ Password atualizada com sucesso! Vais ser redirecionado...');
      
      setTimeout(() => {
        onComplete();
      }, 1000);

    } catch (err) {
      console.error('❌ Erro:', err);
      setError(err.message || 'Erro ao atualizar password');
    } finally {
      setLoading(false);
    }
  };

  const handleButtonClick = () => {
    handleSubmit(null);
  };

  const canSubmit = password.length >= 6 && confirmPassword.length >= 6;

  return (
    <div className="reset-password-page">
      <div className="reset-container">
        <div className="reset-header">
          <h1>🔐 Nova Password</h1>
          <p>Define a tua nova password</p>
        </div>

        <form onSubmit={handleSubmit} className="reset-form">
          <div className="form-group">
            <label htmlFor="password">Nova Password</label>
            <div className="password-input-container">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                autoComplete="new-password"
                disabled={loading}
                autoFocus
                className={error ? 'error' : ''}
              />
              <b
