import React, { useState } from 'react';
import { Game } from '@mirror/shared';
import { useGame } from '../../../contexts/GameContext';
import { useLanguage } from '../../../contexts/LanguageContext';
import { useSound } from '../../../contexts/SoundContext';
import { useAlert } from '../../../hooks/useAlert';

interface TargetControlPanelProps {
  game: Game;
}

export const TargetControlPanel: React.FC<TargetControlPanelProps> = ({ game }) => {
  const { setNextRoundTarget, skipNextRoundTarget, resetTargetControls } = useGame();
  const { playSound } = useSound();
  const { showAlert, AlertModal } = useAlert();
  const { t } = useLanguage();

  const [settingTarget, setSettingTarget] = useState<string | null>(null);
  const [skippingTarget, setSkippingTarget] = useState<string | null>(null);
  const [isResetting, setIsResetting] = useState(false);

  const preferredTarget = game.adminNextTargetPreference;
  const skippedTargets = game.adminSkippedTargets || [];

  const handleReset = async () => {
    try {
      setIsResetting(true);
      await playSound('click');
      await resetTargetControls();
      await playSound('success');
      showAlert(t('common.success'), t('game.alerts.resetTargetSuccess'));
    } catch (error: unknown) {
      await playSound('error');
      showAlert(t('common.error'), (error instanceof Error && error.message) || t('game.alerts.resetTargetFailed'));
    } finally {
      setIsResetting(false);
    }
  };

  const handleSetTarget = async (participantId: string) => {
    try {
      setSettingTarget(participantId);
      await playSound('click');
      await setNextRoundTarget(participantId);
      await playSound('success');
      showAlert(t('common.success'), t('game.alerts.setTargetSuccess'));
    } catch (error: unknown) {
      await playSound('error');
      showAlert(t('common.error'), (error instanceof Error && error.message) || t('game.alerts.setTargetFailed'));
    } finally {
      setSettingTarget(null);
    }
  };

  const handleSkipTarget = async (participantId: string) => {
    try {
      setSkippingTarget(participantId);
      await playSound('click');
      await skipNextRoundTarget(participantId);
      await playSound('success');
      showAlert(t('common.success'), t('game.alerts.skipTargetSuccess'));
    } catch (error: unknown) {
      await playSound('error');
      showAlert(t('common.error'), (error instanceof Error && error.message) || t('game.alerts.skipTargetFailed'));
    } finally {
      setSkippingTarget(null);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-4 my-4">
      {AlertModal}
      <h3 className="text-center font-semibold text-gray-900 dark:text-white mb-3">
        {t('game.ui.targetControl.title')}
      </h3>

      {(preferredTarget || skippedTargets.length > 0) && (
        <div className="flex flex-wrap gap-2 mb-3 justify-center">
          {preferredTarget && (
            <span className="bg-game-green/20 text-game-green text-xs font-bold px-3 py-1 rounded-full">
              {t('game.ui.targetControl.nextTarget', {
                name: game.participants.find((p) => p.userId === preferredTarget)?.userName,
              })}
            </span>
          )}
          {skippedTargets.length > 0 && (
            <span className="bg-red-500/20 text-red-500 text-xs font-bold px-3 py-1 rounded-full">
              {t('game.ui.targetControl.skippedCount', { count: skippedTargets.length })}
            </span>
          )}
        </div>
      )}

      <button
        type="button"
        data-testid="target-control-reset"
        onClick={handleReset}
        disabled={isResetting}
        className="w-full bg-gray-500 text-white px-4 py-2 rounded-lg font-semibold text-sm hover:opacity-90 disabled:opacity-50 transition-opacity mb-3"
      >
        {isResetting ? t('common.loading') : t('game.ui.targetControl.reset')}
      </button>

      <div className="space-y-2 max-h-72 overflow-y-auto">
        {game.participants
          .filter((p) => (game.adminWritesComments ?? false) || p.userId !== game.adminId)
          .map((participant) => {
          const isPreferred = preferredTarget === participant.userId;
          const isSkipped = skippedTargets.includes(participant.userId);
          const isCurrentTarget = game.currentRound?.targetUserId === participant.userId;

          return (
            <div
              key={participant.userId}
              data-cy="target-control-row"
              data-cy-user-id={participant.userId}
              className={`flex items-center justify-between gap-3 p-3 rounded-lg border ${
                isCurrentTarget
                  ? 'bg-game-blue/10 border-game-blue'
                  : isPreferred
                    ? 'bg-game-green/10 border-game-green'
                    : isSkipped
                      ? 'bg-red-500/10 border-red-500'
                      : 'bg-gray-50 dark:bg-gray-700 border-transparent'
              }`}
            >
              <div className="min-w-0">
                <p className="font-semibold text-gray-900 dark:text-white text-sm truncate">
                  {participant.userName}
                </p>
                {isCurrentTarget && (
                  <p className="text-xs text-game-blue">{t('game.ui.targetControl.currentTarget')}</p>
                )}
                {isPreferred && (
                  <p className="text-xs text-game-green">{t('game.ui.targetControl.nextTargetLabel')}</p>
                )}
                {isSkipped && (
                  <p className="text-xs text-red-500">{t('game.ui.targetControl.skippedLabel')}</p>
                )}
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  type="button"
                  data-cy="target-set"
                  onClick={() => handleSetTarget(participant.userId)}
                  disabled={isPreferred || isCurrentTarget || settingTarget === participant.userId}
                  title={t('game.ui.targetControl.nextTargetLabel')}
                  className="w-8 h-8 rounded-full bg-game-green text-white flex items-center justify-center text-sm disabled:opacity-30 hover:opacity-90 transition-opacity"
                >
                  ⭐
                </button>
                <button
                  type="button"
                  data-cy="target-skip"
                  onClick={() => handleSkipTarget(participant.userId)}
                  disabled={isSkipped || isCurrentTarget || skippingTarget === participant.userId}
                  title={t('game.ui.targetControl.skippedLabel')}
                  className="w-8 h-8 rounded-full bg-red-500 text-white flex items-center justify-center text-sm disabled:opacity-30 hover:opacity-90 transition-opacity"
                >
                  🚫
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
