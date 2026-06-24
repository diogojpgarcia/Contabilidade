/**
 * InboxRow.jsx — uma linha da inbox de ações da Home.
 *
 * Apresentação pura: recebe um item de `buildInbox` e dispara callbacks.
 * O mapeamento item.action → handler é feito pelo HomeInbox.
 */
import React from 'react';
import { CalendarClock, Tags, Scale, Check, X, ChevronRight } from 'lucide-react';

// Cor + ícone por tipo de item.
const TYPE_STYLE = {
  'recurring-due':   { Icon: CalendarClock, color: 'var(--cosmos-expense)',           bg: 'var(--cosmos-expense-dim)' },
  'uncategorized':   { Icon: Tags,          color: 'var(--cosmos-warning, #f59e0b)',  bg: 'rgba(245,158,11,0.12)' },
  'reconcile-stale': { Icon: Scale,         color: 'var(--cosmos-accent)',            bg: 'var(--cosmos-accent-dim)' },
};

const IconBtn = ({ label, onClick, children, tone }) => (
  <button
    aria-label={label}
    onClick={onClick}
    style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      width: 32, height: 32, borderRadius: 9,
      background: 'var(--cosmos-surface-2, var(--cosmos-surface-1))',
      border: '1px solid var(--cosmos-border-card)',
      color: tone || 'var(--cosmos-text-2)',
      cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
    }}
  >
    {children}
  </button>
);

const TextBtn = ({ label, onClick }) => (
  <button
    onClick={onClick}
    style={{
      padding: '6px 12px', borderRadius: 9,
      background: 'var(--cosmos-surface-2, var(--cosmos-surface-1))',
      border: '1px solid var(--cosmos-border-card)',
      fontSize: 12, fontWeight: 600, color: 'var(--cosmos-text-1)',
      cursor: 'pointer', WebkitTapHighlightColor: 'transparent', whiteSpace: 'nowrap',
    }}
  >
    {label}
  </button>
);

const InboxRow = ({ item, onConfirm, onSkip, onPrimary, isLast }) => {
  const { Icon, color, bg } = TYPE_STYLE[item.type] || TYPE_STYLE['uncategorized'];

  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '11px 16px',
        borderBottom: isLast ? 'none' : '1px solid var(--cosmos-border-divider)',
      }}
    >
      <div style={{
        width: 32, height: 32, borderRadius: 9, flexShrink: 0,
        background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color,
      }}>
        <Icon size={17} strokeWidth={1.9} />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--cosmos-text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {item.title}
        </div>
        {item.subtitle && (
          <div style={{ fontSize: 11.5, color: item.type === 'recurring-due' ? 'var(--cosmos-expense)' : 'var(--cosmos-text-3)', marginTop: 1 }}>
            {item.subtitle}
          </div>
        )}
      </div>

      {/* Ações: recorrentes = confirmar/dispensar; resto = botão único */}
      {item.type === 'recurring-due' ? (
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          <IconBtn label="Confirmar pagamento" tone="var(--cosmos-income)" onClick={() => onConfirm?.(item)}><Check size={15} strokeWidth={2.2} /></IconBtn>
          <IconBtn label="Dispensar" onClick={() => onSkip?.(item)}><X size={15} strokeWidth={2.2} /></IconBtn>
        </div>
      ) : item.type === 'uncategorized' ? (
        <TextBtn label="Rever" onClick={() => onPrimary?.(item)} />
      ) : (
        <TextBtn label="Conferir" onClick={() => onPrimary?.(item)} />
      )}

      {item.type !== 'recurring-due' && (
        <ChevronRight size={15} color="var(--cosmos-text-3)" style={{ flexShrink: 0, marginLeft: -4 }} aria-hidden />
      )}
    </div>
  );
};

export default InboxRow;
