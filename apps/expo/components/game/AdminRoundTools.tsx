import { ThemedText } from '@/components/themed-text';
import { ShowFancyAlertFn } from '@/components/game/GameHeader';
import { GameColors } from '@/constants/theme';
import { t } from '@/i18n';
import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, TouchableOpacity, View } from 'react-native';

interface Props {
  isAdmin: boolean;
  locale: string;
  showFancyAlert?: ShowFancyAlertFn;
  onRestart: () => Promise<void>;
  onSkip: () => Promise<void>;
}

export const AdminRoundTools: React.FC<Props> = ({
  isAdmin,
  locale,
  showFancyAlert,
  onRestart,
  onSkip,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [isRestarting, setIsRestarting] = useState(false);
  const [isSkipping, setIsSkipping] = useState(false);

  if (!isAdmin) return null;

  const confirmRestart = () => {
    showFancyAlert?.(
      t('game.alerts.restartRoundTitle', { locale }),
      t('game.alerts.restartRoundMessage', { locale }),
      [
        { text: t('common.cancel', { locale }), style: 'cancel' },
        {
          text: t('game.ui.restartRound', { locale }),
          style: 'destructive',
          onPress: async () => {
            setIsRestarting(true);
            try {
              await onRestart();
            } finally {
              setIsRestarting(false);
            }
          },
        },
      ],
    );
  };

  const confirmSkip = () => {
    showFancyAlert?.(
      t('game.alerts.skipRoundTitle', { locale }),
      t('game.alerts.skipRoundMessage', { locale }),
      [
        { text: t('common.cancel', { locale }), style: 'cancel' },
        {
          text: t('game.ui.skipRound', { locale }),
          onPress: async () => {
            setIsSkipping(true);
            try {
              await onSkip();
            } finally {
              setIsSkipping(false);
            }
          },
        },
      ],
    );
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        onPress={() => setExpanded((e) => !e)}
        accessibilityRole="button"
        accessibilityLabel={t('game.ui.adminTools', { locale })}
      >
        <ThemedText style={styles.toggle}>
          {`${t('game.ui.adminTools', { locale })} ${expanded ? '▴' : '▾'}`}
        </ThemedText>
      </TouchableOpacity>
      {expanded && (
        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[styles.button, styles.restartButton, isRestarting && styles.buttonDisabled]}
            onPress={confirmRestart}
            disabled={isRestarting || isSkipping}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={t('game.ui.restartRound', { locale })}
          >
            {isRestarting ? (
              <ActivityIndicator size="small" color={GameColors.purple} />
            ) : (
              <ThemedText style={styles.restartButtonText}>
                {`↻ ${t('game.ui.restartRound', { locale })}`}
              </ThemedText>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.button, styles.skipButton, isSkipping && styles.buttonDisabled]}
            onPress={confirmSkip}
            disabled={isRestarting || isSkipping}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={t('game.ui.skipRound', { locale })}
          >
            {isSkipping ? (
              <ActivityIndicator size="small" color={GameColors.neutral} />
            ) : (
              <ThemedText style={styles.skipButtonText}>
                {`⏭ ${t('game.ui.skipRound', { locale })}`}
              </ThemedText>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 22,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(128,128,128,0.2)',
    paddingTop: 10,
    width: '100%',
  },
  toggle: { fontSize: 12, opacity: 0.6 },
  buttonRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  button: {
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: { opacity: 0.5 },
  restartButton: { borderColor: GameColors.purple },
  restartButtonText: { color: GameColors.purple, fontSize: 13, fontWeight: '600' },
  skipButton: { borderColor: GameColors.neutral },
  skipButtonText: { color: GameColors.neutral, fontSize: 13, fontWeight: '600' },
});
