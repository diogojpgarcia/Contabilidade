/**
 * EmptyState.jsx — Reusable empty state with icon, title, description and optional CTA.
 */
import React from 'react';

const EmptyState = ({ icon = '📭', title, description, action, onAction, style }) => (
  <div style={{
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', padding: '48px 32px', textAlign: 'center',
    gap: 12, ...style,
  }}>
    <div style={{ fontSize: 48, lineHeight: 1, opacity: 0.6, marginBottom: 4 }}>{icon}</div>
    <div style={{
      fontSize: 16, fontWeight: 600, color: 'var(--cosmos-text-1)',
      letterSpacing: '-0.01em',
    }}>
      {title}
    </div>
    {description && (
      <div style={{
        fontSize: 13, color: 'var(--cosmos-text-3)',
        lineHeight: 1.5, maxWidth: 260,
      }}>
        {description}
      </div>
    )}
    {action && onAction && (
      <button
        onClick={onAction}
        style={{
          marginTop: 8,
          background: 'var(--cosmos-accent-dim)',
          border: '1px solid var(--cosmos-accent-border)',
          borderRadius: 12, padding: '10px 20px',
          fontSize: 13, fontWeight: 600,
          color: 'var(--cosmos-accent)',
          cursor: 'pointer',
          WebkitTapHighlightColor: 'transparent',
        }}
      >
        {action}
      </button>
    )}
  </div>
);

export default EmptyState;
