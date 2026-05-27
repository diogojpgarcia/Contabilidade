import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { registerToastHandlers } from '../utils/toast';

const ToastContext = createContext(null);

let _nextId = 1;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const remove = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const add = useCallback((message, type = 'error', duration = 4000) => {
    const id = _nextId++;
    setToasts(prev => [...prev.slice(-4), { id, message, type }]);
    if (duration > 0) setTimeout(() => remove(id), duration);
    return id;
  }, [remove]);

  const showError   = useCallback((msg) => add(msg, 'error',   5000), [add]);
  const showSuccess = useCallback((msg) => add(msg, 'success', 3000), [add]);
  const showWarning = useCallback((msg) => add(msg, 'warning', 4000), [add]);

  useEffect(() => {
    registerToastHandlers({ showError, showSuccess, showWarning });
  }, [showError, showSuccess, showWarning]);

  return (
    <ToastContext.Provider value={{ showError, showSuccess, showWarning }}>
      {children}
      <ToastContainer toasts={toasts} onRemove={remove} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast deve ser usado dentro de <ToastProvider>');
  return ctx;
}

const ICONS = { error: '✕', success: '✓', warning: '⚠' };
const COLORS = {
  error:   { bg: '#dc2626', border: '#b91c1c' },
  success: { bg: '#16a34a', border: '#15803d' },
  warning: { bg: '#d97706', border: '#b45309' },
};

function ToastContainer({ toasts, onRemove }) {
  if (toasts.length === 0) return null;
  return (
    <div style={{
      position: 'fixed',
      bottom: 'calc(var(--cosmos-nav-h, 55px) + max(0px, env(safe-area-inset-bottom)) + 8px)',
      left: '50%', transform: 'translateX(-50%)',
      display: 'flex', flexDirection: 'column', gap: 8,
      zIndex: 9999, width: 'min(360px, 92vw)', pointerEvents: 'none',
    }}>
      {toasts.map(t => (
        <div key={t.id} style={{
          display: 'flex', alignItems: 'flex-start', gap: 10,
          padding: '12px 14px', borderRadius: 12,
          background: COLORS[t.type].bg,
          border: `1px solid ${COLORS[t.type].border}`,
          boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
          color: '#fff', fontSize: '0.875rem', fontWeight: 500,
          lineHeight: 1.4, pointerEvents: 'all',
          animation: 'toast-in 0.2s ease',
        }}>
          <span style={{ flexShrink: 0, fontWeight: 700 }}>{ICONS[t.type]}</span>
          <span style={{ flex: 1 }}>{t.message}</span>
          <button onClick={() => onRemove(t.id)} style={{
            flexShrink: 0, background: 'none', border: 'none',
            color: 'rgba(255,255,255,0.8)', cursor: 'pointer',
            fontSize: '1rem', padding: 0, lineHeight: 1,
          }}>×</button>
        </div>
      ))}
      <style>{`@keyframes toast-in { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:none; } }`}</style>
    </div>
  );
}
