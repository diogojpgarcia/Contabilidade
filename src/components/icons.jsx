/**
 * icons.jsx — Inline SVG icon set, lucide-react API-compatible.
 * Drop-in replacement that works without npm install.
 * Each component accepts: size, color, strokeWidth (same as lucide-react).
 */
import React from 'react';

const Svg = ({ size = 24, color = 'currentColor', strokeWidth = 2, children }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {children}
  </svg>
);

export const Utensils = p => (
  <Svg {...p}>
    <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/>
    <path d="M7 2v20"/>
    <path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3zm0 0v7"/>
  </Svg>
);

export const Car = p => (
  <Svg {...p}>
    <path d="M5 17H3a2 2 0 0 1-2-2V9l3-6h14l3 6v6a2 2 0 0 1-2 2h-2"/>
    <circle cx="7.5" cy="17.5" r="2.5"/>
    <circle cx="16.5" cy="17.5" r="2.5"/>
  </Svg>
);

export const ShoppingBag = p => (
  <Svg {...p}>
    <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
    <line x1="3" y1="6" x2="21" y2="6"/>
    <path d="M16 10a4 4 0 0 1-8 0"/>
  </Svg>
);

export const Receipt = p => (
  <Svg {...p}>
    <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1z"/>
    <path d="M16 8H8M16 12H8M12 16H8"/>
  </Svg>
);

export const Wallet = p => (
  <Svg {...p}>
    <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/>
    <path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/>
    <circle cx="18" cy="12" r="1" fill="currentColor" stroke="none"/>
  </Svg>
);

export const ArrowRightLeft = p => (
  <Svg {...p}>
    <polyline points="17 1 21 5 17 9"/>
    <path d="M3 11V9a4 4 0 0 1 4-4h14"/>
    <polyline points="7 23 3 19 7 15"/>
    <path d="M21 13v2a4 4 0 0 1-4 4H3"/>
  </Svg>
);

export const Home = p => (
  <Svg {...p}>
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
    <polyline points="9 22 9 12 15 12 15 22"/>
  </Svg>
);

export const Zap = p => (
  <Svg {...p}>
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
  </Svg>
);

export const Smartphone = p => (
  <Svg {...p}>
    <rect x="5" y="2" width="14" height="20" rx="2" ry="2"/>
    <line x1="12" y1="18" x2="12.01" y2="18"/>
  </Svg>
);

export const Plane = p => (
  <Svg {...p}>
    <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/>
  </Svg>
);

export const Heart = p => (
  <Svg {...p}>
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
  </Svg>
);

export const BookOpen = p => (
  <Svg {...p}>
    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
    <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
  </Svg>
);

export const Shirt = p => (
  <Svg {...p}>
    <path d="M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.57a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.57a2 2 0 0 0-1.34-2.23z"/>
  </Svg>
);

export const Gift = p => (
  <Svg {...p}>
    <polyline points="20 12 20 22 4 22 4 12"/>
    <rect x="2" y="7" width="20" height="5"/>
    <line x1="12" y1="22" x2="12" y2="7"/>
    <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/>
    <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/>
  </Svg>
);

export const Baby = p => (
  <Svg {...p}>
    <path d="M9 12h0.01"/>
    <path d="M15 12h0.01"/>
    <path d="M10 16c.5.3 1.2.5 2 .5s1.5-.2 2-.5"/>
    <path d="M19 6.3a9 9 0 0 1 1.8 3.9 2 2 0 0 1 0 3.6 9 9 0 0 1-17.6 0 2 2 0 0 1 0-3.6A9 9 0 0 1 12 3c2 0 3.5 1.1 3.5 2.5s-.9 2.5-2 2.5c-.8 0-1.5-.4-1.5-1"/>
  </Svg>
);

export const PiggyBank = p => (
  <Svg {...p}>
    <path d="M19 5c-1.5 0-2.8 1.4-3 2-3.5-1.5-11-.3-11 5 0 1.8.5 3.2 1.5 4.3l-1 3.7h4l1-2c1 .4 2 .7 3 .7s2-.3 3-.7l1 2h4l-1-3.7C20.3 15.2 21 13.8 21 12c0-1.2-.5-2.3-1-3"/>
    <path d="M2 9h1"/>
    <path d="M6 3.5C7 2 9 2 9 2 9 2 8.5 3 9 4"/>
    <circle cx="18" cy="5" r="2"/>
  </Svg>
);

export const TrendingUp = p => (
  <Svg {...p}>
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
    <polyline points="17 6 23 6 23 12"/>
  </Svg>
);

export const Briefcase = p => (
  <Svg {...p}>
    <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/>
    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
  </Svg>
);

export const RefreshCw = p => (
  <Svg {...p}>
    <polyline points="23 4 23 10 17 10"/>
    <polyline points="1 20 1 14 7 14"/>
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
  </Svg>
);

export const Tag = p => (
  <Svg {...p}>
    <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
    <line x1="7" y1="7" x2="7.01" y2="7"/>
  </Svg>
);

export const Trophy = p => (
  <Svg {...p}>
    <line x1="12" y1="17" x2="12" y2="22"/>
    <path d="M5 22h14"/>
    <path d="M8 9h.01"/>
    <path d="M15 9h.01"/>
    <path d="M18 3H6l2 7c0 2.2 1.8 4 4 4s4-1.8 4-4l2-7z"/>
    <path d="M4 3H2v7a4 4 0 0 0 4 4"/>
    <path d="M20 3h2v7a4 4 0 0 1-4 4"/>
  </Svg>
);

export const CreditCard = p => (
  <Svg {...p}>
    <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/>
    <line x1="1" y1="10" x2="23" y2="10"/>
  </Svg>
);

export const Scale = p => (
  <Svg {...p}>
    <path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1z"/>
    <path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1z"/>
    <path d="M7 21h10"/>
    <line x1="12" y1="3" x2="12" y2="21"/>
    <path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2"/>
  </Svg>
);

export const Dumbbell = p => (
  <Svg {...p}>
    <path d="M14.4 14.4 9.6 9.6"/>
    <path d="M18.657 7.343a2 2 0 0 0-2.828-2.829 2 2 0 0 0-2.829 2.829 2 2 0 0 0 2.829 2.828 2 2 0 0 0 2.828-2.828z"/>
    <path d="M8.686 16.657a2 2 0 0 0-2.829-2.829 2 2 0 0 0-2.828 2.829 2 2 0 0 0 2.828 2.828 2 2 0 0 0 2.829-2.828z"/>
    <path d="M15.5 8.5 21 3"/>
    <path d="m3 21 5.5-5.5"/>
  </Svg>
);

export const Circle = p => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="10"/>
  </Svg>
);

export const Music = p => (
  <Svg {...p}>
    <path d="M9 18V5l12-2v13"/>
    <circle cx="6" cy="18" r="3"/>
    <circle cx="18" cy="16" r="3"/>
  </Svg>
);

export const Building = p => (
  <Svg {...p}>
    <rect x="3" y="9" width="18" height="12" rx="1"/>
    <path d="M8 9V5a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v4"/>
    <line x1="9"  y1="13" x2="9.01"  y2="13"/>
    <line x1="15" y1="13" x2="15.01" y2="13"/>
    <line x1="9"  y1="17" x2="9.01"  y2="17"/>
    <line x1="15" y1="17" x2="15.01" y2="17"/>
  </Svg>
);

export const Scissors = p => (
  <Svg {...p}>
    <circle cx="6"  cy="6"  r="3"/>
    <circle cx="6"  cy="18" r="3"/>
    <line x1="20" y1="4"  x2="8.12" y2="15.88"/>
    <line x1="14.47" y1="14.48" x2="20" y2="20"/>
    <line x1="8.12"  y1="8.12"  x2="12" y2="12"/>
  </Svg>
);

export const PawPrint = p => (
  <Svg {...p}>
    <circle cx="11" cy="4"  r="2"/>
    <circle cx="18" cy="8"  r="2"/>
    <circle cx="20" cy="16" r="2"/>
    <path d="M9 10a5 5 0 0 1 5 5v3.5a3.5 3.5 0 0 1-6.84 1.045Q6.52 17.48 4.46 16.84A3.5 3.5 0 0 1 5.5 10Z"/>
  </Svg>
);

export const Coins = p => (
  <Svg {...p}>
    <circle cx="8" cy="8" r="6"/>
    <path d="M18.09 10.37A6 6 0 1 1 10.34 18"/>
    <path d="M7 6h1v4"/>
    <line x1="9.17" y1="11.03" x2="7" y2="8.99"/>
  </Svg>
);
