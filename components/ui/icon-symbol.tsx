// Fallback for using MaterialIcons on Android and web.

import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { SymbolViewProps, SymbolWeight } from 'expo-symbols';
import { ComponentProps } from 'react';
import { OpaqueColorValue, type StyleProp, type TextStyle } from 'react-native';

type IconMapping = Record<SymbolViewProps['name'], ComponentProps<typeof MaterialIcons>['name']>;
type IconSymbolName = keyof typeof MAPPING;

/**
 * Add your SF Symbols to Material Icons mappings here.
 * - see Material Icons in the [Icons Directory](https://icons.expo.fyi).
 * - see SF Symbols in the [SF Symbols](https://developer.apple.com/sf-symbols/) app.
 */
const MAPPING = {
  'house.fill': 'home',
  'paperplane.fill': 'send',
  'chevron.left.forwardslash.chevron.right': 'code',
  'chevron.right': 'chevron-right',
  'play.fill': 'play-arrow',
  'plus.circle.fill': 'add-circle',
  'checkmark.circle.fill': 'check-circle',
  'eye.fill': 'visibility',
  'brain.head.profile': 'psychology',
  'arrow.up.circle.fill': 'arrow-circle-up',
  'arrow.right.circle.fill': 'arrow-forward',
  'forward.end.fill': 'skip-next',
  'flag.checkered': 'flag',
  'door.left.hand.open': 'logout',
  'book.fill': 'menu-book',
  'star.fill': 'star',
  'trophy.fill': 'emoji-events',
  'lightbulb.fill': 'lightbulb',
  'crown.fill': 'workspace-premium',
  'hourglass': 'hourglass-empty',
  'lock.shield': 'security',
  'speaker.2.fill': 'volume-up',
  'speaker.1.fill': 'volume-down',
  'speaker.wave.2.fill': 'volume-up',
  'speaker.slash.fill': 'volume-off',
  'hand.point.up.left.fill': 'touch-app',
} as const;

/**
 * An icon component that uses native SF Symbols on iOS, and Material Icons on Android and web.
 * This ensures a consistent look across platforms, and optimal resource usage.
 * Icon `name`s are based on SF Symbols and require manual mapping to Material Icons.
 */
export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
  weight?: SymbolWeight;
}) {
  return <MaterialIcons color={color} size={size} name={MAPPING[name]} style={style} />;
}
