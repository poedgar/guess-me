import { ThemedText } from '@/components/themed-text';
import { ModalStyles } from '@/constants/theme';
import { useSound } from '@/contexts/SoundContext';
import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';

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

  if (!visible) return null;

  return (
    <View style={styles.overlay}>
      <View style={styles.content}>
        {customContent}
        {title ? (
          <ThemedText style={styles.title} lightColor="#000" darkColor="#000">
            {title}
          </ThemedText>
        ) : null}
        {message ? (
          <ThemedText style={styles.message} lightColor="#000" darkColor="#000">
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
                lightColor="#007AFF"
                darkColor="#0A84FF"
              >
                {button.text}
              </ThemedText>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: ModalStyles.overlay,
  content: {
    ...ModalStyles.container,
    alignItems: 'stretch' as const,
  },
  title: ModalStyles.title,
  message: {
    ...ModalStyles.message,
    marginBottom: 16,
  },
  buttons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 16 },
  button: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8, minWidth: 80, alignItems: 'center' },
  buttonDestructive: { backgroundColor: '#ff3b30' },
  buttonText: { fontSize: 16, fontWeight: '600' },
  buttonTextDestructive: { color: '#fff' },
});
