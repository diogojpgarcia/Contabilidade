import React from 'react';
import { Building2, PiggyBank } from 'lucide-react';

/* ── Placeholder accounts — replaced by real data via props when available ── */
const PLACEHOLDER_ACCOUNTS = [
  {
    id: 'main',
    icon: <Building2 size={16} strokeWidth={1.75} />,
    bank: 'Caixa Geral',
    name: 'Conta Principal',
    balance: 3247.00,
  },
  {
    id: 'savings',
    icon: <PiggyBank size={16} strokeWidth={1.75} />,
    bank: 'High Yield',
    name: 'Poupança',
    balance: 0.00,
  },
];

function fmtBalance(value) {
  return (parseFloat(value) || 0).toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '€';
}

const AccountsSection = ({ accounts, onNavigate }) => {
  const items = (accounts && accounts.length > 0) ? accounts : PLACEHOLDER_ACCOUNTS;

  return (
    <section aria-label="Contas" style={{ marginTop: 8 }}>

      {/* Header — padded horizontally, matches page rhythm */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 20px',
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
            color: 'var(--cosmos-accent)',
            WebkitTapHighlightColor: 'transparent',
          }}
          aria-label="Ver todas as contas"
          onClick={() => onNavigate?.('patrimony')}
        >
          Ver todas
        </button>
      </div>

      {/* Horizontal scroll — padding keeps cards away from edges without clipping */}
      <div
        className="accounts-scroll-row"
        style={{ paddingLeft: 20, paddingRight: 20 }}
      >
        {items.map((account) => (
          <div key={account.id} style={{
            width: 160,
            flexShrink: 0,
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 14,
            padding: 14,
            display: 'flex',
            flexDirection: 'column',
          }}>

            {/* Line 1: icon + bank name */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ color: 'var(--cosmos-accent)', display: 'flex', flexShrink: 0 }}
                    aria-hidden="true">
                {account.icon}
              </span>
              <span style={{
                fontFamily: 'Inter, -apple-system, sans-serif',
                fontSize: 11,
                fontWeight: 400,
                color: '#94A3B8',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {account.bank}
              </span>
            </div>

            {/* Line 2: account name */}
            <span style={{
              fontFamily: 'Inter, -apple-system, sans-serif',
              fontSize: 13,
              fontWeight: 500,
              color: '#FFFFFF',
              marginTop: 8,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {account.name}
            </span>

            {/* Line 3: balance */}
            <span style={{
              fontFamily: 'Inter, -apple-system, sans-serif',
              fontSize: 18,
              fontWeight: 600,
              color: '#FFFFFF',
              marginTop: 4,
              letterSpacing: '-0.02em',
              lineHeight: 1.15,
            }}>
              {fmtBalance(account.currentBalance ?? account.balance)}
            </span>

          </div>
        ))}
      </div>

    </section>
  );
};

export default AccountsSection;
