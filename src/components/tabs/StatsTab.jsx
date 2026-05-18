import React, { useState } from 'react';
import { Search, SlidersHorizontal } from 'lucide-react';

const TABS = ['Todas', 'Receitas', 'Despesas', 'Transferências'];

const transacoes = [
  {
    id: 1, data: 'Hoje',
    items: [
      { id: 1, nome: 'Saúde', categoria: 'Médico', valor: -255.00, conta: 'Santander', cor: '#EF4444', inicial: 'S' },
      { id: 2, nome: 'Transferência', categoria: 'Transferência', valor: -53.00, conta: 'Santander', cor: '#8B5CF6', inicial: 'T' },
    ],
  },
  {
    id: 2, data: 'Ontem',
    items: [
      { id: 3, nome: 'Supermercado', categoria: 'Alimentação', valor: -48.65, conta: 'Santander', cor: '#F59E0B', inicial: 'S' },
      { id: 4, nome: 'Netflix', categoria: 'Entretenimento', valor: -15.99, conta: 'Santander', cor: '#EF4444', inicial: 'N' },
    ],
  },
  {
    id: 3, data: '1 de maio',
    items: [
      { id: 5, nome: 'Salário', categoria: 'Receita', valor: +2500.00, conta: 'Santander', cor: '#22C55E', inicial: 'S' },
    ],
  },
];

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

      {/* ── LISTA DE TRANSAÇÕES ── */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '0 20px 80px 20px',
        WebkitOverflowScrolling: 'touch',
      }}>
        {transacoes.map((grupo) => (
          <div key={grupo.id}>

            {/* Header do grupo */}
            <p style={{
              fontFamily: 'Inter, -apple-system, sans-serif',
              fontSize: '12px',
              fontWeight: 600,
              color: '#94A3B8',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              margin: '16px 0 8px 0',
            }}>
              {grupo.data}
            </p>

            {/* Rows de transação */}
            {grupo.items.map((tx, idx) => {
              const isLast = idx === grupo.items.length - 1;
              const isPositive = tx.valor >= 0;
              const valorFmt = isPositive
                ? '+' + tx.valor.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '€'
                : tx.valor.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '€';

              return (
                <div
                  key={tx.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '12px 0',
                    borderBottom: isLast ? 'none' : '1px solid rgba(255,255,255,0.05)',
                  }}
                >
                  {/* Ícone */}
                  <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    flexShrink: 0,
                    background: tx.cor + '26', /* 15% opacity hex */
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <span style={{
                      fontFamily: 'Inter, -apple-system, sans-serif',
                      fontSize: '14px',
                      fontWeight: 700,
                      color: tx.cor,
                    }}>
                      {tx.inicial}
                    </span>
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{
                      fontFamily: 'Inter, -apple-system, sans-serif',
                      fontSize: '15px',
                      fontWeight: 500,
                      color: '#FFFFFF',
                      margin: 0,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {tx.nome}
                    </p>
                    <p style={{
                      fontFamily: 'Inter, -apple-system, sans-serif',
                      fontSize: '12px',
                      fontWeight: 400,
                      color: '#94A3B8',
                      margin: '2px 0 0 0',
                    }}>
                      {tx.categoria}
                    </p>
                  </div>

                  {/* Valor */}
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <p style={{
                      fontFamily: 'Inter, -apple-system, sans-serif',
                      fontSize: '15px',
                      fontWeight: 600,
                      color: isPositive ? '#22C55E' : '#FFFFFF',
                      margin: 0,
                    }}>
                      {valorFmt}
                    </p>
                    <p style={{
                      fontFamily: 'Inter, -apple-system, sans-serif',
                      fontSize: '11px',
                      fontWeight: 400,
                      color: '#94A3B8',
                      margin: '2px 0 0 0',
                    }}>
                      {tx.conta}
                    </p>
                  </div>

                </div>
              );
            })}

          </div>
        ))}
      </div>

    </div>
  );
};

export default StatsTab;
