/**
 * Web version of react-native-scroll-into-view's API, built on the browser's
 * Element.scrollIntoView(). The library itself calls findNodeHandle, which
 * react-native-web 0.21 throws on ("findNodeHandle is not supported on web").
 *
 * Mirrors the library's behaviour: scroll on mount (if enabled), when
 * `enabled` turns true, and when `scrollIntoViewKey` changes while enabled.
 */
import React, { useEffect, useRef } from 'react';
import { View, type ViewProps } from 'react-native';

type Align = 'auto' | 'top' | 'bottom' | 'center';

interface Props extends ViewProps {
  enabled?: boolean;
  scrollIntoViewKey?: string | number | boolean | null;
  animated?: boolean;
  align?: Align;
  insets?: { top?: number; bottom?: number };
  onMount?: boolean;
  onUpdate?: boolean;
  children?: React.ReactNode;
}

const BLOCK: Record<Align, ScrollLogicalPosition> = {
  auto: 'nearest',
  top: 'start',
  bottom: 'end',
  center: 'center',
};

export function ScrollIntoView({
  enabled = true,
  scrollIntoViewKey,
  animated = true,
  align = 'auto',
  insets,
  onMount = true,
  onUpdate = true,
  children,
  ...viewProps
}: Props) {
  // On web, a react-native-web View ref is the underlying DOM element.
  const ref = useRef<View>(null);
  const mounted = useRef(false);

  useEffect(() => {
    const isFirst = !mounted.current;
    mounted.current = true;
    if (!enabled || (isFirst ? !onMount : !onUpdate)) return;
    const node = ref.current as unknown as HTMLElement | null;
    if (!node || typeof node.scrollIntoView !== 'function') return;
    node.style.scrollMarginTop = `${insets?.top ?? 0}px`;
    node.style.scrollMarginBottom = `${insets?.bottom ?? 0}px`;
    node.scrollIntoView({ behavior: animated ? 'smooth' : 'auto', block: BLOCK[align] });
    // Re-run only on the library's triggers: enabled toggling and key changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, scrollIntoViewKey]);

  return (
    <View ref={ref} {...viewProps}>
      {children}
    </View>
  );
}

/** The browser scrolls the nearest scrollable ancestor itself, so no wrapping is needed. */
export function wrapScrollView<T>(component: T): T {
  return component;
}
