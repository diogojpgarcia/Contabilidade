/**
 * HomeInsights.jsx — secção "O que reparei" da Home.
 *
 * Apresentação pura: recebe a lista de `buildHomeInsights(...)`.
 * Cada insight pode disparar `onAction(action, insight)` (ex: abrir orçamento).
 * Devolve null quando não há insights.
 */
import React from 'react';
import { AlertTriangle, Check, Lightbulb } from 'lucide-react';

// tom → cor/fundo (tokens cosmos) + ícone.
const TONE_STYLE = {
  danger:  { Icon: AlertTriangle, color: 'var(--cosmos-expense)',          bg: 'var(--cosmos-expense-dim)' },
  warning: { Icon: AlertTriangle, color: 'var(--cosmos-warning, #f59e0b)', bg: 'rgba(245,158,11,0.12)' },
  success: { Icon: Check,         color: 'var(--cosmos-income)',           bg: 'var(--cosmos-income-dim)' },
  info:    { Icon: Lightbulb,     color: 'var(--cosmos-accent)',           bg: 'var(--cosmos-accent-dim)' },
};

const HomeInsights = ({ insights = [], title = 'O que reparei', onAction }) => {
  if (!insights.length) return null;

  return (
    <div style={{ padding: '14px 16px 6px' }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--cosmos-text-2)', marginBottom: 8 }}>
        {title}
      </div>

      {insights.map((ins) => {
        const { Icon, color, bg } = TONE_STYLE[ins.tone] || TONE_STYLE.info;
        const clickable = !!(ins.action && onAction);
        return (
          <div
            key={ins.id}
            onClick={clickable ? () => onAction(ins.action, ins) : undefined}
            role={clickable ? 'button' : undefined}
            style={{
              display: 'flex', gap: 12, padding: '10px 0', alignItems: 'flex-start',
              cursor: clickable ? 'pointer' : 'default', WebkitTapHighlightColor: 'transparent',
            }}
          >
            <div style={{
              width: 30, height: 30, borderRadius: 9, flexShrink: 0,
              background: bg, color, display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Icon size={16} strokeWidth={1.9} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, color: 'var(--cosmos-text-1)', lineHeight: 1.45 }}>{ins.text}</div>
              {ins.subtext && (
                <div style={{ fontSize: 11.5, color: 'var(--cosmos-text-3)', marginTop: 2, lineHeight: 1.4 }}>{ins.subtext}</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default HomeInsights;
