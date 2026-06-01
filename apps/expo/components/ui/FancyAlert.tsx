import { ThemedText } from '@/components/themed-text';
import { GameColors, ModalStyles } from '@/constants/theme';
import { useSound } from '@/contexts/SoundContext';
import React from 'react';
import { Modal, StyleSheet, TouchableOpacity, View } from 'react-native';

export interface FancyAlertButton {
  text: string;
  onPress?: () => void | Promise<void>;
  style?: 'default' | 'destructive' | 'cancel';
}

interface Props {
  visible: boolean;
  title: string | null;
  message?: string | null;
  buttons: FancyAlertButton[];
  onClose: () => void;
  customContent?: React.ReactNode;
}

export function FancyAlert({ visible, title, message, buttons, onClose, customContent }: Props) {
  const { playSound } = useSound();

  return (
    <Modal transparent={true} animationType="fade" visible={visible} onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.content}>
          {customContent}
          {title ? (
            <ThemedText style={[styles.title, customContent != null && styles.titleAfterContent]} lightColor={GameColors.shadow} darkColor={GameColors.shadow}>
              {title}
            </ThemedText>
          ) : null}
          {message ? (
            <ThemedText style={styles.message} lightColor={GameColors.shadow} darkColor={GameColors.shadow}>
              {message}
            </ThemedText>
          ) : null}
          <View style={styles.buttons}>
            {buttons.map((button, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.button,
                  button.style === 'destructive' && styles.buttonDestructive,
                  button.style === 'cancel',
                ]}
                onPress={async () => {
                  try {
                    await playSound('click');
                    if (button.onPress) await button.onPress();
                  } catch (e) {
                    console.error('FancyAlert button error', e);
                  }
                  onClose();
                }}
              >
                <ThemedText
                  style={[
                    styles.buttonText,
                    button.style === 'destructive' && styles.buttonTextDestructive,
                  ]}
                  lightColor={GameColors.blue}
                  darkColor={GameColors.blueDark}
                >
                  {button.text}
                </ThemedText>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: GameColors.overlayBg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  content: {
    ...ModalStyles.container,
    alignItems: 'stretch' as const,
  },
  title: ModalStyles.title,
  titleAfterContent: { marginTop: 8 },
  message: {
    ...ModalStyles.message,
    marginBottom: 16,
  },
  buttons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 16 },
  button: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8, minWidth: 80, alignItems: 'center' },
  buttonDestructive: { backgroundColor: GameColors.danger },
  buttonText: { fontSize: 16, fontWeight: '600' },
  buttonTextDestructive: { color: GameColors.white },
});
