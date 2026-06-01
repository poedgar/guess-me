import React from 'react';
import { StyleSheet, View } from 'react-native';
import { LottieAnimation } from './LottieAnimation';

export const SuccessAnimation1: React.FC = () => {
  return (
    <View style={styles.container}>
      <LottieAnimation
        source={require('../../assets/animations/Success1.json')}
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
    width: 230,
    height: 230,
  },
});
