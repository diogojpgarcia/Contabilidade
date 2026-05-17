import React from 'react';
import './CosmosSectionHeader.css';

/**
 * CosmosSectionHeader — labeled section divider with optional subtitle + action.
 *
 * title    : string (required)
 * subtitle : string (optional)
 * action   : React node — rendered right-aligned (pass a <button>, string link, etc.)
 */
export default function CosmosSectionHeader({ title, subtitle, action, className = '', style }) {
  return (
    <div className={`cosmos-sh ${className}`} style={style}>
      <div className="cosmos-sh__text">
        <span className="cosmos-sh__title">{title}</span>
        {subtitle && <span className="cosmos-sh__subtitle">{subtitle}</span>}
      </div>
      {action && <div className="cosmos-sh__action">{action}</div>}
    </div>
  );
}
