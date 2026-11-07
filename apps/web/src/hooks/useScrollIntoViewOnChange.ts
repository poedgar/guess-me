import { useEffect, useRef } from 'react';

/**
 * Returns a ref to attach to the DOM node that represents "the current
 * section for this viewer". Scrolls that node into view once whenever
 * triggerKey changes — including on first mount — and never re-fires for
 * a re-render with the same key (e.g. new list content arriving). Also
 * plays a brief, one-time accent-color pulse on the same node at the same
 * moment (see the `.active-section-pulse` keyframe in index.css) — skipped
 * entirely, like the scroll's smooth behavior, when the user prefers
 * reduced motion.
 */
export function useScrollIntoViewOnChange<T extends HTMLElement>(
  triggerKey: string | number,
  align: ScrollLogicalPosition = 'center',
  pulseColor: string = 'rgba(0, 122, 255, 0.55)',
) {
  const ref = useRef<T>(null);
  const lastKey = useRef<string | number | null>(null);

  useEffect(() => {
    if (lastKey.current === triggerKey) return;
    lastKey.current = triggerKey;
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    ref.current?.scrollIntoView({
      behavior: prefersReducedMotion ? 'auto' : 'smooth',
      block: align,
    });
    if (prefersReducedMotion || !ref.current) return;
    const el = ref.current;
    el.classList.remove('active-section-pulse');
    void el.offsetWidth; // force reflow so the animation restarts even if the class was already present
    el.style.setProperty('--pulse-color', pulseColor);
    el.classList.add('active-section-pulse');
    const timeoutId = window.setTimeout(() => {
      el.classList.remove('active-section-pulse');
    }, 900);
    return () => {
      window.clearTimeout(timeoutId);
      el.classList.remove('active-section-pulse');
    };
  }, [triggerKey, align, pulseColor]);

  return ref;
}
