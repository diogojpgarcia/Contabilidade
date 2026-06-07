import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import { registerSW } from 'virtual:pwa-register'

// VitePWA gere o único SW da app (Workbox, gerado em dist/sw.js).
// onNeedRefresh: mostra banner quando nova versão está disponível.
// onOfflineReady: silencioso — utilizador já está offline-capable.
let updateSW = null;
updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    showUpdateBanner(() => updateSW?.(true));
  },
});

function showUpdateBanner(doUpdate) {
  if (document.getElementById('pwa-update-banner')) return;

  const banner = document.createElement('div');
  banner.id = 'pwa-update-banner';
  banner.style.cssText = [
    'position:fixed;top:0;left:0;right:0;z-index:10000',
    'background:linear-gradient(135deg,#667eea 0%,#764ba2 100%)',
    'color:#fff;padding:.875rem 1rem;text-align:center',
    'box-shadow:0 4px 12px rgba(0,0,0,.3)',
    'font-family:-apple-system,BlinkMacSystemFont,sans-serif',
    'animation:pwa-slide-down .3s ease',
  ].join(';');

  banner.innerHTML = `
    <style>@keyframes pwa-slide-down{from{transform:translateY(-100%)}to{transform:translateY(0)}}</style>
    <div style="display:flex;align-items:center;justify-content:center;gap:1rem;flex-wrap:wrap">
      <p style="margin:0;font-weight:600;font-size:.9375rem">✨ Nova versão disponível!</p>
      <button id="pwa-update-now" style="background:#fff;color:#667eea;border:none;padding:.5rem 1.25rem;border-radius:8px;font-weight:600;font-size:.875rem;cursor:pointer">Atualizar Agora</button>
      <button id="pwa-dismiss"    style="background:transparent;color:rgba(255,255,255,.8);border:1px solid rgba(255,255,255,.3);padding:.5rem 1rem;border-radius:8px;font-weight:500;font-size:.875rem;cursor:pointer">Mais Tarde</button>
    </div>`;

  document.body.prepend(banner);
  document.getElementById('pwa-update-now').onclick = () => { banner.remove(); doUpdate(); };
  document.getElementById('pwa-dismiss').onclick    = () => banner.remove();

  // Auto-apply após 30 min de inatividade
  let lastActivity = Date.now();
  ['mousedown', 'keydown', 'scroll', 'touchstart'].forEach(e =>
    document.addEventListener(e, () => { lastActivity = Date.now(); }, { passive: true })
  );
  const timer = setInterval(() => {
    if (Date.now() - lastActivity > 1_800_000) {
      clearInterval(timer);
      banner.remove();
      doUpdate();
    }
  }, 300_000);
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
)
