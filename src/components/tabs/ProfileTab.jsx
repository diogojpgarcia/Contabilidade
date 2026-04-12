import React from 'react';

const ProfileTab = ({ user, userName, onLogout }) => {
  return (
    <div style={{ padding: '1.5rem', textAlign: 'center' }}>
      <h2>👤 Profile Tab</h2>
      <p style={{ color: 'var(--text-secondary)', marginTop: '1rem' }}>
        Em construção... (Fase 5)
      </p>
      <button
        onClick={onLogout}
        style={{
          marginTop: '2rem',
          padding: '0.75rem 1.5rem',
          background: 'var(--danger)',
          color: 'white',
          border: 'none',
          borderRadius: '12px',
          cursor: 'pointer',
          fontWeight: '600'
        }}
      >
        🚪 Terminar Sessão
      </button>
    </div>
  );
};

export default ProfileTab;
