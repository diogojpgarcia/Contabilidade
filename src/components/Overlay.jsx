import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useKeyboardViewport } from '../hooks/useKeyboardViewport';

/**
 * Overlay — portal-based backdrop for all modals and bottom sheets.
 *
 * Renders children into #overlay-root (after #root in the DOM), ensuring
 * they always stack above every fixed/sticky element in the app.
 * Locks body scroll while open and unlocks on unmount.
 *
 * Usage (center modal):
 *   <Overlay onClose={handleClose}>
 *     <div className="modal-content" onClick={e => e.stopPropagation()}>…</div>
 *   </Overlay>
 *
 * Usage (bottom sheet):
 *   <Overlay onClose={handleClose}>
 *     <div className="my-sheet" onClick={e => e.stopPropagation()}>…</div>
 *   </Overlay>
 */
export default function Overlay({ children, onClose, label }) {
  const root = document.getElementById('overlay-root');
  // Mantém a folha acima do teclado (segue o visualViewport) no iOS.
  const backdropRef = useKeyboardViewport(true);

  // Lock body scroll while any overlay is open + fechar com a tecla Escape (a11y).
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => { if (e.key === 'Escape' && onClose) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  if (!root) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={label || undefined}
      ref={backdropRef}
      style={{
        position: 'fixed',
        // top/height seguem o visualViewport (useKeyboardViewport) → folha acima
        // do teclado no iOS. Sem bottom para o ajuste inline mandar.
        top: 0,
        left: 0,
        right: 0,
        height: '100%',
        background: 'rgba(0,0,0,0.5)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
      }}
      onClick={onClose}
    >
      {children}
    </div>,
    root,
  );
}
