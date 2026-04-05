import React from 'react';
import { StyleSheet, View } from 'react-native';
import { LottieAnimation } from './LottieAnimation';

export const LiquidLoaderAnimation: React.FC = () => {
  return (
    <View style={styles.container}>
      <LottieAnimation
        source={require('../../assets/animations/Liquid-4-Dot-Loader.json')}
        autoPlay={true}
        loop={true}
        style={styles.animation}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  animation: {
    width: 90,
    height: 90,
  },
});
