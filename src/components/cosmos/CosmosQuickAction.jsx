import React from 'react';
import './CosmosQuickAction.css';

/**
 * CosmosQuickAction — compact tappable action card/button.
 *
 * icon    : emoji string or React node
 * iconBg  : CSS background for the icon circle
 * iconColor: CSS color for the icon
 * label   : text label below icon
 * accent  : apply cyan accent surface variant
 * onClick : tap handler
 *
 * To render a row of actions, wrap them in <CosmosQuickActionGrid>.
 */
export default function CosmosQuickAction({
  icon,
  iconBg,
  iconColor,
  label,
  accent = false,
  onClick,
  className = '',
  style,
}) {
  return (
    <button
      type="button"
      className={`cqa ${accent ? 'cqa--accent' : ''} ${className}`}
      style={style}
      onClick={onClick}
    >
      <div
        className="cqa__icon"
        style={{
          background: iconBg || 'var(--cosmos-accent-dim)',
          color: iconColor || 'var(--cosmos-accent)',
        }}
      >
        {icon}
      </div>
      {label && <span className="cqa__label">{label}</span>}
    </button>
  );
}

/**
 * CosmosQuickActionGrid — responsive auto-grid wrapper for multiple actions.
 */
export function CosmosQuickActionGrid({ children, className = '', style }) {
  return (
    <div className={`cqa-grid ${className}`} style={style}>
      {children}
    </div>
  );
}
