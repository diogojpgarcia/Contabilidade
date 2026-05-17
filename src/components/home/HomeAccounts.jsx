import React from 'react';
import CosmosCard from '../cosmos/CosmosCard';
import CosmosSectionHeader from '../cosmos/CosmosSectionHeader';

/* ── Logic unchanged ────────────────────────────────────────────────────── */
const ACCOUNT_COLORS = ['#6366f1','#10b981','#f59e0b','#ef4444','#8b5cf6','#14b8a6'];

function fmt(val) {
  return val.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const HomeAccounts = ({ accounts = [] }) => {
  if (accounts.length === 0) return null;

  const sorted = [...accounts].sort((a, b) => {
    const balA = parseFloat(a.currentBalance ?? a.balance) || 0;
    const balB = parseFloat(b.currentBalance ?? b.balance) || 0;
    if (balB !== balA) return balB - balA;
    return (a.name || '').localeCompare(b.name || '');
  });

  return (
    <CosmosCard variant="standard">

      <CosmosSectionHeader title="Contas" style={{ marginBottom: 12 }} />

      <div className="h-accounts-list">
        {sorted.map((acc, i) => {
          const bal = parseFloat(acc.currentBalance ?? acc.balance) || 0;
          return (
            <div key={acc.id || i} className="h-account-row">
              <span
                className="h-account-dot"
                style={{ background: ACCOUNT_COLORS[i % ACCOUNT_COLORS.length] }}
              />
              <span className="h-account-name">{acc.name}</span>
              <span className={`h-account-balance ${bal < 0 ? 'negative' : ''}`}>
                {fmt(bal)}€
              </span>
            </div>
          );
        })}
      </div>

    </CosmosCard>
  );
};

export default HomeAccounts;
