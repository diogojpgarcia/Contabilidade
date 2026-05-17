import React from 'react';
import './CosmosFilterPills.css';

/**
 * CosmosFilterPills — horizontal scrolling filter / tab / segmented control.
 *
 * options  : [{ id, label, icon? }]  — icon is an emoji or React node
 * value    : currently active id (string)
 * onChange : (id) => void
 * multi    : if true, value is an array of selected ids and onChange receives the new array
 */
export default function CosmosFilterPills({
  options = [],
  value,
  onChange,
  multi = false,
  className = '',
  style,
}) {
  const isActive = (id) =>
    multi ? Array.isArray(value) && value.includes(id) : value === id;

  const handleClick = (id) => {
    if (!onChange) return;
    if (multi) {
      const current = Array.isArray(value) ? value : [];
      onChange(
        current.includes(id) ? current.filter(v => v !== id) : [...current, id]
      );
    } else {
      onChange(id);
    }
  };

  return (
    <div className={`cfp ${className}`} style={style}>
      {options.map(({ id, label, icon }) => (
        <button
          key={id}
          className={`cfp__pill ${isActive(id) ? 'cfp__pill--active' : ''}`}
          onClick={() => handleClick(id)}
          type="button"
        >
          {icon && <span className="cfp__pill-icon">{icon}</span>}
          {label}
        </button>
      ))}
    </div>
  );
}
