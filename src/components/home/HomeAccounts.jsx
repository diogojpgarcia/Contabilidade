import React from 'react';

const ACCOUNT_COLORS = ['#6366f1','#10b981','#f59e0b','#ef4444','#8b5cf6','#14b8a6'];

function fmt(val) {
  return val.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const HomeAccounts = ({ accounts = [] }) => {
  if (accounts.length === 0) return null;

  return (
    <div className="h-card">
      <div className="h-section-title">Contas</div>
      <div className="h-accounts-list">
        {accounts.map((acc, i) => {
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
    </div>
  );
};

export default HomeAccounts;
