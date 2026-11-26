import { ThemedText } from '@/components/themed-text';
import { GameColors } from '@/constants/theme';
import { t } from '@/i18n';
import React, { useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { TOPICS } from './topicsData';
import { TopicHintsModal } from './TopicHintsModal';

interface Props {
  activeTopicIndex: number | null | undefined;
  locale: string;
}

export function ActiveTopicBanner({ activeTopicIndex, locale }: Props) {
  const [showHints, setShowHints] = useState(false);

  if (activeTopicIndex == null) return null;
  const topic = TOPICS[activeTopicIndex];
  if (!topic) return null;

  return (
    <View style={styles.banner}>
      <View style={styles.headerRow}>
        <ThemedText style={styles.title} lightColor={GameColors.shadow} darkColor={GameColors.shadow}>
          {t(topic.titleKey, { locale })}
        </ThemedText>
        {topic.hintKeys && (
          <TouchableOpacity
            onPress={() => setShowHints(true)}
            accessibilityLabel={t('game.ui.topicsHints.hintsButtonLabel', { locale })}
            style={styles.hintsTrigger}
          >
            <ThemedText style={styles.hintsTriggerText}>▶</ThemedText>
          </TouchableOpacity>
        )}
      </View>
      {topic.questionKey && (
        <ThemedText style={styles.questionText} lightColor={GameColors.shadow} darkColor={GameColors.shadow}>
          {t(topic.questionKey, { locale })}
        </ThemedText>
      )}

      <TopicHintsModal
        visible={showHints && !!topic.hintKeys}
        hintKeys={topic.hintKeys ?? []}
        onClose={() => setShowHints(false)}
        locale={locale}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: GameColors.cardBg,
    borderWidth: 1,
    borderColor: GameColors.admin,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  title: { fontSize: 15, fontWeight: '700', flex: 1 },
  hintsTrigger: { paddingHorizontal: 8, paddingVertical: 4 },
  hintsTriggerText: { fontSize: 16, color: GameColors.admin },
  questionText: { fontSize: 15, lineHeight: 21, marginTop: 8 },
});
