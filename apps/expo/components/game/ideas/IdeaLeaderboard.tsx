import { ThemedText } from '@/components/themed-text';
import { Fonts, GameColors } from '@/constants/theme';
import type { Idea } from '@/contexts/GameContext';
import { t } from '@/i18n';
import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

interface Props {
  ideas: Idea[];
  locale: string;
  title: string;
  scrollHeight?: number;
}

export const IdeaLeaderboard: React.FC<Props> = ({
  ideas,
  locale,
  title,
  scrollHeight = 300,
}) => {
  const ranked = [...ideas].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

  return (
    <View style={styles.container}>
      <ThemedText type="subtitle" style={styles.title}>
        {title}
      </ThemedText>
      {ranked.length === 0 ? (
        <ThemedText style={styles.empty}>{t('game.ui.ideas.noIdeasYet', { locale })}</ThemedText>
      ) : (
        <ScrollView
          style={[styles.scroll, { maxHeight: scrollHeight }]}
          nestedScrollEnabled
        >
          <View style={styles.list} accessibilityRole="list">
            {ranked.map((idea, index) => (
              <View
                key={idea.id}
                style={[styles.item, index === 0 && styles.itemFirst]}
              >
                <View style={styles.rank}>
                  {index === 0 && (
                    <ThemedText style={styles.rankEmoji}>🥇</ThemedText>
                  )}
                  {index === 1 && (
                    <ThemedText style={styles.rankEmoji}>🥈</ThemedText>
                  )}
                  {index === 2 && (
                    <ThemedText style={styles.rankEmoji}>🥉</ThemedText>
                  )}
                  {index > 2 && (
                    <ThemedText style={styles.rankNumber}>
                      #{index + 1}
                    </ThemedText>
                  )}
                </View>
                <ThemedText style={styles.ideaText}>{idea.text}</ThemedText>
                <View
                  style={styles.points}
                  accessibilityLabel={`${idea.score ?? 0} ${t('game.ui.pointsTotal', { locale })}`}
                >
                  <ThemedText style={styles.pointsValue} accessibilityElementsHidden>
                    {idea.score ?? 0}
                  </ThemedText>
                  <ThemedText style={styles.pointsLabel} accessibilityElementsHidden>
                    {t('game.ui.pointsTotal', { locale })}
                  </ThemedText>
                </View>
              </View>
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { marginBottom: 24, marginTop: 8 },
  title: { marginBottom: 16, textAlign: 'center', fontFamily: Fonts.sans },
  empty: { textAlign: 'center', opacity: 0.5, fontFamily: Fonts.sans, paddingVertical: 8 },
  scroll: { marginTop: 8 },
  list: { borderRadius: 8, overflow: 'hidden' },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginBottom: 8,
    borderRadius: 8,
    backgroundColor: GameColors.cardBg,
  },
  itemFirst: {
    backgroundColor: GameColors.goldTint,
    borderWidth: 2,
    borderColor: GameColors.goldTintBorder,
  },
  rank: { width: 40, alignItems: 'center', justifyContent: 'center' },
  rankEmoji: { fontSize: 24 },
  rankNumber: { fontSize: 14, fontWeight: '600', opacity: 0.6, fontFamily: Fonts.sans },
  ideaText: { flex: 1, marginLeft: 12, fontSize: 15, lineHeight: 20, fontFamily: Fonts.sans },
  points: { alignItems: 'flex-end', marginLeft: 12 },
  pointsValue: { fontSize: 20, fontWeight: '700', color: GameColors.green, fontFamily: Fonts.sans },
  pointsLabel: { fontSize: 12, opacity: 0.6, marginTop: 2, fontFamily: Fonts.sans },
});
