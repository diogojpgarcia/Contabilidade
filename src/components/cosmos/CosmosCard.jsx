import React from 'react';
import './CosmosCard.css';

/**
 * CosmosCard — universal surface container.
 *
 * variant  : 'hero' | 'standard' | 'compact'
 * glow     : adds soft cyan ambient glow
 * pressable: enables tap scale feedback + cursor pointer
 */
export default function CosmosCard({
  variant = 'standard',
  glow = false,
  pressable = false,
  onClick,
  className = '',
  style,
  children,
}) {
  const classes = [
    'cosmos-card',
    `cosmos-card--${variant}`,
    glow ? 'cosmos-card--glow' : '',
    pressable || onClick ? 'cosmos-card--pressable' : '',
    className,
  ].filter(Boolean).join(' ');

  return (
    <div className={classes} style={style} onClick={onClick}>
      {children}
    </div>
  );
}
