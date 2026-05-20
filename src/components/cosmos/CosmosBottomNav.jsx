import React from 'react';
import './CosmosBottomNav.css';

/**
 * CosmosBottomNav — floating translucent bottom navigation.
 *
 * items   : [{ id, icon: ReactNode, label, center? }]
 *           center=true renders the FAB (rendered OUTSIDE the bar so the
 *           bar's mask-image doesn't clip it)
 * active  : currently active id string
 * onChange: (id) => void
 */
export default function CosmosBottomNav({ items = [], active, onChange }) {
  const centerItem = items.find(item => item.center);

  return (
    <nav className="cbn">
      {/* Bar — has mask-image notch; FAB is NOT a child so it isn't clipped */}
      <div className="cbn__bar">
        {items.map(({ id, icon, label, center }) =>
          center ? (
            /* Invisible spacer keeps the flex layout symmetrical */
            <div key={id} className="cbn__fab-gap" aria-hidden="true" />
          ) : (
            <button
              key={id}
              type="button"
              className={[
                'cbn__item',
                active === id ? 'cbn__item--active' : '',
              ].filter(Boolean).join(' ')}
              onClick={() => onChange?.(id)}
            >
              <span className="cbn__icon">{icon}</span>
              <span className="cbn__label">{label}</span>
            </button>
          )
        )}
      </div>

      {/* FAB — sibling of the bar, positioned absolutely so mask doesn't clip it */}
      {centerItem && (
        <button
          type="button"
          className={[
            'cbn__fab',
            active === centerItem.id ? 'cbn__fab--active' : '',
          ].filter(Boolean).join(' ')}
          onClick={() => onChange?.(centerItem.id)}
          aria-label={centerItem.label}
        >
          <span className="cbn__icon">{centerItem.icon}</span>
        </button>
      )}
    </nav>
  );
}
