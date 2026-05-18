import React from 'react';
import { Building2, PiggyBank } from 'lucide-react';

/* ── Hardcoded placeholder accounts — will receive real data via props later ── */
const PLACEHOLDER_ACCOUNTS = [
  {
    id: 'main',
    icon: <Building2 size={20} strokeWidth={1.75} />,
    bank: 'Caixa Geral',
    name: 'Conta Principal',
    balance: 3247.00,
  },
  {
    id: 'savings',
    icon: <PiggyBank size={20} strokeWidth={1.75} />,
    bank: 'High Yield',
    name: 'Poupança',
    balance: 0.00,
  },
];

function fmtBalance(value) {
  return value.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '€';
}

const AccountsSection = ({ accounts, onNavigate }) => {
  const items = (accounts && accounts.length > 0) ? accounts : PLACEHOLDER_ACCOUNTS;

  return (
    <section aria-label="Contas" style={{ padding: '0 20px', marginTop: 8 }}>

      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 14,
      }}>
        <span style={{
          fontFamily: 'Inter, -apple-system, sans-serif',
          fontSize: 16,
          fontWeight: 600,
          color: '#FFFFFF',
        }}>
          Contas
        </span>
        <button
          style={{
            background: 'none',
            border: 'none',
            padding: 0,
            cursor: 'pointer',
            fontFamily: 'Inter, -apple-system, sans-serif',
            fontSize: 13,
            fontWeight: 400,
            color: '#00DDFF',
            WebkitTapHighlightColor: 'transparent',
          }}
          aria-label="Ver todas as contas"
          onClick={() => onNavigate?.('patrimony')}
        >
          Ver todas
        </button>
      </div>

      {/* Horizontal scroll list */}
      <div className="accounts-scroll-row">
        {items.map((account) => (
          <div key={account.id} style={{
            width: 160,
            flexShrink: 0,
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 16,
            padding: 16,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}>
            {/* Top row: icon + bank name */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: '#00DDFF', display: 'flex', flexShrink: 0 }}
                    aria-hidden="true">
                {account.icon}
              </span>
              <span style={{
                fontFamily: 'Inter, -apple-system, sans-serif',
                fontSize: 12,
                fontWeight: 400,
                color: '#94A3B8',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {account.bank}
              </span>
            </div>

            {/* Account name */}
            <span style={{
              fontFamily: 'Inter, -apple-system, sans-serif',
              fontSize: 14,
              fontWeight: 500,
              color: '#FFFFFF',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {account.name}
            </span>

            {/* Balance */}
            <span style={{
              fontFamily: 'Inter, -apple-system, sans-serif',
              fontSize: 20,
              fontWeight: 600,
              color: '#FFFFFF',
              letterSpacing: '-0.02em',
              lineHeight: 1.1,
            }}>
              {fmtBalance(account.balance)}
            </span>
          </div>
        ))}
      </div>

    </section>
  );
};

export default AccountsSection;
