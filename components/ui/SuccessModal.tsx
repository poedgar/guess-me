import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { GameColors } from '@/constants/theme';
import { SuccessAnimation } from './SuccessAnimation';
import { useSound } from '@/contexts/SoundContext';
import * as Haptics from 'expo-haptics';

interface Props {
  visible: boolean;
  title: string;
  message?: string;
  onClose: () => void;
  buttonText?: string;
}

export function SuccessModal({ visible, title, message, onClose, buttonText = 'OK' }: Props) {
  const { playSound } = useSound();

  const handleClose = async () => {
    try {
      await playSound('click');
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onClose();
    } catch (error) {
      console.error('Error closing modal:', error);
    }
  };

  if (!visible) return null;

  return (
    <View style={styles.overlay}>
      <View style={styles.content}>
        <SuccessAnimation />
        
        <ThemedText style={styles.title} lightColor={GameColors.shadow} darkColor={GameColors.shadow}>
          {title}
        </ThemedText>

        {message && (
          <ThemedText style={styles.message} lightColor={GameColors.shadow} darkColor={GameColors.shadow}>
            {message}
          </ThemedText>
        )}

        <TouchableOpacity
          style={styles.button}
          onPress={handleClose}
          activeOpacity={0.8}
        >
          <ThemedText style={styles.buttonText} lightColor={GameColors.white} darkColor={GameColors.white}>
            {buttonText}
          </ThemedText>
        </TouchableOpacity>
      </View>
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
    backgroundColor: GameColors.overlayBg,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  content: {
    backgroundColor: GameColors.white,
    borderRadius: 20,
    padding: 30,
    alignItems: 'center',
    shadowColor: GameColors.shadow,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
    maxWidth: '80%',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 16,
    color: GameColors.textDark,
  },
  message: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
    color: GameColors.textMedium,
    lineHeight: 22,
  },
  button: {
    backgroundColor: GameColors.green,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 32,
    alignItems: 'center',
    shadowColor: GameColors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: GameColors.white,
  },
});
