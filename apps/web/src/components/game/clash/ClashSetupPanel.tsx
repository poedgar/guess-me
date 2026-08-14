import React, { useState, useCallback } from 'react';
import { Game, Participant } from '@mirror/shared';
import { useGame } from '../../../contexts/GameContext';
import { useAuth } from '../../../contexts/AuthContext';
import { useLanguage } from '../../../contexts/LanguageContext';
import { useAlert } from '../../../hooks/useAlert';
import { getDisplayName } from '../../../utils/displayName';

interface Props {
  game: Game;
}

export const ClashSetupPanel: React.FC<Props> = ({ game }) => {
  const { user } = useAuth();
  const { loading, saveClashGroups, startClashGame } = useGame();
  const { t } = useLanguage();
  const { showAlert, AlertModal } = useAlert();

  const [groupAIds, setGroupAIds] = useState<string[]>(game.clashData?.groupA?.memberIds ?? []);
  const [groupBIds, setGroupBIds] = useState<string[]>(game.clashData?.groupB?.memberIds ?? []);
  const [leaderAId, setLeaderAId] = useState<string | null>(game.clashData?.groupA?.leaderId ?? null);
  const [leaderBId, setLeaderBId] = useState<string | null>(game.clashData?.groupB?.leaderId ?? null);
  const [isSaving, setIsSaving] = useState(false);
  const [isStarting, setIsStarting] = useState(false);

  const isAdmin = user?.uid === game.adminId;

  const eligibleParticipants = (game.adminWritesComments ?? false)
    ? game.participants
    : game.participants.filter(p => p.userId !== game.adminId);

  const allIds = eligibleParticipants.map(p => p.userId);
  const unassignedIds = allIds.filter(id => !groupAIds.includes(id) && !groupBIds.includes(id));

  const canStart = isAdmin
    && groupAIds.length > 0
    && groupAIds.length === groupBIds.length
    && leaderAId !== null
    && leaderBId !== null;

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
      } catch { /* non-blocking */ } finally {
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
    // Auto-assign leader if group was empty
    const newLeaderA = group === 'a' && groupAIds.length === 0
      ? playerId
      : (leaderAId === playerId ? null : leaderAId);
    const newLeaderB = group === 'b' && groupBIds.length === 0
      ? playerId
      : (leaderBId === playerId ? null : leaderBId);
    setGroupAIds(newA);
    setGroupBIds(newB);
    setLeaderAId(newLeaderA);
    setLeaderBId(newLeaderB);
    await persistGroups(newA, newB, newLeaderA, newLeaderB);
  }, [groupAIds, groupBIds, leaderAId, leaderBId, persistGroups]);

  const toggleLeader = useCallback(async (playerId: string, group: 'a' | 'b') => {
    const newLeaderA = group === 'a' ? (leaderAId === playerId ? null : playerId) : leaderAId;
    const newLeaderB = group === 'b' ? (leaderBId === playerId ? null : playerId) : leaderBId;
    setLeaderAId(newLeaderA);
    setLeaderBId(newLeaderB);
    await persistGroups(groupAIds, groupBIds, newLeaderA, newLeaderB);
  }, [leaderAId, leaderBId, groupAIds, groupBIds, persistGroups]);

  const handleStart = async () => {
    try {
      setIsStarting(true);
      await startClashGame();
    } catch (err) {
      setIsStarting(false);
      showAlert(t('common.error'), (err instanceof Error && err.message) || t('common.error'));
    }
  };

  const renderPoolCard = (participant: Participant) => (
    <div key={participant.userId} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 mb-2">
      <span className="flex-1 text-sm font-semibold text-gray-900 dark:text-white truncate">{getDisplayName(participant.userName, game.showSurnames ?? false)}</span>
      {isAdmin && (
        <div className="flex gap-1">
          <button type="button" data-cy="clash-assign-button" data-cy-group="a" data-cy-user-id={participant.userId} onClick={() => assignToGroup(participant.userId, 'a')}
            className="px-2 py-1 rounded text-xs font-bold bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors">A</button>
          <button type="button" data-cy="clash-assign-button" data-cy-group="b" data-cy-user-id={participant.userId} onClick={() => assignToGroup(participant.userId, 'b')}
            className="px-2 py-1 rounded text-xs font-bold bg-purple-100 text-purple-700 hover:bg-purple-200 transition-colors">B</button>
        </div>
      )}
    </div>
  );

  const renderGroupCard = (participant: Participant, group: 'a' | 'b') => {
    const pid = participant.userId;
    const isLeader = (group === 'a' && leaderAId === pid) || (group === 'b' && leaderBId === pid);
    return (
      <div key={pid} className={`flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-700 border-2 mb-2 ${isLeader ? 'border-yellow-400' : 'border-transparent'}`}>
        {isAdmin ? (
          <button type="button" onClick={() => toggleLeader(pid, group)} className="text-base hover:scale-110 transition-transform" title="Set as leader">
            <span>{isLeader ? '👑' : <span className="opacity-20">👑</span>}</span>
          </button>
        ) : isLeader ? <span>👑</span> : null}
        <span className="flex-1 text-sm font-semibold text-gray-900 dark:text-white truncate">{getDisplayName(participant.userName, game.showSurnames ?? false)}</span>
        {isAdmin && (
          <button type="button" onClick={() => assignToGroup(pid, null)} className="text-gray-400 hover:text-red-500 text-xs px-1">✕</button>
        )}
      </div>
    );
  };

  return (
    <>
      {AlertModal}
      <div className="space-y-4">
        {unassignedIds.length > 0 && (
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">{t('game.ui.clash.unassigned')}</p>
            {unassignedIds.map(id => {
              const p = eligibleParticipants.find(pt => pt.userId === id)!;
              return renderPoolCard(p);
            })}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          {/* Group A */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-xl p-3">
            <p className="text-center text-xs font-bold text-blue-700 dark:text-blue-300 mb-2">{t('game.ui.clash.groupA')}</p>
            {groupAIds.map(id => {
              const p = eligibleParticipants.find(pt => pt.userId === id)!;
              return p ? renderGroupCard(p, 'a') : null;
            })}
            {groupAIds.length === 0 && (
              <p className="text-center text-xs text-gray-400 py-2">{t('game.ui.clash.emptyGroup')}</p>
            )}
          </div>

          {/* Group B */}
          <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-700 rounded-xl p-3">
            <p className="text-center text-xs font-bold text-purple-700 dark:text-purple-300 mb-2">{t('game.ui.clash.groupB')}</p>
            {groupBIds.map(id => {
              const p = eligibleParticipants.find(pt => pt.userId === id)!;
              return p ? renderGroupCard(p, 'b') : null;
            })}
            {groupBIds.length === 0 && (
              <p className="text-center text-xs text-gray-400 py-2">{t('game.ui.clash.emptyGroup')}</p>
            )}
          </div>
        </div>

        {groupAIds.length !== groupBIds.length && groupAIds.length > 0 && groupBIds.length > 0 && (
          <p className="text-center text-xs text-red-500">{t('game.ui.clash.equalSizeWarning')}</p>
        )}

        {isAdmin && (
          <div className="flex flex-col items-center gap-1 pt-2">
            <button
              type="button"
              data-cy="clash-start-game-button"
              onClick={handleStart}
              disabled={!canStart || isStarting || loading}
              className="bg-game-green text-white px-6 py-3 rounded-full font-semibold hover:opacity-90 disabled:opacity-40 transition-opacity"
            >
              {isStarting ? t('common.loading') : t('game.ui.clash.startGame')}
            </button>
            {isSaving && <p className="text-xs text-gray-400">saving…</p>}
          </div>
        )}
      </div>
    </>
  );
};
