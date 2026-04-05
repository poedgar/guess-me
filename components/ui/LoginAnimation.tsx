import React from 'react';
import { StyleSheet, View } from 'react-native';
import { LottieAnimation } from './LottieAnimation';

export const LoginAnimation: React.FC = () => {
  return (
    <View style={styles.container}>
      <LottieAnimation
        source={require('../../assets/animations/Login.json')}
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
    width: 200,
    height: 200,
  },
});
