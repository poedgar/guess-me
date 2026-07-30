// TDD: usePulseBorderOnChange fires the border animation once per distinct
// triggerKey value, and skips it entirely when reduced motion is enabled.
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { Animated } from 'react-native';
import { usePulseBorderOnChange } from '../hooks/usePulseBorderOnChange';

let mockReduceMotionEnabled = false;
jest.mock('react-native', () => {
  const actual = jest.requireActual('react-native');
  // NOTE: deviates from a plain `{ ...actual, AccessibilityInfo: {...} }`
  // spread. RN 0.81's `index.js` exposes several exports (DevMenu,
  // SettingsManager, ...) as lazy getters backed by TurboModules that throw
  // when evaluated outside a real native runtime. An object spread forces
  // every getter to run immediately, crashing the whole test file in Jest.
  // A Proxy only touches the one export we actually override, leaving every
  // other export exactly as lazy as an unmocked `require('react-native')`.
  return new Proxy(actual, {
    get(target, prop, receiver) {
      if (prop === 'AccessibilityInfo') {
        return {
          ...actual.AccessibilityInfo,
          isReduceMotionEnabled: jest.fn(() => Promise.resolve(mockReduceMotionEnabled)),
        };
      }
      return Reflect.get(target, prop, receiver);
    },
  });
});

describe('usePulseBorderOnChange', () => {
  beforeEach(() => {
    mockReduceMotionEnabled = false;
    jest.spyOn(Animated, 'timing');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('starts the animation once when triggerKey first appears', async () => {
    const { result } = renderHook(() => usePulseBorderOnChange('round-1:admin', '#34C759'));

    await waitFor(() => {
      expect(Animated.timing).toHaveBeenCalledTimes(1);
    });

    expect(result.current.borderWidth).toBe(2);
    expect(result.current.borderRadius).toBe(12);
    expect(result.current.borderColor).toBeDefined();
  });

  it('does not re-fire when triggerKey is unchanged across re-renders', async () => {
    const { rerender } = renderHook(
      ({ key }) => usePulseBorderOnChange(key, '#34C759'),
      { initialProps: { key: 'round-1:admin' } },
    );

    await waitFor(() => {
      expect(Animated.timing).toHaveBeenCalledTimes(1);
    });

    rerender({ key: 'round-1:admin' });
    rerender({ key: 'round-1:admin' });

    expect(Animated.timing).toHaveBeenCalledTimes(1);
  });

  it('fires again when triggerKey changes', async () => {
    const { rerender } = renderHook(
      ({ key }) => usePulseBorderOnChange(key, '#34C759'),
      { initialProps: { key: 'round-1:admin' } },
    );

    await waitFor(() => {
      expect(Animated.timing).toHaveBeenCalledTimes(1);
    });

    act(() => {
      rerender({ key: 'round-2:admin' });
    });

    await waitFor(() => {
      expect(Animated.timing).toHaveBeenCalledTimes(2);
    });
  });

  it('does not start the animation when reduced motion is enabled', async () => {
    mockReduceMotionEnabled = true;
    renderHook(() => usePulseBorderOnChange('round-1:admin', '#34C759'));

    // Give the isReduceMotionEnabled() promise a tick to resolve, then confirm
    // no animation was ever started.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(Animated.timing).not.toHaveBeenCalled();
  });
});
