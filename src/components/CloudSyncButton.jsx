import React, { useState } from 'react';
import { authService, dbService } from '../lib/supabase';

const CloudSyncButton = ({ localTransactions, onSyncComplete }) => {
  const [showModal, setShowModal] = useState(false);
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const handleAuth = async () => {
    setError('');
    setLoading(true);

    try {
      let user;
      if (isLogin) {
        console.log('🔑 Cloud login...');
        const result = await authService.signIn(email, password);
        user = result.user;
      } else {
        console.log('📝 Cloud signup...');
        if (!fullName.trim()) {
          setError('Nome é obrigatório');
          setLoading(false);
          return;
        }
        const result = await authService.signUp(email, password, fullName);
        user = result.user;
        
        if (!user) {
          alert('✅ Conta criada! Verifica o teu email para confirmar.');
          setIsLogin(true);
          setLoading(false);
          return;
        }
      }

      // Auth success - agora sincronizar dados
      console.log('✅ Autenticado! User:', user.id);
      await syncToCloud(user.id);
      
    } catch (err) {
      console.error('❌ Erro auth:', err);
      setError(err.message || 'Erro ao autenticar');
    } finally {
      setLoading(false);
    }
  };

  const syncToCloud = async (userId) => {
    setSyncing(true);
    setError('');

    try {
      console.log('☁️ Sincronizando', localTransactions.length, 'transações...');

      // 1. Buscar transações existentes na cloud
      const cloudTransactions = await dbService.getTransactions(userId);
      console.log('📥 Cloud tem', cloudTransactions.length, 'transações');

      // 2. Upload transações locais que não existem na cloud
      let uploaded = 0;
      for (const transaction of localTransactions) {
        // Verificar se já existe (por date + amount + description)
        const exists = cloudTransactions.find(ct => 
          ct.date === transaction.date && 
          ct.amount === transaction.amount &&
          ct.description === transaction.description
        );

        if (!exists) {
          await dbService.addTransaction(userId, {
            amount: transaction.amount,
            type: transaction.type,
            category: transaction.category,
            subcategory: transaction.subcategory || null,
            description: transaction.description || '',
            date: transaction.date
          });
          uploaded++;
        }
      }

      console.log('✅ Sync completo!', uploaded, 'novas transações enviadas');
      
      alert(`✅ Sincronização completa!\n\n${uploaded} transações enviadas para cloud\n${cloudTransactions.length} já existiam\n\nAgora podes aceder de qualquer dispositivo!`);
      
      setShowModal(false);
      if (onSyncComplete) {
        onSyncComplete(userId);
      }

    } catch (err) {
      console.error('❌ Erro sync:', err);
      setError('Erro ao sincronizar: ' + err.message);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <>
      <button 
        onClick={() => setShowModal(true)}
        className="btn-cloud-sync"
        title="Sincronizar com Cloud"
      >
        ☁️
      </button>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>☁️ Sincronização Cloud</h2>
              <button onClick={() => setShowModal(false)} className="btn-close">✕</button>
            </div>

            <div className="modal-body">
              <p className="cloud-info">
                {isLogin 
                  ? '🔑 Faz login para sincronizar os teus dados'
                  : '✨ Cria uma conta para aceder de qualquer dispositivo'
                }
              </p>

              {!isLogin && (
                <div className="form-group">
                  <label>Nome Completo</label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Ex: Diogo Garcia"
                    disabled={loading || syncing}
                  />
                </div>
              )}

              <div className="form-group">
                <label>Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  disabled={loading || syncing}
                />
              </div>

              <div className="form-group">
                <label>Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  disabled={loading || syncing}
                />
              </div>

              {error && <div className="sync-error">{error}</div>}

              <button
                onClick={handleAuth}
                className="btn-sync-action"
                disabled={loading || syncing || !email || password.length < 6}
              >
                {syncing ? '⏳ Sincronizando...' : (loading ? '⏳ Autenticando...' : (isLogin ? '🔓 Entrar & Sincronizar' : '✨ Criar & Sincronizar'))}
              </button>

              <button
                onClick={() => {
                  setIsLogin(!isLogin);
                  setError('');
                }}
                className="btn-toggle-auth"
                disabled={loading || syncing}
              >
                {isLogin ? 'Não tens conta? Cria aqui' : 'Já tens conta? Login'}
              </button>

              <div className="sync-benefits">
                <p><strong>✅ Benefícios:</strong></p>
                <p>• Acesso multi-dispositivo</p>
                <p>• Backup automático</p>
                <p>• Sincronização instantânea</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default CloudSyncButton;
