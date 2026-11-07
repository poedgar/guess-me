import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated } from 'react-native';

/**
 * Returns an animated border style to spread onto an Animated.View's style
 * array. Animates the border color from `color` to transparent once
 * whenever triggerKey changes (including on first mount), and never
 * re-fires for a re-render with the same key. No-ops (border stays
 * transparent) when the OS has reduced motion enabled. borderWidth is
 * always present, even when transparent, so the border never causes a
 * layout shift when it appears/disappears.
 */
export function usePulseBorderOnChange(triggerKey: string | number, color: string) {
  const progress = useRef(new Animated.Value(0)).current;
  const lastKey = useRef<string | number | null>(null);
  // null = not yet determined. The pulse effect below must wait for this to
  // resolve before it can safely decide whether to fire; if it defaulted to
  // `false` it would always animate on mount before the async
  // isReduceMotionEnabled() check comes back, even when reduced motion is on.
  const [reduceMotion, setReduceMotion] = useState<boolean | null>(null);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setReduceMotion(enabled);
    });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (reduceMotion === null) return;
    if (lastKey.current === triggerKey) return;
    lastKey.current = triggerKey;
    if (reduceMotion) return;
    progress.setValue(1);
    const animation = Animated.timing(progress, {
      toValue: 0,
      duration: 900,
      useNativeDriver: false,
    });
    animation.start();
    // Stop the in-flight animation on unmount (or before a new one starts)
    // so its internal timer loop doesn't keep firing after the component
    // is gone.
    return () => {
      animation.stop();
    };
  }, [triggerKey, reduceMotion]);

  return {
    borderWidth: 2,
    borderRadius: 12,
    borderColor: progress.interpolate({
      inputRange: [0, 1],
      outputRange: ['transparent', color],
    }),
  };
}
