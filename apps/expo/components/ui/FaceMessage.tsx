import { ThemedText } from '@/components/themed-text';
import { GameColors } from '@/constants/theme';
import { useSound } from '@/contexts/SoundContext';
import * as Haptics from 'expo-haptics';
import React, { useEffect, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

interface Props {
  visible: boolean;
  message: string;
  face?: React.ReactNode;
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
      playSound('success').catch(() => {});
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      
      // Animate in
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: false,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 100,
          friction: 8,
          useNativeDriver: false,
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
        useNativeDriver: false,
      }),
      Animated.timing(scaleAnim, {
        toValue: 0.5,
        duration: 300,
        useNativeDriver: false,
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
        {typeof face === 'string' ? (
          <ThemedText style={styles.face}>{face}</ThemedText>
        ) : (
          <View style={styles.customContent}>{face}</View>
        )}
        
        <ThemedText style={styles.message}>{message}</ThemedText>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  container: {
    width: '85%' as const,
    backgroundColor: GameColors.white,
    borderRadius: 16,
    padding: 30,
    alignItems: 'center' as const,
    shadowColor: GameColors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10,
  },
  face: {
    fontSize: 60,
    marginBottom: 15,
  },
  customContent: {
    marginBottom: 15,
  },
  message: { fontSize: 15, textAlign: 'center' as const, color: GameColors.textDark },
});
