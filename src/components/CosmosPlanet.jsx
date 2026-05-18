import React from 'react';

/**
 * CosmosPlanet — decorative 3D sphere with orbital ring.
 * Rendered with CSS + inline SVG, no external dependencies.
 * Positioned absolutely by the parent (hero container).
 */
const CosmosPlanet = () => (
  <div
    aria-hidden="true"
    style={{ position: 'relative', width: 130, height: 130, pointerEvents: 'none' }}
  >
    {/* Sphere */}
    <div style={{
      width: 130,
      height: 130,
      borderRadius: '50%',
      background: 'radial-gradient(circle at 35% 35%, #1A8A9A 0%, #0D4A5A 40%, #061820 100%)',
      boxShadow: [
        '0 0 40px rgba(0,221,255,0.35)',
        '0 0 80px rgba(0,221,255,0.15)',
        'inset -20px -10px 40px rgba(0,0,0,0.6)',
      ].join(', '),
      position: 'relative',
    }} />

    {/* Orbital ring — SVG ellipse centred over the sphere */}
    <svg
      width="200"
      height="80"
      viewBox="0 0 200 80"
      style={{
        position: 'absolute',
        left: '50%',
        transform: 'translateX(-50%)',
        top: 60,   /* ring equator (cy=40) lands at 100px = lower half of sphere */
        pointerEvents: 'none',
        overflow: 'visible',
      }}
    >
      <ellipse
        cx="100" cy="40"
        rx="90"   ry="22"
        stroke="#00DDFF"
        strokeWidth="1.5"
        fill="none"
        opacity="0.4"
      />
    </svg>
  </div>
);

export default CosmosPlanet;
