import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import './CosmosSheet.css';

/**
 * CosmosSheet — bottom sheet / modal system.
 * Renders into #overlay-root (same portal as existing Overlay).
 *
 * open      : boolean
 * onClose   : () => void
 * title     : string
 * showClose : show × button (default true)
 * divider   : show divider between header and body (default true)
 * children  : scrollable content
 */
export default function CosmosSheet({
  open,
  onClose,
  title,
  showClose = true,
  divider = true,
  children,
}) {
  // Lock body scroll while open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  if (!open) return null;

  const root = document.getElementById('overlay-root') || document.body;

  return createPortal(
    <div
      className="cs-backdrop"
      onClick={onClose}
    >
      <div
        className="cs-sheet"
        onClick={e => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div className="cs-handle" />

        {/* Header */}
        {(title || showClose) && (
          <div className="cs-header">
            {title && <span className="cs-title">{title}</span>}
            {showClose && (
              <button className="cs-close" onClick={onClose} type="button" aria-label="Fechar">
                <X size={16} strokeWidth={2} />
              </button>
            )}
          </div>
        )}

        {divider && <div className="cs-divider" />}

        {/* Scrollable content */}
        <div className="cs-body">
          {children}
        </div>
      </div>
    </div>,
    root,
  );
}
