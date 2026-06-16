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

    // Mantém o utilizador sincronizado com a sessão real: token refresh,
    // expiração, e logout/login noutro separador propagam para esta árvore.
    // (Só chamamos setState dentro do callback — seguro, sem deadlock.)
    const { data: { subscription } } = authService.onAuthStateChange((_event, session) => {
      setCurrentUser(session?.user ?? null);
    });
    return () => subscription?.unsubscribe();
  }, []);  

  const checkUserSession = async () => {
    try {
      const user = await authService.getCurrentUser();
      if (user) {
        setCurrentUser(user);
      }
    } catch {
    } finally {
      setLoading(false);
    }
  };

  const checkRecoveryMode = () => {
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    if (hashParams.get('type') === 'recovery') {
      setIsRecoveryMode(true);
      setLoading(false);
    }
  };

  const handleAuthSuccess = (user) => {
    setCurrentUser(user);
  };

  const handleLogout = async () => {
    try {
      await authService.signOut();
      setCurrentUser(null);
    } catch (error) {
      console.error('❌ Logout error:', error);
    }
  };

  const handleResetComplete = () => {
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
