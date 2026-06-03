import React, { useState, useEffect, useRef } from 'react';

const CountUp = ({ value, decimals = 0, duration = 1200 }) => {
  const [display, setDisplay] = useState(value); // start from current value, not 0
  const fromRef = useRef(value);
  const rafRef  = useRef(null);

  useEffect(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    const from  = fromRef.current;
    const to    = value;
    if (from === to) return;

    const start = Date.now();
    const tick  = () => {
      const p      = Math.min((Date.now() - start) / duration, 1);
      const eased  = 1 - (1 - p) ** 4; // quartic ease-out — dramatic deceleration
      const curr   = from + (to - from) * eased;
      setDisplay(curr);
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
      else { fromRef.current = to; setDisplay(to); }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [value, duration]);

  return <>{display.toFixed(decimals)}</>;
};

export default CountUp;
