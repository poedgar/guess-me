import { AVATAR_IMAGES } from '@/constants/avatars';
import { GameColors } from '@/constants/theme';
import { t } from '@/i18n';
import React from 'react';
import { Image, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

interface Props {
  /** Avatar number from `assignAnonymousAvatars(...)`. */
  avatarId: number;
  size?: number;
}

/** Cartoon avatar shown next to anonymous content (comments, ideas). */
export const AnonymousAvatar: React.FC<Props> = ({ avatarId, size = 36 }) => (
  <Image
    source={AVATAR_IMAGES[(avatarId - 1 + AVATAR_IMAGES.length) % AVATAR_IMAGES.length]}
    accessibilityLabel={t('common.anonymous')}
    style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}
  />
);

const styles = StyleSheet.create({
  avatar: { backgroundColor: GameColors.cardBg },
});

/** Lays out an anonymous avatar to the left of its content. */
export const WithAnonymousAvatar: React.FC<
  Props & { children: React.ReactNode; style?: StyleProp<ViewStyle> }
> = ({ avatarId, size, children, style }) => (
  <View style={[rowStyles.row, style]}>
    <AnonymousAvatar avatarId={avatarId} size={size} />
    <View style={rowStyles.content}>{children}</View>
  </View>
);

const rowStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  content: { flex: 1, minWidth: 0 },
});
