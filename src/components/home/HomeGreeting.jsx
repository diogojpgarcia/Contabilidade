import React from 'react';
import { Bell } from 'lucide-react';

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Bom dia';
  if (hour < 19) return 'Boa tarde';
  return 'Boa noite';
}

const HomeGreeting = ({ name = 'Diogo' }) => (
  <div style={{
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 16px',
  }}>
    <span style={{
      fontFamily: 'Inter, -apple-system, sans-serif',
      fontSize: '14px',
      fontWeight: 400,
      color: '#94A3B8',
    }}>
      {getGreeting()}, {name}
    </span>
    <Bell size={20} color="#94A3B8" strokeWidth={1.75} aria-label="Notificações" />
  </div>
);

export default HomeGreeting;
