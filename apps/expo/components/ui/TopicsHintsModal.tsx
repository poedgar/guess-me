import { ThemedText } from '@/components/themed-text';
import { GameColors, ModalStyles } from '@/constants/theme';
import { t } from '@/i18n';
import React, { useState } from 'react';
import { Modal, StyleSheet, TouchableOpacity, View } from 'react-native';
import { TOPICS } from './topicsData';
import { TopicHintsModal } from './TopicHintsModal';

interface Props {
  visible: boolean;
  activeIndex: number | null;
  onSelect: (index: number) => void;
  onClear: () => void;
  onClose: () => void;
  locale: string;
}

export function TopicsHintsModal({ visible, activeIndex, onSelect, onClear, onClose, locale }: Props) {
  const [showHints, setShowHints] = useState(false);
  const activeTopic = activeIndex != null ? TOPICS[activeIndex] : null;

  return (
    <>
      <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
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
                    setShowHints(false);
                    onSelect(idx);
                  }}
                  style={[styles.circle, activeIndex === idx && styles.circleActive]}
                >
                  <ThemedText style={[styles.circleText, activeIndex === idx && styles.circleTextActive]}>
                    {idx + 1}
                  </ThemedText>
                </TouchableOpacity>
              ))}
            </View>

            {activeTopic ? (
              <View style={styles.topicBlock}>
                <View style={styles.topicHeaderRow}>
                  <ThemedText style={styles.topicTitle} lightColor={GameColors.shadow} darkColor={GameColors.shadow}>
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
                <ThemedText style={styles.visibleNote}>
                  {t('game.ui.topicsHints.visibleToEveryone', { locale })}
                </ThemedText>
                <TouchableOpacity onPress={onClear}>
                  <ThemedText style={styles.clearButtonText}>
                    {t('game.ui.topicsHints.hideButton', { locale })}
                  </ThemedText>
                </TouchableOpacity>
              </View>
            ) : (
              <ThemedText style={styles.pickPrompt}>
                {t('game.ui.topicsHints.pickPrompt', { locale })}
              </ThemedText>
            )}

            <TouchableOpacity style={styles.doneButton} onPress={onClose}>
              <ThemedText style={styles.doneButtonText}>{t('common.done', { locale })}</ThemedText>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <TopicHintsModal
        visible={visible && showHints && !!activeTopic?.hintKeys}
        hintKeys={activeTopic?.hintKeys ?? []}
        onClose={() => setShowHints(false)}
        locale={locale}
      />
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
  visibleNote: { fontSize: 12, opacity: 0.6, marginTop: 10 },
  clearButtonText: { fontSize: 12, color: GameColors.danger, marginTop: 4 },
  pickPrompt: { fontSize: 14, opacity: 0.7, textAlign: 'center', marginBottom: 20 },
  doneButton: { backgroundColor: GameColors.neutral, paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  doneButtonText: { color: GameColors.white, fontWeight: '700', fontSize: 15 },
});
