import { useEffect, useRef } from 'react';

/**
 * useKeyboardViewport — mantém o backdrop de uma folha alinhado com o
 * visualViewport (a área realmente visível). No iOS (sobretudo PWA standalone) o
 * teclado sobrepõe-se sem encolher o layout viewport, por isso folhas coladas ao
 * fundo (align-items: flex-end) ficam ATRÁS do teclado e o conteúdo desaparece.
 * Ao seguir o visualViewport, a folha passa a assentar logo acima do teclado.
 *
 * Devolve um ref para colocar no elemento backdrop (position: fixed). Enquanto
 * aberto, ajusta inline `top`/`height` desse elemento ao visualViewport.
 */
export function useKeyboardViewport(open) {
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const vv = window.visualViewport;
    const el = ref.current;
    if (!vv || !el) return;
    const apply = () => {
      el.style.top = `${vv.offsetTop}px`;
      el.style.height = `${vv.height}px`;
    };
    apply();
    vv.addEventListener('resize', apply);
    vv.addEventListener('scroll', apply);
    return () => {
      vv.removeEventListener('resize', apply);
      vv.removeEventListener('scroll', apply);
      if (el) { el.style.top = ''; el.style.height = ''; }
    };
  }, [open]);
  return ref;
}
