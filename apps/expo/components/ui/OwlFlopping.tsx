import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { LottieAnimation } from './LottieAnimation';

const AnimatedView = Animated.createAnimatedComponent(View);

export const OwlFlopping: React.FC = () => {
  const rotation = useSharedValue(0);
  const translateY = useSharedValue(0);

  useEffect(() => {
    // Flopping rotation animation - two wings flopping
    rotation.value = withRepeat(
      withSequence(
        withTiming(-20, { duration: 250, easing: Easing.inOut(Easing.ease) }),
        withTiming(20, { duration: 250, easing: Easing.inOut(Easing.ease) }),
        withTiming(-15, { duration: 200, easing: Easing.inOut(Easing.ease) }),
        withTiming(15, { duration: 200, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 150, easing: Easing.out(Easing.ease) })
      ),
      -1,
      true
    );

    // Bouncing vertical movement for flop effect
    translateY.value = withRepeat(
      withSequence(
        withTiming(-15, { duration: 300, easing: Easing.out(Easing.ease) }),
        withTiming(8, { duration: 250, easing: Easing.in(Easing.ease) }),
        withTiming(-10, { duration: 280, easing: Easing.out(Easing.ease) }),
        withTiming(0, { duration: 200, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { rotate: `${rotation.value}deg` },
      { translateY: translateY.value },
    ],
  }));

  return (
    <View style={styles.container}>
      <AnimatedView style={[styles.animationWrapper, animatedStyle]}>
        <LottieAnimation
          source={require('../../assets/animations/Owl.json')}
          autoPlay={true}
          loop={true}
          style={styles.animation}
        />
      </AnimatedView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  animationWrapper: {
    width: 230,
    height: 230,
  },
  animation: {
    width: '100%',
    height: '100%',
  },
});
