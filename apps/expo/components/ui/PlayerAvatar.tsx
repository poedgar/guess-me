import { AVATAR_IMAGES } from '@/constants/avatars';
import { GameColors } from '@/constants/theme';
import React from 'react';
import { Image, StyleSheet } from 'react-native';

interface Props {
  /** Avatar number from `getAvatarId(participant)`. */
  avatarId: number;
  name: string;
  size?: number;
}

export const PlayerAvatar: React.FC<Props> = ({ avatarId, name, size = 32 }) => (
  <Image
    source={AVATAR_IMAGES[(avatarId - 1 + AVATAR_IMAGES.length) % AVATAR_IMAGES.length]}
    accessibilityLabel={name}
    style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}
  />
);

const styles = StyleSheet.create({
  avatar: { backgroundColor: GameColors.cardBg },
});
