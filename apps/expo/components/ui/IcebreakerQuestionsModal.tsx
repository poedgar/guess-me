import { ThemedText } from '@/components/themed-text';
import { GameColors, ModalStyles } from '@/constants/theme';
import { t } from '@/i18n';
import React, { useState } from 'react';
import { Modal, StyleSheet, TouchableOpacity, View } from 'react-native';

interface Props {
  visible: boolean;
  onClose: () => void;
  locale: string;
}

const QUESTIONS = [
  { a: 'game.ui.icebreaker.question1a', b: 'game.ui.icebreaker.question1b' },
  { a: 'game.ui.icebreaker.question2a', b: 'game.ui.icebreaker.question2b' },
  { a: 'game.ui.icebreaker.question3a', b: 'game.ui.icebreaker.question3b' },
];

export function IcebreakerQuestionsModal({ visible, onClose, locale }: Props) {
  const [activeIndex, setActiveIndex] = useState(0);

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.content}>
          <ThemedText style={styles.title} lightColor={GameColors.shadow} darkColor={GameColors.shadow}>
            {t('game.ui.icebreaker.modalTitle', { locale })}
          </ThemedText>
          <ThemedText style={styles.instructions} lightColor={GameColors.shadow} darkColor={GameColors.shadow}>
            {t('game.ui.icebreaker.instructions', { locale })}
          </ThemedText>

          <View style={styles.circleRow}>
            {QUESTIONS.map((_, idx) => (
              <TouchableOpacity
                key={idx}
                onPress={() => setActiveIndex(idx)}
                style={[styles.circle, activeIndex === idx && styles.circleActive]}
              >
                <ThemedText style={[styles.circleText, activeIndex === idx && styles.circleTextActive]}>
                  {idx + 1}
                </ThemedText>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.questionBlock}>
            <ThemedText style={styles.questionText} lightColor={GameColors.shadow} darkColor={GameColors.shadow}>
              а) {t(QUESTIONS[activeIndex].a, { locale })}
            </ThemedText>
            <ThemedText style={styles.questionText} lightColor={GameColors.shadow} darkColor={GameColors.shadow}>
              б) {t(QUESTIONS[activeIndex].b, { locale })}
            </ThemedText>
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
  title: { fontSize: 18, fontWeight: '700', textAlign: 'center', marginBottom: 8 },
  instructions: { fontSize: 13, opacity: 0.7, textAlign: 'center', marginBottom: 16 },
  circleRow: { flexDirection: 'row', justifyContent: 'center', gap: 12, marginBottom: 16 },
  circle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: GameColors.cardBg,
  },
  circleActive: { backgroundColor: GameColors.admin },
  circleText: { fontSize: 14, fontWeight: '700' },
  circleTextActive: { color: GameColors.white },
  questionBlock: { gap: 8, marginBottom: 20 },
  questionText: { fontSize: 15, lineHeight: 21 },
  doneButton: { backgroundColor: GameColors.neutral, paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  doneButtonText: { color: GameColors.white, fontWeight: '700', fontSize: 15 },
});
