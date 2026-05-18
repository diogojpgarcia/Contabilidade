import React, { useState, useMemo } from 'react';
import { Search, SlidersHorizontal } from 'lucide-react';

const TABS = [
  { id: 'all',      label: 'Todas' },
  { id: 'income',   label: 'Receitas' },
  { id: 'expense',  label: 'Despesas' },
  { id: 'transfer', label: 'Transferências' },
];

function formatValor(amount, type) {
  const valor = amount.toLocaleString('pt-PT', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  if (type === 'income')   return `+${valor}€`;
  if (type === 'transfer') return `↔ ${valor}€`;
  return `-${valor}€`;
}

function formatDataLabel(dateStr) {
  const hoje = new Date();
  const ontem = new Date();
  ontem.setDate(ontem.getDate() - 1);
  const data = new Date(dateStr + 'T00:00:00');
  if (data.toDateString() === hoje.toDateString()) return 'Hoje';
  if (data.toDateString() === ontem.toDateString()) return 'Ontem';
  return data.toLocaleDateString('pt-PT', { day: 'numeric', month: 'long' });
}

function getCor(type, category) {
  if (type === 'income')   return { cor: '#22C55E', bg: 'rgba(34,197,94,0.15)' };
  if (type === 'transfer') return { cor: '#8B5CF6', bg: 'rgba(139,92,246,0.15)' };
  const mapa = {
    'Alimentação':    { cor: '#F59E0B', bg: 'rgba(245,158,11,0.15)' },
    'Saúde':          { cor: '#EF4444', bg: 'rgba(239,68,68,0.15)' },
    'Transporte':     { cor: '#3B82F6', bg: 'rgba(59,130,246,0.15)' },
    'Entretenimento': { cor: '#EC4899', bg: 'rgba(236,72,153,0.15)' },
    'Casa':           { cor: '#14B8A6', bg: 'rgba(20,184,166,0.15)' },
    'Compras':        { cor: '#F97316', bg: 'rgba(249,115,22,0.15)' },
  };
  return mapa[category] || { cor: '#94A3B8', bg: 'rgba(148,163,184,0.15)' };
}

export default function StatsTab({
  transactions = [],
  filteredTransactions = [],
  currentMonth,
  onMonthChange,
  categories,
  budgets,
  onTransactionDeleted,
  onCategoryChange,
}) {
  const [tabAtiva, setTabAtiva] = useState('all');

  // Filtra por tab usando dados reais
  const transacoesFiltradas = useMemo(() => {
    const base = filteredTransactions.length > 0
      ? filteredTransactions
      : transactions;
    if (tabAtiva === 'all') return base;
    return base.filter(t => t.type === tabAtiva);
  }, [transactions, filteredTransactions, tabAtiva]);

  // Agrupa por data, ordenado por created_at desc
  const grupos = useMemo(() => {
    const mapa = {};
    [...transacoesFiltradas]
      .sort((a, b) =>
        new Date(b.created_at || b.date || 0) -
        new Date(a.created_at || a.date || 0)
      )
      .forEach(t => {
        const chave = t.date;
        if (!mapa[chave]) {
          mapa[chave] = { label: formatDataLabel(t.date), items: [] };
        }
        mapa[chave].items.push(t);
      });
    return Object.values(mapa);
  }, [transacoesFiltradas]);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: 'transparent',
    }}>

      {/* HEADER */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '16px 20px 12px',
      }}>
        <span style={{ fontSize: '24px', fontWeight: 600, color: '#FFFFFF' }}>
          Histórico
        </span>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <Search size={20} color="#94A3B8" />
          <SlidersHorizontal size={20} color="#94A3B8" />
        </div>
      </div>

      {/* TABS */}
      <div style={{
        display: 'flex',
        gap: '8px',
        padding: '0 20px 16px',
        overflowX: 'auto',
        scrollbarWidth: 'none',
        WebkitOverflowScrolling: 'touch',
      }}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setTabAtiva(tab.id)}
            style={{
              flexShrink: 0,
              padding: '6px 16px',
              borderRadius: '20px',
              border: tabAtiva === tab.id
                ? '1px solid rgba(0,221,255,0.3)'
                : '1px solid transparent',
              background: tabAtiva === tab.id
                ? 'rgba(0,221,255,0.12)'
                : 'rgba(255,255,255,0.06)',
              color: tabAtiva === tab.id ? '#00DDFF' : '#94A3B8',
              fontSize: '13px',
              fontWeight: tabAtiva === tab.id ? 500 : 400,
              cursor: 'pointer',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* LISTA */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
        padding: '0 20px',
        paddingBottom: '80px',
      }}>

        {grupos.length === 0 && (
          <div style={{
            textAlign: 'center',
            color: '#94A3B8',
            fontSize: '14px',
            marginTop: '60px',
          }}>
            Sem transações este mês
          </div>
        )}

        {grupos.map((grupo, gi) => (
          <div key={gi}>
            {/* LABEL DO GRUPO */}
            <div style={{
              fontSize: '11px',
              fontWeight: 600,
              color: '#94A3B8',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              margin: '20px 0 8px',
            }}>
              {grupo.label}
            </div>

            {/* TRANSAÇÕES */}
            {grupo.items.map((t, ti) => {
              const { cor, bg } = getCor(t.type, t.category);
              const isUltima = ti === grupo.items.length - 1;
              const inicial = (t.description || t.category || '?')[0].toUpperCase();

              return (
                <div
                  key={t.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '12px 0',
                    borderBottom: isUltima
                      ? 'none'
                      : '1px solid rgba(255,255,255,0.05)',
                    cursor: 'pointer',
                  }}
                >
                  {/* ÍCONE */}
                  <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    background: bg,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    fontSize: '15px',
                    fontWeight: 700,
                    color: cor,
                  }}>
                    {inicial}
                  </div>

                  {/* INFO */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: '15px',
                      fontWeight: 500,
                      color: '#FFFFFF',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}>
                      {t.description}
                    </div>
                    <div style={{
                      fontSize: '12px',
                      color: '#94A3B8',
                      marginTop: '2px',
                    }}>
                      {t.category}
                    </div>
                  </div>

                  {/* VALOR */}
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{
                      fontSize: '15px',
                      fontWeight: 600,
                      color: t.type === 'income' ? '#22C55E'
                           : t.type === 'transfer' ? '#8B5CF6'
                           : '#FFFFFF',
                    }}>
                      {formatValor(t.amount, t.type)}
                    </div>
                    {t.account_name && (
                      <div style={{
                        fontSize: '11px',
                        color: '#94A3B8',
                        marginTop: '2px',
                      }}>
                        {t.account_name}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
