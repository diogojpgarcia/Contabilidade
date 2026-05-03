import React from 'react';
import './ui.css';

export const getGradient = (percent) => {
  if (percent > 100) return 'linear-gradient(90deg, #ef4444, #b91c1c)';
  if (percent >= 70)  return 'linear-gradient(90deg, #eab308, #f97316)';
  return 'linear-gradient(90deg, #22c55e, #4ade80)';
};

export const Card = ({ children, className = '', style }) => (
  <div className={`ui-card ${className}`} style={style}>{children}</div>
);

export const Bubble = ({ color, icon, size = 40, radius = '50%' }) => (
  <div
    className="ui-bubble"
    style={{ width: size, height: size, background: `${color}26`, borderRadius: radius }}
  >
    <span style={{ color, fontSize: Math.round(size * 0.42) + 'px' }}>{icon}</span>
  </div>
);

export const ProgressBar = ({ percent, animated, height = 8 }) => (
  <div className="ui-bar-bg" style={{ height }}>
    <div
      className="ui-bar-fill"
      style={{
        width: animated ? `${Math.min(percent, 100)}%` : '0%',
        background: getGradient(percent),
        boxShadow: '0 0 8px rgba(255,255,255,0.15)',
      }}
    />
  </div>
);

export const SectionHeader = ({ title, action }) => (
  <div className="ui-section-header">
    <span className="ui-section-title">{title}</span>
    {action}
  </div>
);
