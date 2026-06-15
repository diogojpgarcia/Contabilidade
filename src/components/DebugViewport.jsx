import React, { useState, useEffect } from 'react';

/**
 * DebugViewport — painel TEMPORÁRIO de diagnóstico de viewport.
 * Mostra as medições reais do device para calibrar a altura da app / nav.
 * Remover depois de calibrado.
 */
export default function DebugViewport() {
  const [info, setInfo] = useState(null);

  useEffect(() => {
    const probe = (unit) => {
      const d = document.createElement('div');
      d.style.cssText = `position:fixed;top:0;left:-9999px;width:1px;height:100${unit};`;
      document.body.appendChild(d);
      const h = d.getBoundingClientRect().height;
      document.body.removeChild(d);
      return Math.round(h);
    };
    const measure = () => {
      const sp = document.createElement('div');
      sp.style.cssText = 'position:fixed;top:0;left:-9999px;padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom);';
      document.body.appendChild(sp);
      const cs = getComputedStyle(sp);
      const safeTop = cs.paddingTop, safeBottom = cs.paddingBottom;
      document.body.removeChild(sp);

      const app = document.querySelector('.app-new');
      const nav = document.querySelector('.bottom-nav');
      const navBottom = nav ? Math.round(nav.getBoundingClientRect().bottom) : '—';

      setInfo({
        inner: window.innerHeight,
        visual: Math.round(window.visualViewport?.height || 0),
        client: document.documentElement.clientHeight,
        screen: window.screen.height,
        vh: probe('vh'), dvh: probe('dvh'), svh: probe('svh'), lvh: probe('lvh'),
        appH: app ? Math.round(app.getBoundingClientRect().height) : '—',
        navBottom,
        safeTop, safeBottom,
        dpr: window.devicePixelRatio,
      });
    };
    measure();
    window.addEventListener('resize', measure);
    window.visualViewport?.addEventListener('resize', measure);
    return () => {
      window.removeEventListener('resize', measure);
      window.visualViewport?.removeEventListener('resize', measure);
    };
  }, []);

  if (!info) return null;
  const row = (k, v) => `${k}:${v}`;
  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 999999,
      background: 'rgba(0,0,0,0.9)', color: '#0f0', fontSize: 12,
      fontFamily: 'monospace', padding: '48px 10px 10px', lineHeight: 1.5,
      pointerEvents: 'none', whiteSpace: 'pre-wrap', textAlign: 'left',
    }}>
      {`inner ${info.inner} · visual ${info.visual} · client ${info.client} · screen ${info.screen} (dpr ${info.dpr})
vh ${info.vh} · dvh ${info.dvh} · svh ${info.svh} · lvh ${info.lvh}
app-new altura ${info.appH} · nav fundo @ ${info.navBottom}
safe top ${info.safeTop} · safe bottom ${info.safeBottom}`}
    </div>
  );
}
