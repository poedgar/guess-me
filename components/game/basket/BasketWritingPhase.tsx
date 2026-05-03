import { ThemedText } from '@/components/themed-text';
import type { Game } from '@/contexts/GameContext';
import { useGame } from '@/contexts/GameContext';
import { GameColors } from '@/constants/theme';
import { t } from '@/i18n';
import React, { useState } from 'react';
import { StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';

interface Props {
  game: Game;
  user: { uid: string } | null;
  isAdmin: boolean;
  locale: string;
  isDark: boolean;
  getDisplayName: (name: string) => string;
}

export const BasketWritingPhase: React.FC<Props> = ({
  game, user, isAdmin, locale, isDark, getDisplayName,
}) => {
  const { submitBasketComment, revealBasketComments } = useGame();
  const [commentText, setCommentText] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const { schedule, currentRoundIndex, currentRoundComments } = game.basketData!;
  const totalRounds = schedule.length;
  const myAssignment = schedule[currentRoundIndex].assignments.find(
    a => a.writerId === user?.uid
  );
  const subjectParticipant = game.participants.find(p => p.userId === myAssignment?.subjectId);
  const subjectName = subjectParticipant ? getDisplayName(subjectParticipant.userName) : '?';

  const alreadySubmitted = submitted ||
    currentRoundComments.some(c => c.writerId === user?.uid);

  const handleSubmit = async () => {
    if (!commentText.trim()) return;
    try {
      await submitBasketComment(commentText.trim());
      setSubmitted(true);
      setCommentText('');
    } catch (e) {
      console.error('submitBasketComment error', e);
    }
  };

  return (
    <View style={styles.container}>
      <ThemedText style={styles.roundLabel}>
        {t('game.ui.basket.round', { locale, current: currentRoundIndex + 1, total: totalRounds })}
      </ThemedText>

      {alreadySubmitted ? (
        <ThemedText style={styles.waiting}>
          {t('game.ui.basket.waitingForOthers', {
            locale,
            count: currentRoundComments.length,
            total: game.participants.length,
          })}
        </ThemedText>
      ) : (
        <View style={styles.writeSection}>
          <ThemedText style={styles.subjectLabel}>
            {t('game.ui.basket.yourSubject', { locale })}
          </ThemedText>
          <ThemedText style={styles.subjectName}>{subjectName}</ThemedText>
          <TextInput
            style={[styles.input, isDark && styles.inputDark]}
            value={commentText}
            onChangeText={setCommentText}
            placeholder={t('game.ui.basket.writeComment', { locale })}
            multiline
            numberOfLines={3}
          />
          <TouchableOpacity
            style={[styles.submitButton, !commentText.trim() && styles.submitDisabled]}
            onPress={handleSubmit}
            disabled={!commentText.trim()}
            activeOpacity={0.8}
          >
            <ThemedText style={styles.submitText}>
              {t('game.ui.basket.submit', { locale })}
            </ThemedText>
          </TouchableOpacity>
        </View>
      )}

      {isAdmin && (
        <TouchableOpacity
          style={styles.revealButton}
          onPress={revealBasketComments}
          activeOpacity={0.8}
        >
          <ThemedText style={styles.revealText}>
            {t('game.ui.basket.revealComments', { locale })}
          </ThemedText>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { gap: 16, paddingVertical: 8 },
  roundLabel: { fontSize: 14, opacity: 0.6, textAlign: 'center' },
  waiting: { textAlign: 'center', marginVertical: 16, opacity: 0.7 },
  writeSection: { gap: 8 },
  subjectLabel: { fontSize: 13, opacity: 0.6 },
  subjectName: { fontSize: 20, fontWeight: '700' },
  input: {
    borderRadius: 10, padding: 12, fontSize: 15,
    backgroundColor: '#f2f2f2', minHeight: 80, textAlignVertical: 'top',
  },
  inputDark: { backgroundColor: '#1c1c1e', color: '#fff' },
  submitButton: {
    backgroundColor: GameColors.blue, borderRadius: 10,
    paddingVertical: 12, alignItems: 'center',
  },
  submitDisabled: { opacity: 0.4 },
  submitText: { color: GameColors.white, fontWeight: '600' },
  revealButton: {
    backgroundColor: GameColors.green, borderRadius: 10,
    paddingVertical: 12, alignItems: 'center', marginTop: 8,
  },
  revealText: { color: GameColors.white, fontWeight: '600' },
});
