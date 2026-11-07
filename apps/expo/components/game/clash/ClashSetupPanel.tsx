import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ShowFancyAlertFn } from '@/components/game/GameHeader';
import { Fonts, GameColors } from '@/constants/theme';
import type { Game, Participant } from '@/contexts/GameContext';
import { useGame } from '@/contexts/GameContext';
import { useSound } from '@/contexts/SoundContext';
import { t } from '@/i18n';
import * as Haptics from 'expo-haptics';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, TouchableOpacity, View } from 'react-native';

interface Props {
  game: Game;
  locale: string;
  isDark: boolean;
  getDisplayName: (name: string) => string;
  isAdmin: boolean;
  showFancyAlert?: ShowFancyAlertFn;
}

export const ClashSetupPanel: React.FC<Props> = ({
  game, locale, getDisplayName, isAdmin, showFancyAlert,
}) => {
  const { saveClashGroups, startClashGame } = useGame();
  const { playSound } = useSound();

  const [groupAIds, setGroupAIds] = useState<string[]>(game.clashData?.groupA?.memberIds ?? []);
  const [groupBIds, setGroupBIds] = useState<string[]>(game.clashData?.groupB?.memberIds ?? []);
  const isMounted = useRef(true);
  useEffect(() => () => { isMounted.current = false; }, []);

  const [isSaving, setIsSaving] = useState(false);
  const [isStarting, setIsStarting] = useState(false);

  const eligibleParticipants = (game.adminWritesComments ?? false)
    ? game.participants
    : game.participants.filter(p => p.userId !== game.adminId);
  const allIds = eligibleParticipants.map(p => p.userId);
  const unassignedIds = allIds.filter(id => !groupAIds.includes(id) && !groupBIds.includes(id));

  const persistGroups = useCallback(async (newA: string[], newB: string[]) => {
    if (!isAdmin) return;
    if (newA.length > 0 && newB.length > 0 && newA.length === newB.length) {
      try {
        setIsSaving(true);
        await saveClashGroups({ memberIds: newA }, { memberIds: newB });
      } catch (_) { /* non-blocking */ } finally {
        setIsSaving(false);
      }
    }
  }, [isAdmin, saveClashGroups]);

  const assignToGroup = useCallback(async (playerId: string, group: 'a' | 'b' | null) => {
    const newA = group === 'a'
      ? [...groupAIds.filter(id => id !== playerId), playerId]
      : groupAIds.filter(id => id !== playerId);
    const newB = group === 'b'
      ? [...groupBIds.filter(id => id !== playerId), playerId]
      : groupBIds.filter(id => id !== playerId);
    setGroupAIds(newA);
    setGroupBIds(newB);
    await persistGroups(newA, newB);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }, [groupAIds, groupBIds, persistGroups]);

  const canStart = isAdmin
    && groupAIds.length > 0
    && groupAIds.length === groupBIds.length;

  const handleStart = async () => {
    try {
      setIsStarting(true);
      await playSound('gameStart');
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await startClashGame();
      playSound('success').catch(() => {});
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (err: unknown) {
      if (!isMounted.current) return;
      playSound('error').catch(() => {});
      showFancyAlert?.(t('common.error', { locale }), (err instanceof Error && err.message) || t('common.error', { locale }));
    } finally {
      if (isMounted.current) setIsStarting(false);
    }
  };

  const renderPoolCard = (participant: Participant) => (
    <View key={participant.userId} style={styles.card}>
      <ThemedText style={styles.cardName} numberOfLines={1}>
        {getDisplayName(participant.userName)}
      </ThemedText>
      {isAdmin && (
        <View style={styles.cardActions}>
          <TouchableOpacity
            style={[styles.assignBtn, styles.assignBtnA]}
            onPress={() => assignToGroup(participant.userId, 'a')}
            activeOpacity={0.7}
          >
            <ThemedText style={styles.assignBtnText}>A</ThemedText>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.assignBtn, styles.assignBtnB]}
            onPress={() => assignToGroup(participant.userId, 'b')}
            activeOpacity={0.7}
          >
            <ThemedText style={styles.assignBtnText}>B</ThemedText>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  const renderGroupCard = (participant: Participant) => {
    const pid = participant.userId;
    return (
      <View key={pid} style={styles.card}>
        <ThemedText style={styles.cardName} numberOfLines={1}>
          {getDisplayName(participant.userName)}
        </ThemedText>
        {isAdmin && (
          <TouchableOpacity
            style={styles.removeBtn}
            onPress={() => assignToGroup(pid, null)}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }}
          >
            <ThemedText style={styles.removeBtnText}>✕</ThemedText>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {unassignedIds.length > 0 && (
        <View style={styles.pool}>
          <ThemedText style={styles.sectionLabel}>{t('game.ui.clash.unassigned', { locale })}</ThemedText>
          {unassignedIds.map(id => {
            const p = eligibleParticipants.find(pt => pt.userId === id)!;
            return renderPoolCard(p);
          })}
        </View>
      )}

      <View style={styles.columnsRow}>
        <View style={[styles.column, styles.columnA]}>
          <ThemedText style={styles.columnLabel}>{t('game.ui.clash.groupA', { locale })}</ThemedText>
          {groupAIds.map(id => {
            const p = eligibleParticipants.find(pt => pt.userId === id)!;
            return renderGroupCard(p);
          })}
          {groupAIds.length === 0 && (
            <ThemedText style={styles.emptyHint}>{t('game.ui.clash.emptyGroup', { locale })}</ThemedText>
          )}
        </View>

        <View style={[styles.column, styles.columnB]}>
          <ThemedText style={styles.columnLabel}>{t('game.ui.clash.groupB', { locale })}</ThemedText>
          {groupBIds.map(id => {
            const p = eligibleParticipants.find(pt => pt.userId === id)!;
            return renderGroupCard(p);
          })}
          {groupBIds.length === 0 && (
            <ThemedText style={styles.emptyHint}>{t('game.ui.clash.emptyGroup', { locale })}</ThemedText>
          )}
        </View>
      </View>

      {groupAIds.length !== groupBIds.length && groupAIds.length > 0 && groupBIds.length > 0 && (
        <ThemedText style={styles.warning}>{t('game.ui.clash.equalSizeWarning', { locale })}</ThemedText>
      )}

      {isAdmin && (
        <View style={styles.startWrapper}>
          <TouchableOpacity
            style={[styles.startButton, !canStart && styles.startButtonDisabled]}
            onPress={handleStart}
            disabled={!canStart || isStarting}
            activeOpacity={0.8}
            accessibilityRole="button"
          >
            <IconSymbol name="arrow.right.circle.fill" size={16} color={GameColors.white} />
            <ThemedText style={styles.startButtonText}>{t('game.ui.clash.startGame', { locale })}</ThemedText>
          </TouchableOpacity>
          {isSaving && <ThemedText style={styles.savingHint}>saving…</ThemedText>}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {},
  pool: { marginBottom: 16 },
  sectionLabel: { fontSize: 12, opacity: 0.6, fontFamily: Fonts.sans, marginBottom: 6 },
  columnsRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  column: { flex: 1, borderRadius: 12, padding: 10, minHeight: 60, borderWidth: 1 },
  columnA: { backgroundColor: 'rgba(0,122,255,0.06)', borderColor: 'rgba(0,122,255,0.2)' },
  columnB: { backgroundColor: 'rgba(175,82,222,0.06)', borderColor: 'rgba(175,82,222,0.2)' },
  columnLabel: { fontSize: 13, fontWeight: '700', fontFamily: Fonts.sans, marginBottom: 8, textAlign: 'center' },
  emptyHint: { textAlign: 'center', opacity: 0.35, fontSize: 11, fontFamily: Fonts.sans, marginTop: 4 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 10, borderRadius: 8, backgroundColor: GameColors.cardBg, borderWidth: 1, borderColor: GameColors.cardBorder, marginBottom: 6 },
  cardName: { flex: 1, fontSize: 14, fontWeight: '600', fontFamily: Fonts.sans },
  cardActions: { flexDirection: 'row', gap: 4 },
  assignBtn: { borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5, alignItems: 'center', justifyContent: 'center' },
  assignBtnA: { backgroundColor: 'rgba(0,122,255,0.15)' },
  assignBtnB: { backgroundColor: 'rgba(175,82,222,0.15)' },
  assignBtnText: { fontSize: 12, fontWeight: '700', fontFamily: Fonts.sans },
  removeBtn: { padding: 2 },
  removeBtnText: { fontSize: 12, opacity: 0.5, fontFamily: Fonts.sans },
  warning: { color: GameColors.danger, fontSize: 12, textAlign: 'center', marginBottom: 8, fontFamily: Fonts.sans },
  startWrapper: { alignItems: 'center', marginTop: 8, gap: 4 },
  startButton: { flexDirection: 'row', borderRadius: 999, paddingVertical: 14, paddingHorizontal: 24, backgroundColor: GameColors.green, alignItems: 'center', gap: 8, ...Platform.select({ ios: { shadowColor: GameColors.shadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 }, android: { elevation: 4 } }) },
  startButtonDisabled: { opacity: 0.4 },
  startButtonText: { color: GameColors.white, fontWeight: '600', fontSize: 15, fontFamily: Fonts.sans },
  savingHint: { fontSize: 11, opacity: 0.5, fontFamily: Fonts.sans },
});
