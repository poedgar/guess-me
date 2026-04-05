/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { Platform } from 'react-native';

const tintColorLight = '#0a7ea4';
const tintColorDark = '#fff';

export const Colors = {
  light: {
    text: '#11181C',
    background: '#fff',
    tint: tintColorLight,
    icon: '#687076',
    tabIconDefault: '#687076',
    tabIconSelected: tintColorLight,
  },
  dark: {
    text: '#ECEDEE',
    background: '#151718',
    tint: tintColorDark,
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: tintColorDark,
  },
};

/** Semantic game colors — iOS HIG system palette. Use these instead of hardcoded hex values. */
export const GameColors = {
  /** Primary action / success / points awarded — iOS green */
  green: '#34C759',
  /** Admin controls / show comments — iOS orange */
  admin: '#FF9500',
  /** Guessing phase / start guessing button — iOS purple */
  purple: '#AF52DE',
  /** Comment submit / Google auth — iOS blue */
  blue: '#007AFF',
  /** Destructive actions / leave / error — iOS red */
  danger: '#FF3B30',
  /** Waiting status badge — iOS orange (same as admin) */
  waiting: '#FF9500',
  /** Correct guess / positive feedback — iOS green */
  correct: '#34C759',
  /** Incorrect guess / negative feedback — iOS red */
  incorrect: '#FF3B30',
  /** Correct guess result background */
  correctBg: '#E6F9EC',
  /** Incorrect guess result background */
  incorrectBg: '#FFEBE9',
  /** Neutral / grey / skipped — iOS gray */
  neutral: '#8E8E93',
  /** Dark-mode input background — iOS grouped secondary */
  inputDark: '#2C2C2E',
  /** Light-mode input background — iOS grouped secondary */
  inputLight: '#F2F2F7',
  /** Dark-mode input border — iOS separator dark */
  inputBorderDark: '#3A3A3C',
  /** Light-mode input border — iOS separator light */
  inputBorderLight: '#C6C6C8',
  /** Placeholder text in dark mode — iOS gray */
  placeholderDark: '#8E8E93',
  /** Placeholder text in light mode — iOS gray */
  placeholderLight: '#8E8E93',
};

/** Status badge background colors, keyed by game status string. */
export const StatusColors: Record<string, string> = {
  waiting: '#FF9500',
  active: '#34C759',
  guessing_phase: '#AF52DE',
  finished: '#8E8E93',
};

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'Philosopher-Regular',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'Philosopher-Regular',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'Philosopher-Regular',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'Philosopher-Regular',
    serif: 'Philosopher-Regular',
    rounded: 'Philosopher-Regular',
    mono: 'monospace',
  },
  web: {
    sans: "Philosopher-Regular, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Philosopher-Regular, Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
