import { useRef, useEffect } from 'react';

/* ─── Swipe-to-reveal action card ───────────────────────────────────────────
   Flex-row approach: content + actions share one row that is wider than the
   container. At rest (translateX 0) actions are genuinely off-screen right.
   Swipe left → translateX(-OPEN_PX) → actions appear. No background hacks.

   Module-level `globalSwipeClose` ensures only one row is open at a time.  */

let globalSwipeClose = null;
const SWIPE_OPEN_PX   = 80;
const SWIPE_THRESHOLD = 30;

const SwipeRevealCard = ({ onEdit, onDelete, onClick, className = '', children }) => {
  const rowRef    = useRef(null);
  const closeRef  = useRef(null);
  const isOpenRef = useRef(false);
  const gesture   = useRef({ startX: 0, startY: 0, baseX: 0, dir: null, active: false });

  useEffect(() => {
    const row = rowRef.current;
    if (!row) return;

    const move = (px, animate) => {
      row.style.transition = animate ? 'transform 0.22s cubic-bezier(0.4,0,0.2,1)' : 'none';
      row.style.transform  = `translateX(${px}px)`;
    };

    const close = () => {
      move(0, true);
      isOpenRef.current = false;
      if (globalSwipeClose === close) globalSwipeClose = null;
    };

    const open = () => {
      if (globalSwipeClose && globalSwipeClose !== close) globalSwipeClose();
      move(-SWIPE_OPEN_PX, true);
      isOpenRef.current = true;
      globalSwipeClose  = close;
    };

    closeRef.current = close;

    const onStart = (e) => {
      gesture.current = {
        startX: e.touches[0].clientX,
        startY: e.touches[0].clientY,
        baseX:  isOpenRef.current ? -SWIPE_OPEN_PX : 0,
        dir:    null,
        active: true,
      };
    };

    const onMove = (e) => {
      const g = gesture.current;
      if (!g.active) return;
      const dx = e.touches[0].clientX - g.startX;
      const dy = e.touches[0].clientY - g.startY;
      if (!g.dir) {
        if (Math.abs(dx) > Math.abs(dy) + 3)      g.dir = 'h';
        else if (Math.abs(dy) > Math.abs(dx) + 3) g.dir = 'v';
        else return;
      }
      if (g.dir === 'v') return;
      e.preventDefault();
      row.style.transition = 'none';
      row.style.transform  = `translateX(${Math.min(0, Math.max(-SWIPE_OPEN_PX, g.baseX + dx))}px)`;
    };

    const onEnd = (e) => {
      const g = gesture.current;
      if (!g.active || g.dir !== 'h') { g.active = false; return; }
      g.active = false;
      const dx     = e.changedTouches[0].clientX - g.startX;
      const finalX = g.baseX + dx;
      if (finalX < -SWIPE_THRESHOLD) open(); else close();
    };

    row.addEventListener('touchstart', onStart, { passive: true });
    row.addEventListener('touchmove',  onMove,  { passive: false });
    row.addEventListener('touchend',   onEnd,   { passive: true });

    return () => {
      row.removeEventListener('touchstart', onStart);
      row.removeEventListener('touchmove',  onMove);
      row.removeEventListener('touchend',   onEnd);
      if (globalSwipeClose === close) globalSwipeClose = null;
    };
  }, []);

  return (
    <div className="swipe-reveal">
      <div
        ref={rowRef}
        className="swipe-row"
        onClickCapture={e => {
          if (isOpenRef.current) { e.stopPropagation(); e.preventDefault(); closeRef.current?.(); }
        }}
      >
        <div className={className} onClick={onClick ? (e) => { if (!isOpenRef.current) onClick(e); } : undefined}>{children}</div>
        <div className="swipe-actions">
          <button
            className="swipe-btn swipe-btn-edit"
            onPointerDown={e => { e.stopPropagation(); closeRef.current?.(); setTimeout(onEdit, 30); }}
            aria-label="Editar"
          >✎</button>
          <button
            className="swipe-btn swipe-btn-delete"
            onPointerDown={e => { e.stopPropagation(); closeRef.current?.(); setTimeout(onDelete, 30); }}
            aria-label="Remover"
          >✕</button>
        </div>
      </div>
    </div>
  );
};

export default SwipeRevealCard;
