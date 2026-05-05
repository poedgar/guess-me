import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ShowFancyAlertFn } from '@/components/game/GameHeader';
import { Fonts, GameColors } from '@/constants/theme';
import type { ClashGroup, Game, Participant } from '@/contexts/GameContext';
import { useGame } from '@/contexts/GameContext';
import { useSound } from '@/contexts/SoundContext';
import { t } from '@/i18n';
import * as Haptics from 'expo-haptics';
import React, { useCallback, useRef, useState } from 'react';
import {
  Animated, LayoutRectangle, PanResponder, Platform,
  StyleSheet, TouchableOpacity, View,
} from 'react-native';

interface Props {
  game: Game;
  locale: string;
  isDark: boolean;
  getDisplayName: (name: string) => string;
  isAdmin: boolean;
  showFancyAlert?: ShowFancyAlertFn;
}

function isInBounds(x: number, y: number, bounds: LayoutRectangle): boolean {
  return x >= bounds.x && x <= bounds.x + bounds.width && y >= bounds.y && y <= bounds.y + bounds.height;
}

export const ClashSetupPanel: React.FC<Props> = ({
  game, locale, getDisplayName, isAdmin, showFancyAlert,
}) => {
  const { saveClashGroups, startClashGame } = useGame();
  const { playSound } = useSound();

  const [groupAIds, setGroupAIds] = useState<string[]>(game.clashData?.groupA?.memberIds ?? []);
  const [groupBIds, setGroupBIds] = useState<string[]>(game.clashData?.groupB?.memberIds ?? []);
  const [leaderAId, setLeaderAId] = useState<string | null>(game.clashData?.groupA?.leaderId ?? null);
  const [leaderBId, setLeaderBId] = useState<string | null>(game.clashData?.groupB?.leaderId ?? null);
  const [isSaving, setIsSaving] = useState(false);
  const [isStarting, setIsStarting] = useState(false);

  const allIds = game.participants.map(p => p.userId);
  const unassignedIds = allIds.filter(id => !groupAIds.includes(id) && !groupBIds.includes(id));

  const [dragId, setDragId] = useState<string | null>(null);
  const dragAnim = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const dragStartPage = useRef({ x: 0, y: 0 });

  const colABounds = useRef<LayoutRectangle | null>(null);
  const colBBounds = useRef<LayoutRectangle | null>(null);
  const colARef = useRef<View>(null);
  const colBRef = useRef<View>(null);

  const measureColumns = useCallback(() => {
    colARef.current?.measure((_x, _y, width, height, pageX, pageY) => {
      colABounds.current = { x: pageX, y: pageY, width, height };
    });
    colBRef.current?.measure((_x, _y, width, height, pageX, pageY) => {
      colBBounds.current = { x: pageX, y: pageY, width, height };
    });
  }, []);

  const persistGroups = useCallback(async (
    newA: string[], newB: string[], newLeaderA: string | null, newLeaderB: string | null
  ) => {
    if (!isAdmin) return;
    if (newA.length > 0 && newB.length > 0 && newA.length === newB.length && newLeaderA && newLeaderB) {
      try {
        setIsSaving(true);
        await saveClashGroups(
          { leaderId: newLeaderA, memberIds: newA },
          { leaderId: newLeaderB, memberIds: newB },
        );
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
    const newLeaderA = leaderAId === playerId ? null : leaderAId;
    const newLeaderB = leaderBId === playerId ? null : leaderBId;
    setGroupAIds(newA);
    setGroupBIds(newB);
    setLeaderAId(newLeaderA);
    setLeaderBId(newLeaderB);
    await persistGroups(newA, newB, newLeaderA, newLeaderB);
  }, [groupAIds, groupBIds, leaderAId, leaderBId, persistGroups]);

  // dragIdRef lets the PanResponder closure see the latest dragId
  const dragIdRef = useRef<string | null>(null);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => dragIdRef.current !== null,
      onMoveShouldSetPanResponder: () => dragIdRef.current !== null,
      onPanResponderMove: (evt) => {
        dragAnim.setValue({
          x: evt.nativeEvent.pageX - dragStartPage.current.x,
          y: evt.nativeEvent.pageY - dragStartPage.current.y,
        });
      },
      onPanResponderRelease: (evt) => {
        const { pageX, pageY } = evt.nativeEvent;
        const id = dragIdRef.current;
        dragIdRef.current = null;
        setDragId(null);
        dragAnim.setValue({ x: 0, y: 0 });
        if (!id) return;
        if (colABounds.current && isInBounds(pageX, pageY, colABounds.current)) {
          assignToGroup(id, 'a');
        } else if (colBBounds.current && isInBounds(pageX, pageY, colBBounds.current)) {
          assignToGroup(id, 'b');
        }
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      },
      onPanResponderTerminate: () => {
        dragIdRef.current = null;
        setDragId(null);
        dragAnim.setValue({ x: 0, y: 0 });
      },
    })
  ).current;

  const startDrag = (playerId: string, pageX: number, pageY: number) => {
    dragStartPage.current = { x: pageX, y: pageY };
    dragAnim.setValue({ x: 0, y: 0 });
    dragIdRef.current = playerId;
    setDragId(playerId);
    measureColumns();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const toggleLeader = async (playerId: string, group: 'a' | 'b') => {
    const newLeaderA = group === 'a' ? (leaderAId === playerId ? null : playerId) : leaderAId;
    const newLeaderB = group === 'b' ? (leaderBId === playerId ? null : playerId) : leaderBId;
    setLeaderAId(newLeaderA);
    setLeaderBId(newLeaderB);
    await persistGroups(groupAIds, groupBIds, newLeaderA, newLeaderB);
  };

  const canStart = isAdmin
    && groupAIds.length > 0
    && groupAIds.length === groupBIds.length
    && leaderAId !== null
    && leaderBId !== null;

  const handleStart = async () => {
    try {
      setIsStarting(true);
      await playSound('gameStart');
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await startClashGame();
      await playSound('success');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: unknown) {
      await playSound('error');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showFancyAlert?.(t('common.error', { locale }), (err instanceof Error && err.message) || t('common.error', { locale }));
    } finally {
      setIsStarting(false);
    }
  };

  const renderPlayerCard = (participant: Participant, group: 'a' | 'b' | 'pool') => {
    const playerId = participant.userId;
    const isLeader = (group === 'a' && leaderAId === playerId) || (group === 'b' && leaderBId === playerId);
    const isDragging = dragId === playerId;

    return (
      <TouchableOpacity
        key={playerId}
        style={[styles.playerCard, isLeader && styles.playerCardLeader, isDragging && styles.playerCardDragging]}
        onLongPress={(e) => {
          if (!isAdmin) return;
          startDrag(playerId, e.nativeEvent.pageX, e.nativeEvent.pageY);
        }}
        onPress={() => {
          if (!isAdmin) return;
          if (group !== 'pool') toggleLeader(playerId, group);
        }}
        delayLongPress={300}
        activeOpacity={0.8}
      >
        <ThemedText style={styles.playerName}>{getDisplayName(participant.userName)}</ThemedText>
        {isLeader && <IconSymbol name="crown.fill" size={14} color={GameColors.gold} />}
        {group !== 'pool' && !isLeader && isAdmin && (
          <ThemedText style={styles.tapLeaderHint}>{t('game.ui.clash.assignLeader', { locale })}</ThemedText>
        )}
      </TouchableOpacity>
    );
  };

  const draggedParticipant = dragId ? game.participants.find(p => p.userId === dragId) : null;

  return (
    <View style={styles.container} {...(dragId ? panResponder.panHandlers : {})}>
      {unassignedIds.length > 0 && (
        <View style={styles.pool}>
          <ThemedText style={styles.poolLabel}>{t('game.ui.clash.unassigned', { locale })}</ThemedText>
          <View style={styles.poolRow}>
            {unassignedIds.map(id => {
              const p = game.participants.find(pt => pt.userId === id)!;
              return renderPlayerCard(p, 'pool');
            })}
          </View>
        </View>
      )}

      <View style={styles.columnsRow}>
        <View ref={colARef} style={[styles.column, styles.columnA]} onLayout={measureColumns}>
          <ThemedText style={styles.columnLabel}>{t('game.ui.clash.groupA', { locale })}</ThemedText>
          {groupAIds.map(id => {
            const p = game.participants.find(pt => pt.userId === id)!;
            return renderPlayerCard(p, 'a');
          })}
          {groupAIds.length === 0 && (
            <ThemedText style={styles.emptyHint}>↑ drag here</ThemedText>
          )}
        </View>

        <View ref={colBRef} style={[styles.column, styles.columnB]} onLayout={measureColumns}>
          <ThemedText style={styles.columnLabel}>{t('game.ui.clash.groupB', { locale })}</ThemedText>
          {groupBIds.map(id => {
            const p = game.participants.find(pt => pt.userId === id)!;
            return renderPlayerCard(p, 'b');
          })}
          {groupBIds.length === 0 && (
            <ThemedText style={styles.emptyHint}>↑ drag here</ThemedText>
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

      {dragId && draggedParticipant && (
        <Animated.View
          style={[styles.ghostCard, { transform: dragAnim.getTranslateTransform() }]}
          pointerEvents="none"
        >
          <ThemedText style={styles.ghostName}>{getDisplayName(draggedParticipant.userName)}</ThemedText>
        </Animated.View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { position: 'relative' },
  pool: { marginBottom: 16 },
  poolLabel: { fontSize: 12, opacity: 0.6, fontFamily: Fonts.sans, marginBottom: 6 },
  poolRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  columnsRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  column: { flex: 1, borderRadius: 12, padding: 10, minHeight: 80, borderWidth: 1 },
  columnA: { backgroundColor: 'rgba(0,122,255,0.06)', borderColor: 'rgba(0,122,255,0.2)' },
  columnB: { backgroundColor: 'rgba(175,82,222,0.06)', borderColor: 'rgba(175,82,222,0.2)' },
  columnLabel: { fontSize: 13, fontWeight: '700', fontFamily: Fonts.sans, marginBottom: 8, textAlign: 'center' },
  emptyHint: { textAlign: 'center', opacity: 0.4, fontSize: 12, fontFamily: Fonts.sans, marginTop: 8 },
  playerCard: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 10, borderRadius: 8, backgroundColor: GameColors.cardBg, borderWidth: 1, borderColor: GameColors.cardBorder, marginBottom: 6 },
  playerCardLeader: { borderColor: GameColors.gold, borderWidth: 2 },
  playerCardDragging: { opacity: 0.3 },
  playerName: { fontSize: 14, fontWeight: '600', fontFamily: Fonts.sans, flex: 1 },
  tapLeaderHint: { fontSize: 10, opacity: 0.5, fontFamily: Fonts.sans },
  warning: { color: GameColors.danger, fontSize: 12, textAlign: 'center', marginBottom: 8, fontFamily: Fonts.sans },
  startWrapper: { alignItems: 'center', marginTop: 8, gap: 4 },
  startButton: { flexDirection: 'row', borderRadius: 999, paddingVertical: 14, paddingHorizontal: 24, backgroundColor: GameColors.green, alignItems: 'center', gap: 8, ...Platform.select({ ios: { shadowColor: GameColors.shadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 }, android: { elevation: 4 } }) },
  startButtonDisabled: { opacity: 0.4 },
  startButtonText: { color: GameColors.white, fontWeight: '600', fontSize: 15, fontFamily: Fonts.sans },
  savingHint: { fontSize: 11, opacity: 0.5, fontFamily: Fonts.sans },
  ghostCard: { position: 'absolute', top: 0, left: 0, padding: 10, borderRadius: 8, backgroundColor: GameColors.blue, zIndex: 999, minWidth: 80 },
  ghostName: { color: GameColors.white, fontWeight: '700', fontFamily: Fonts.sans },
});
