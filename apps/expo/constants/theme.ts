/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { Platform } from 'react-native';

// Earthy palette taken from the "У дзеркалі" logo: cream, olive, forest green, browns.
const tintColorLight = '#6E762C';
const tintColorDark = '#C9C27A';

export const Colors = {
  light: {
    text: '#2E2416',
    background: '#FBF5E6',
    tint: tintColorLight,
    icon: '#7C6A50',
    tabIconDefault: '#9A8A6C',
    tabIconSelected: tintColorLight,
  },
  dark: {
    text: '#EFE6D2',
    background: '#1C1A14',
    tint: tintColorDark,
    icon: '#A89C80',
    tabIconDefault: '#8C8270',
    tabIconSelected: tintColorDark,
  },
};

/** Semantic game colors — earthy palette from the logo. Use these instead of hardcoded hex values. */
export const GameColors = {
  /** Primary action / success / points awarded — olive */
  green: '#6E762C',
  /** Admin controls / show comments — burnt orange */
  admin: '#C0702A',
  /** Guessing phase / start guessing button — warm brown */
  purple: '#7C5725',
  /** Comment submit / main buttons — forest green */
  blue: '#3C5946',
  /** Destructive actions / leave / error — brick */
  danger: '#A63D2A',
  /** Waiting status badge — burnt orange (same as admin) */
  waiting: '#C0702A',
  /** Correct guess / positive feedback — olive */
  correct: '#6E762C',
  /** Incorrect guess / negative feedback — brick */
  incorrect: '#A63D2A',
  /** Correct guess result background */
  correctBg: '#EEF0D8',
  /** Incorrect guess result background */
  incorrectBg: '#F6E1D9',
  /** Neutral / grey / skipped — warm grey */
  neutral: '#8C8270',
  /** Dark-mode input background */
  inputDark: '#2A271E',
  /** Light-mode input background */
  inputLight: '#F3ECDB',
  /** Dark-mode input border */
  inputBorderDark: '#3D392C',
  /** Light-mode input border */
  inputBorderLight: '#D9CBA8',
  /** Placeholder text in dark mode */
  placeholderDark: '#8C8270',
  /** Placeholder text in light mode */
  placeholderLight: '#9A8C70',
  /** White — icon/text color on colored backgrounds */
  white: '#FFFFFF',
  /** Shadow color (also used for dark modal title text) */
  shadow: '#2E2416',
  /** Gold / trophy / achievement — mustard */
  gold: '#C9A227',
  /** Primary dark text */
  textDark: '#3B2E1E',
  /** Secondary / muted text */
  textMedium: '#6B5B45',
  /** Tertiary text */
  textLight: '#5E4E3A',
  /** Modal / overlay background */
  overlayBg: 'rgba(46,36,22,0.5)',
  /** Darker overlay (e.g. QR scanner) */
  overlayBgDark: 'rgba(46,36,22,0.8)',
  /** Subtle card background */
  cardBg: 'rgba(94,61,23,0.06)',
  /** Subtle card border */
  cardBorder: 'rgba(94,61,23,0.14)',
  /** Toggle track */
  toggleTrack: '#9A8C70',
  /** Toggle thumb */
  toggleThumb: '#FBF5E6',
  /** Light page background */
  lightPageBg: '#FBF5E6',
  /** Forest green — dark mode variant */
  blueDark: '#7FA08A',
  /** Negative points / loss indicator */
  negative: '#A63D2A',
  /** Olive tint background */
  greenTint: 'rgba(110,118,44,0.12)',
  /** Gold tint background (1st place) */
  goldTint: 'rgba(201,162,39,0.2)',
  /** Gold tint border (1st place) */
  goldTintBorder: 'rgba(201,162,39,0.5)',
  /** Forest tint background (current user) */
  blueTint: 'rgba(60,89,70,0.15)',
  /** Forest tint border (current user) */
  blueTintBorder: 'rgba(60,89,70,0.3)',
  /** Guessing phase — deep burnt orange */
  deepOrange: '#B05A22',
  /** Phase tint backgrounds and borders */
  waitingTint: 'rgba(192,112,42,0.07)',
  waitingTintBorder: 'rgba(192,112,42,0.18)',
  activeTint: 'rgba(110,118,44,0.07)',
  activeTintBorder: 'rgba(110,118,44,0.18)',
  guessingTint: 'rgba(176,90,34,0.07)',
  guessingTintBorder: 'rgba(176,90,34,0.18)',
  resultsTint: 'rgba(201,162,39,0.1)',
  resultsTintBorder: 'rgba(201,162,39,0.28)',
  basketWritingTint: 'rgba(60,89,70,0.07)',
  basketWritingTintBorder: 'rgba(60,89,70,0.18)',
  basketGuessingTint: 'rgba(124,87,37,0.07)',
  basketGuessingTintBorder: 'rgba(124,87,37,0.18)',
  clashWritingTint: 'rgba(176,90,34,0.07)',
  clashWritingTintBorder: 'rgba(176,90,34,0.18)',
  clashGuessingTint: 'rgba(166,61,42,0.07)',
  clashGuessingTintBorder: 'rgba(166,61,42,0.18)',
};

/** Status badge background colors, keyed by game status string. */
export const StatusColors: Record<string, string> = {
  waiting: '#C0702A',
  active: '#6E762C',
  guessing_phase: '#7C5725',
  finished: '#8C8270',
  basket_writing: '#3C5946',
  basket_guessing: '#7C5725',
  clash_writing: '#B05A22',
  clash_guessing: '#A63D2A',
  idea_writing: '#3C5946',
  idea_rating: '#7C5725',
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
    backgroundColor: '#FFFCF4',
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
