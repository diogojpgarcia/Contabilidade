import React from 'react';
import './CosmosBottomNav.css';

/**
 * CosmosBottomNav — floating translucent bottom navigation.
 *
 * items   : [{ id, icon: ReactNode, label, center? }]
 *           center=true renders the item as a circular action button (e.g. Add)
 * active  : currently active id string
 * onChange: (id) => void
 */
export default function CosmosBottomNav({ items = [], active, onChange }) {
  return (
    <nav className="cbn">
      <div className="cbn__bar">
        {items.map(({ id, icon, label, center }) => (
          <button
            key={id}
            type="button"
            className={[
              'cbn__item',
              center ? 'cbn__item--center' : '',
              active === id ? 'cbn__item--active' : '',
            ].filter(Boolean).join(' ')}
            onClick={() => onChange?.(id)}
          >
            <span className="cbn__icon">{icon}</span>
            {!center && <span className="cbn__label">{label}</span>}
          </button>
        ))}
      </div>
    </nav>
  );
}
