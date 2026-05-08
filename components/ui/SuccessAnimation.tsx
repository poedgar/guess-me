import React from 'react';
import { StyleSheet, View } from 'react-native';
import { LottieAnimation } from './LottieAnimation';

export const SuccessAnimation: React.FC = () => {
  return (
    <View style={styles.container}>
      <LottieAnimation
        source={require('../../assets/animations/Success.json')}
        autoPlay={true}
        loop={false}
        style={styles.animation}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  animation: {
    width: 120,
    height: 120,
  },
});
