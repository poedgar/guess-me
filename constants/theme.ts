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
  /** Pure white — icon/text color on colored backgrounds */
  white: '#FFFFFF',
  /** Shadow color */
  shadow: '#000000',
  /** Gold / trophy / achievement */
  gold: '#FFD700',
  /** Primary dark text */
  textDark: '#333333',
  /** Secondary / muted text */
  textMedium: '#666666',
  /** Tertiary text */
  textLight: '#555555',
  /** Modal / overlay background */
  overlayBg: 'rgba(0,0,0,0.5)',
  /** Darker overlay (e.g. QR scanner) */
  overlayBgDark: 'rgba(0,0,0,0.8)',
  /** Subtle card background */
  cardBg: 'rgba(0,0,0,0.05)',
  /** Subtle card border */
  cardBorder: 'rgba(0,0,0,0.1)',
  /** iOS toggle track */
  toggleTrack: '#767577',
  /** iOS toggle thumb */
  toggleThumb: '#F4F3F4',
  /** Light page background */
  lightPageBg: '#F8F9FA',
  /** Blue — dark mode variant */
  blueDark: '#0A84FF',
  /** Negative points / loss indicator */
  negative: '#DC2626',
  /** Green tint background */
  greenTint: 'rgba(52, 199, 89, 0.1)',
  /** Gold tint background (1st place) */
  goldTint: 'rgba(255, 215, 0, 0.2)',
  /** Gold tint border (1st place) */
  goldTintBorder: 'rgba(255, 215, 0, 0.5)',
  /** Blue tint background (current user) */
  blueTint: 'rgba(0, 122, 255, 0.15)',
  /** Blue tint border (current user) */
  blueTintBorder: 'rgba(0, 122, 255, 0.3)',
  /** Guessing phase — deep orange */
  deepOrange: '#FF7800',
  /** Phase tint backgrounds and borders */
  waitingTint: 'rgba(255,149,0,0.06)',
  waitingTintBorder: 'rgba(255,149,0,0.15)',
  activeTint: 'rgba(52,199,89,0.06)',
  activeTintBorder: 'rgba(52,199,89,0.15)',
  guessingTint: 'rgba(255,120,0,0.06)',
  guessingTintBorder: 'rgba(255,120,0,0.15)',
  resultsTint: 'rgba(255,215,0,0.08)',
  resultsTintBorder: 'rgba(255,215,0,0.25)',
  basketWritingTint: 'rgba(0,122,255,0.06)',
  basketWritingTintBorder: 'rgba(0,122,255,0.15)',
  basketGuessingTint: 'rgba(175,82,222,0.06)',
  basketGuessingTintBorder: 'rgba(175,82,222,0.15)',
  clashWritingTint: 'rgba(255,120,0,0.06)',
  clashWritingTintBorder: 'rgba(255,120,0,0.15)',
  clashGuessingTint: 'rgba(255,80,0,0.06)',
  clashGuessingTintBorder: 'rgba(255,80,0,0.15)',
};

/** Status badge background colors, keyed by game status string. */
export const StatusColors: Record<string, string> = {
  waiting: '#FF9500',
  active: '#34C759',
  guessing_phase: '#AF52DE',
  finished: '#8E8E93',
  basket_writing: '#007AFF',
  basket_guessing: '#AF52DE',
  clash_writing: '#FF7800',
  clash_guessing: '#FF5000',
};

/** Shared modal styles for FancyAlert and FaceMessage */
export const ModalStyles = {
  overlay: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: GameColors.overlayBg,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    padding: 20,
    zIndex: 1000,
  },
  container: {
    width: '85%' as const,
    backgroundColor: GameColors.white,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center' as const,
    shadowColor: GameColors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: '600' as const,
    marginBottom: 8,
    textAlign: 'center' as const,
    color: GameColors.shadow,
  },
  message: {
    fontSize: 15,
    textAlign: 'center' as const,
    color: GameColors.textDark,
  },
};

/** Returns themed style + placeholderTextColor for a TextInput, based on dark/light mode. */
export function themedInput(isDark: boolean) {
  return {
    style: {
      backgroundColor: isDark ? GameColors.inputDark : GameColors.inputLight,
      color: isDark ? Colors.dark.text : Colors.light.text,
      borderColor: isDark ? GameColors.inputBorderDark : GameColors.inputBorderLight,
    },
    placeholderTextColor: isDark ? GameColors.placeholderDark : GameColors.placeholderLight,
  };
}

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
