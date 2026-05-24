import { useEffect } from 'react';
import { createPortal } from 'react-dom';

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
export default function Overlay({ children, onClose }) {
  const root = document.getElementById('overlay-root');

  // Lock body scroll while any overlay is open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  if (!root) return null;

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
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
