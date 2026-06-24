/**
 * HomeInbox.jsx — secção "Tratar" da Home.
 *
 * Recebe a lista já priorizada de `buildInbox(...)` e:
 *  - mostra até `maxVisible` itens, com "ver tudo (+N)" para expandir;
 *  - dispara os handlers de cada ação;
 *  - quando vazia, mostra o estado inbox-zero ("Tudo em dia").
 *
 * Apresentação pura — não chama `buildInbox` nem calcula nada.
 */
import React, { useState } from 'react';
import { Check } from 'lucide-react';
import InboxRow from './InboxRow';

const Card = ({ children }) => (
  <div style={{
    background: 'var(--cosmos-surface-1)',
    border: '1px solid var(--cosmos-border-card)',
    borderRadius: 16,
    boxShadow: 'var(--cosmos-shadow-card)',
    overflow: 'hidden',
  }}>
    {children}
  </div>
);

const ZeroState = () => (
  <Card>
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px' }}>
      <div style={{
        width: 36, height: 36, borderRadius: 11, flexShrink: 0,
        background: 'var(--cosmos-income-dim)', color: 'var(--cosmos-income)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Check size={20} strokeWidth={2.2} />
      </div>
      <div>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--cosmos-text-1)' }}>Tudo em dia</div>
        <div style={{ fontSize: 12, color: 'var(--cosmos-text-3)', marginTop: 1 }}>Nada por tratar. Bom trabalho.</div>
      </div>
    </div>
  </Card>
);

const HomeInbox = ({
  items = [],
  maxVisible = 3,
  onConfirmRecurring,
  onSkipRecurring,
  onReviewUncategorized,
  onReconcileAccount,
}) => {
  const [expanded, setExpanded] = useState(false);

  const total = items.length;
  const visible = expanded ? items : items.slice(0, maxVisible);
  const hidden = total - visible.length;

  const handlePrimary = (item) => {
    if (item.type === 'uncategorized') onReviewUncategorized?.(item.action);
    else if (item.type === 'reconcile-stale') onReconcileAccount?.(item.action);
  };

  return (
    <div style={{ padding: '0 16px', marginBottom: 12 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--cosmos-text-2)', letterSpacing: '0.01em' }}>Tratar</span>
        {total > 0 && (
          <span style={{
            fontSize: 11, fontWeight: 600, lineHeight: 1,
            background: 'var(--cosmos-expense-dim)', color: 'var(--cosmos-expense)',
            padding: '3px 8px', borderRadius: 999,
          }}>
            {total}
          </span>
        )}
      </div>

      {total === 0 ? (
        <ZeroState />
      ) : (
        <Card>
          {visible.map((item, idx) => (
            <InboxRow
              key={item.id}
              item={item}
              isLast={idx === visible.length - 1 && hidden <= 0}
              onConfirm={(it) => onConfirmRecurring?.(it.action)}
              onSkip={(it) => onSkipRecurring?.(it.action)}
              onPrimary={handlePrimary}
            />
          ))}

          {hidden > 0 && (
            <button
              onClick={() => setExpanded(true)}
              style={{
                width: '100%', padding: '11px 16px', background: 'none',
                border: 'none', borderTop: '1px solid var(--cosmos-border-divider)',
                fontSize: 12, fontWeight: 600, color: 'var(--cosmos-accent)',
                cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
              }}
            >
              Ver tudo (+{hidden})
            </button>
          )}
        </Card>
      )}
    </div>
  );
};

export default HomeInbox;
