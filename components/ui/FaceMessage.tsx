import React, { useEffect, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { useSound } from '@/contexts/SoundContext';
import * as Haptics from 'expo-haptics';

interface Props {
  visible: boolean;
  message: string;
  face?: string;
  duration?: number;
  onComplete?: () => void;
}

export function FaceMessage({ 
  visible, 
  message, 
  face = '😊', 
  duration = 2000,
  onComplete 
}: Props) {
  const { playSound } = useSound();
  const [fadeAnim] = useState(new Animated.Value(0));
  const [scaleAnim] = useState(new Animated.Value(0.5));

  useEffect(() => {
    if (visible) {
      // Play sound and haptic when message appears
      playSound('success');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      // Animate in
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 100,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start();

      // Auto hide after duration
      const timer = setTimeout(() => {
        hideMessage();
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [visible]);

  const hideMessage = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 0.5,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onComplete?.();
    });
  };

  if (!visible) return null;

  return (
    <View style={styles.overlay}>
      <Animated.View
        style={[
          styles.container,
          {
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        <ThemedText style={styles.face}>{face}</ThemedText>
        <ThemedText style={styles.message}>{message}</ThemedText>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 1000,
  },
  container: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 30,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  face: {
    fontSize: 60,
    marginBottom: 15,
  },
  message: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    color: '#333',
  },
});
