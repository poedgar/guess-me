import { useEffect, useRef } from 'react';

/**
 * Returns a ref to attach to the DOM node that represents "the current
 * section for this viewer". Scrolls that node into view once whenever
 * triggerKey changes — including on first mount — and never re-fires for
 * a re-render with the same key (e.g. new list content arriving).
 */
export function useScrollIntoViewOnChange<T extends HTMLElement>(
  triggerKey: string | number,
  align: ScrollLogicalPosition = 'center',
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
  }, [triggerKey, align]);

  return ref;
}
