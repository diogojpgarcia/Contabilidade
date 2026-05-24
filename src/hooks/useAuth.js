import { useState, useEffect } from 'react';
import { authService } from '../lib/supabase';

/**
 * useAuth — responsável por toda a lógica de autenticação.
 * Expõe o utilizador atual, estado de loading, modo recovery,
 * e as actions: handleAuthSuccess, handleLogout, handleResetComplete.
 */
export function useAuth() {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isRecoveryMode, setIsRecoveryMode] = useState(false);

  useEffect(() => {
    checkUserSession();
    checkRecoveryMode();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const checkUserSession = async () => {
    try {
      const user = await authService.getCurrentUser();
      if (user) {
        console.log('✅ User session found:', user.email);
        setCurrentUser(user);
      }
    } catch {
      console.log('No active session');
    } finally {
      setLoading(false);
    }
  };

  const checkRecoveryMode = () => {
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    if (hashParams.get('type') === 'recovery') {
      console.log('🔐 Recovery mode detected!');
      setIsRecoveryMode(true);
      setLoading(false);
    }
  };

  const handleAuthSuccess = (user) => {
    console.log('🎉 Auth success!', user.email);
    setCurrentUser(user);
  };

  const handleLogout = async () => {
    try {
      await authService.signOut();
      setCurrentUser(null);
      console.log('👋 Logged out');
    } catch (error) {
      console.error('❌ Logout error:', error);
    }
  };

  const handleResetComplete = () => {
    console.log('✅ Reset complete, reloading...');
    setIsRecoveryMode(false);
    window.location.hash = '';
    window.location.reload();
  };

  return {
    currentUser,
    setCurrentUser,
    loading,
    isRecoveryMode,
    handleAuthSuccess,
    handleLogout,
    handleResetComplete,
  };
}
