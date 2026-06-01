import { Fonts, GameColors } from '@/constants/theme';
import React, { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

interface Props {
  name: string;
  photoURL?: string | null;
  size?: number;
}

export const PlayerAvatar: React.FC<Props> = ({ name, photoURL, size = 32 }) => {
  const [imgFailed, setImgFailed] = useState(false);
  const initial = name.trim()[0]?.toUpperCase() ?? '?';
  const style = { width: size, height: size, borderRadius: size / 2 };

  if (photoURL && !imgFailed) {
    return (
      <Image
        source={{ uri: photoURL }}
        style={[styles.avatar, style]}
        onError={() => setImgFailed(true)}
      />
    );
  }

  return (
    <View style={[styles.placeholder, style, { backgroundColor: GameColors.admin }]}>
      <Text style={[styles.initial, { fontSize: size * 0.42 }]}>{initial}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  avatar: { backgroundColor: GameColors.cardBg },
  placeholder: { alignItems: 'center', justifyContent: 'center' },
  initial: { color: GameColors.white, fontWeight: '700', fontFamily: Fonts.sans },
});
