import React from 'react';
import { View, StyleSheet } from 'react-native';
import LottieView from 'lottie-react-native';

interface LottieAnimationProps {
  source: any;
  autoPlay?: boolean;
  loop?: boolean;
  style?: any;
  onAnimationFinish?: () => void;
}

export const LottieAnimation: React.FC<LottieAnimationProps> = ({
  source,
  autoPlay = true,
  loop = true,
  style,
  onAnimationFinish,
}) => {
  return (
    <View style={[styles.container, style]}>
      <LottieView
        source={source}
        autoPlay={autoPlay}
        loop={loop}
        style={styles.lottie}
        onAnimationFinish={onAnimationFinish}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  lottie: {
    width: '100%',
    height: '100%',
  },
});
