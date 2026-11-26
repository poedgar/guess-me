import { ThemedText } from '@/components/themed-text';
import { GameColors, ModalStyles } from '@/constants/theme';
import { t } from '@/i18n';
import React from 'react';
import { Modal, StyleSheet, TouchableOpacity, View } from 'react-native';
import { HINT_LABELS } from './topicsData';

interface Props {
  visible: boolean;
  hintKeys: string[];
  onClose: () => void;
  locale: string;
}

export function TopicHintsModal({ visible, hintKeys, onClose, locale }: Props) {
  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.content}>
          <ThemedText style={styles.title} lightColor={GameColors.shadow} darkColor={GameColors.shadow}>
            {t('game.ui.topicsHints.hintsModalTitle', { locale })}
          </ThemedText>
          <View style={styles.hintsBlock}>
            {hintKeys.map((key, idx) => (
              <ThemedText key={key} style={styles.hintText} lightColor={GameColors.shadow} darkColor={GameColors.shadow}>
                {HINT_LABELS[idx]}) {t(key, { locale })}
              </ThemedText>
            ))}
          </View>
          <TouchableOpacity style={styles.doneButton} onPress={onClose}>
            <ThemedText style={styles.doneButtonText}>{t('common.done', { locale })}</ThemedText>
          </TouchableOpacity>
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
  content: { ...ModalStyles.container, alignItems: 'stretch' as const },
  title: { fontSize: 18, fontWeight: '700', textAlign: 'center', marginBottom: 16 },
  hintsBlock: { gap: 8, marginBottom: 20 },
  hintText: { fontSize: 15, lineHeight: 21 },
  doneButton: { backgroundColor: GameColors.neutral, paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  doneButtonText: { color: GameColors.white, fontWeight: '700', fontSize: 15 },
});
