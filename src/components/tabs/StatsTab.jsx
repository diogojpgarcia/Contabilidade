import React, { useState } from 'react';
import { Search, SlidersHorizontal } from 'lucide-react';

const TABS = ['Todas', 'Receitas', 'Despesas', 'Transferências'];

const StatsTab = ({
  transactions, filteredTransactions, currentMonth, onMonthChange,
  categories, budgets, onTransactionDeleted, onCategoryChange,
  onAccountChange, onTransactionEdited, patrimony, theme,
  financialMonthStartDay, onNavigate, financialFocus,
}) => {
  const [activeFilter, setActiveFilter] = useState('Todas');

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      minHeight: '100%',
      background: 'transparent',
    }}>

      {/* ── HEADER ── */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '16px 20px',
      }}>
        <span style={{
          fontFamily: 'Inter, -apple-system, sans-serif',
          fontSize: '24px',
          fontWeight: 600,
          color: '#FFFFFF',
          letterSpacing: '-0.02em',
        }}>
          Histórico
        </span>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button
            aria-label="Pesquisar transações"
            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex' }}
          >
            <Search size={20} color="#94A3B8" strokeWidth={1.75} />
          </button>
          <button
            aria-label="Filtrar transações"
            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex' }}
          >
            <SlidersHorizontal size={20} color="#94A3B8" strokeWidth={1.75} />
          </button>
        </div>
      </div>

      {/* ── TABS ── */}
      <div style={{
        display: 'flex',
        gap: '8px',
        padding: '0 20px 16px 20px',
      }}>
        {TABS.map((tab) => {
          const isActive = activeFilter === tab;
          return (
            <button
              key={tab}
              onClick={() => setActiveFilter(tab)}
              style={{
                background: isActive ? 'rgba(0,221,255,0.15)' : 'rgba(255,255,255,0.06)',
                border: isActive ? '1px solid rgba(0,221,255,0.3)' : '1px solid transparent',
                borderRadius: '20px',
                padding: '6px 16px',
                color: isActive ? '#00DDFF' : '#94A3B8',
                fontSize: '13px',
                fontWeight: isActive ? 500 : 400,
                fontFamily: 'Inter, -apple-system, sans-serif',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              {tab}
            </button>
          );
        })}
      </div>

      {/* ── CONTEÚDO (placeholder) ── */}
      <div style={{ flex: 1 }} />

    </div>
  );
};

export default StatsTab;
