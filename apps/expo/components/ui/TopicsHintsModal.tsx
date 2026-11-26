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

interface Topic {
  titleKey: string;
  questionKey?: string;
  hintKeys?: string[];
}

const TOPICS: Topic[] = [
  { titleKey: 'game.ui.topicsHints.topic1Title', questionKey: 'game.ui.topicsHints.topic1Question' },
  {
    titleKey: 'game.ui.topicsHints.topic2Title',
    hintKeys: ['game.ui.topicsHints.topic2HintA', 'game.ui.topicsHints.topic2HintB', 'game.ui.topicsHints.topic2HintC'],
  },
  {
    titleKey: 'game.ui.topicsHints.topic3Title',
    hintKeys: ['game.ui.topicsHints.topic3HintA', 'game.ui.topicsHints.topic3HintB', 'game.ui.topicsHints.topic3HintC'],
  },
  {
    titleKey: 'game.ui.topicsHints.topic4Title',
    hintKeys: ['game.ui.topicsHints.topic4HintA', 'game.ui.topicsHints.topic4HintB', 'game.ui.topicsHints.topic4HintC'],
  },
  {
    titleKey: 'game.ui.topicsHints.topic5Title',
    hintKeys: ['game.ui.topicsHints.topic5HintA', 'game.ui.topicsHints.topic5HintB', 'game.ui.topicsHints.topic5HintC'],
  },
];

const HINT_LABELS = ['а', 'б', 'в'];

export function TopicsHintsModal({ visible, onClose, locale }: Props) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [showHints, setShowHints] = useState(false);
  const activeTopic = TOPICS[activeIndex];

  const handleClose = () => {
    setShowHints(false);
    onClose();
  };

  return (
    <>
      <Modal transparent animationType="fade" visible={visible} onRequestClose={handleClose}>
        <View style={styles.overlay}>
          <View style={styles.content}>
            <ThemedText style={styles.title} lightColor={GameColors.shadow} darkColor={GameColors.shadow}>
              {t('game.ui.topicsHints.modalTitle', { locale })}
            </ThemedText>

            <View style={styles.circleRow}>
              {TOPICS.map((_, idx) => (
                <TouchableOpacity
                  key={idx}
                  onPress={() => {
                    setActiveIndex(idx);
                    setShowHints(false);
                  }}
                  style={[styles.circle, activeIndex === idx && styles.circleActive]}
                >
                  <ThemedText style={[styles.circleText, activeIndex === idx && styles.circleTextActive]}>
                    {idx + 1}
                  </ThemedText>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.topicBlock}>
              <View style={styles.topicHeaderRow}>
                <ThemedText
                  style={styles.topicTitle}
                  lightColor={GameColors.shadow}
                  darkColor={GameColors.shadow}
                >
                  {t(activeTopic.titleKey, { locale })}
                </ThemedText>
                {activeTopic.hintKeys && (
                  <TouchableOpacity
                    onPress={() => setShowHints(true)}
                    accessibilityLabel={t('game.ui.topicsHints.hintsButtonLabel', { locale })}
                    style={styles.hintsTrigger}
                  >
                    <ThemedText style={styles.hintsTriggerText}>▶</ThemedText>
                  </TouchableOpacity>
                )}
              </View>
              {activeTopic.questionKey && (
                <ThemedText style={styles.questionText} lightColor={GameColors.shadow} darkColor={GameColors.shadow}>
                  {t(activeTopic.questionKey, { locale })}
                </ThemedText>
              )}
            </View>

            <TouchableOpacity style={styles.doneButton} onPress={handleClose}>
              <ThemedText style={styles.doneButtonText}>{t('common.done', { locale })}</ThemedText>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        transparent
        animationType="fade"
        visible={visible && showHints && !!activeTopic.hintKeys}
        onRequestClose={() => setShowHints(false)}
      >
        <View style={styles.overlay}>
          <View style={styles.content}>
            <ThemedText style={styles.title} lightColor={GameColors.shadow} darkColor={GameColors.shadow}>
              {t('game.ui.topicsHints.hintsModalTitle', { locale })}
            </ThemedText>
            <View style={styles.hintsBlock}>
              {(activeTopic.hintKeys ?? []).map((key, idx) => (
                <ThemedText key={key} style={styles.questionText} lightColor={GameColors.shadow} darkColor={GameColors.shadow}>
                  {HINT_LABELS[idx]}) {t(key, { locale })}
                </ThemedText>
              ))}
            </View>
            <TouchableOpacity style={styles.doneButton} onPress={() => setShowHints(false)}>
              <ThemedText style={styles.doneButtonText}>{t('common.done', { locale })}</ThemedText>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
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
  circleRow: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  circle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: GameColors.cardBg,
  },
  circleActive: { backgroundColor: GameColors.admin },
  circleText: { fontSize: 13, fontWeight: '700' },
  circleTextActive: { color: GameColors.white },
  topicBlock: { marginBottom: 20 },
  topicHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  topicTitle: { fontSize: 15, fontWeight: '700', flex: 1 },
  hintsTrigger: { paddingHorizontal: 8, paddingVertical: 4 },
  hintsTriggerText: { fontSize: 16, color: GameColors.admin },
  questionText: { fontSize: 15, lineHeight: 21, marginTop: 8 },
  hintsBlock: { gap: 8, marginBottom: 20 },
  doneButton: { backgroundColor: GameColors.neutral, paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  doneButtonText: { color: GameColors.white, fontWeight: '700', fontSize: 15 },
});
