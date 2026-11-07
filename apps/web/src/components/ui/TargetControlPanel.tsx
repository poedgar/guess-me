import React, { useState } from 'react';
import { useGame } from '../../contexts/GameContext';
import { useSound } from '../../contexts/SoundContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAlert } from '../../hooks/useAlert';

export function TargetControlPanel() {
  const { currentGame, setNextRoundTarget, skipNextRoundTarget, resetTargetControls } = useGame();
  const { playSound } = useSound();
  const { t } = useLanguage();
  const { showAlert, AlertModal } = useAlert();

  const [settingTarget, setSettingTarget] = useState<string | null>(null);
  const [skippingTarget, setSkippingTarget] = useState<string | null>(null);
  const [isResetting, setIsResetting] = useState(false);

  if (!currentGame) return null;

  const preferredTarget = currentGame.adminNextTargetPreference;
  const skippedTargets = currentGame.adminSkippedTargets || [];

  const handleReset = async () => {
    try {
      setIsResetting(true);
      await resetTargetControls();
      await playSound('success');
      showAlert(t('common.success'), t('game.alerts.resetTargetSuccess'));
    } catch (error) {
      showAlert(t('common.error'), (error instanceof Error && error.message) || t('game.alerts.resetTargetFailed'));
    } finally {
      setIsResetting(false);
    }
  };

  const handleSetTarget = async (participantId: string) => {
    try {
      setSettingTarget(participantId);
      await setNextRoundTarget(participantId);
      await playSound('success');
      showAlert(t('common.success'), t('game.alerts.setTargetSuccess'));
    } catch (error) {
      showAlert(t('common.error'), (error instanceof Error && error.message) || t('game.alerts.setTargetFailed'));
    } finally {
      setSettingTarget(null);
    }
  };

  const handleSkipTarget = async (participantId: string) => {
    try {
      setSkippingTarget(participantId);
      await skipNextRoundTarget(participantId);
      await playSound('success');
      showAlert(t('common.success'), t('game.alerts.skipTargetSuccess'));
    } catch (error) {
      showAlert(t('common.error'), (error instanceof Error && error.message) || t('game.alerts.skipTargetFailed'));
    } finally {
      setSkippingTarget(null);
    }
  };

  return (
    <>
      {AlertModal}
      <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-4 mt-4">
        <p className="text-center font-semibold text-gray-900 dark:text-white mb-3">
          {t('game.ui.targetControl.title')}
        </p>

        {/* Status indicators */}
        {(preferredTarget || skippedTargets.length > 0) && (
          <div className="space-y-1 mb-3">
            {preferredTarget && (
              <p className="text-sm text-game-green">
                ⭐ {t('game.ui.targetControl.nextTarget', {
                  name: currentGame.participants.find(p => p.userId === preferredTarget)?.userName,
                })}
              </p>
            )}
            {skippedTargets.length > 0 && (
              <p className="text-sm text-game-danger">
                ⏳ {t('game.ui.targetControl.skippedCount', { count: skippedTargets.length })}
              </p>
            )}
          </div>
        )}

        {/* Reset button */}
        <button
          type="button"
          onClick={handleReset}
          disabled={isResetting}
          className="w-full bg-game-neutral text-white px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity mb-3"
        >
          {isResetting ? t('common.loading') : t('game.ui.targetControl.reset')}
        </button>

        {/* Participants list */}
        <div className="space-y-2 max-h-60 overflow-y-auto">
          {currentGame.participants.map(participant => {
            const isPreferred = preferredTarget === participant.userId;
            const isSkipped = skippedTargets.includes(participant.userId);
            const isCurrentTarget = currentGame.currentRound?.targetUserId === participant.userId;

            return (
              <div
                key={participant.userId}
                className={`flex items-center justify-between px-3 py-2 rounded-lg border ${
                  isPreferred
                    ? 'bg-green-50 dark:bg-green-900/20 border-game-green'
                    : isSkipped
                      ? 'bg-red-50 dark:bg-red-900/20 border-game-danger'
                      : isCurrentTarget
                        ? 'bg-blue-50 dark:bg-blue-900/20 border-game-blue'
                        : 'bg-white dark:bg-gray-600 border-gray-200 dark:border-gray-500'
                }`}
              >
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">
                    {participant.userName}
                  </p>
                  {isCurrentTarget && (
                    <p className="text-xs text-game-blue">{t('game.ui.targetControl.currentTarget')}</p>
                  )}
                  {isPreferred && (
                    <p className="text-xs text-game-green">{t('game.ui.targetControl.nextTargetLabel')}</p>
                  )}
                  {isSkipped && (
                    <p className="text-xs text-game-danger">{t('game.ui.targetControl.skippedLabel')}</p>
                  )}
                </div>

                <div className="flex gap-2">
                  {/* Set as next target */}
                  <button
                    type="button"
                    onClick={() => handleSetTarget(participant.userId)}
                    disabled={isPreferred || isCurrentTarget || settingTarget === participant.userId}
                    title={t('game.ui.targetControl.nextTargetLabel')}
                    className="w-8 h-8 rounded-full bg-game-green text-white flex items-center justify-center hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity text-sm"
                  >
                    {settingTarget === participant.userId ? '…' : '⭐'}
                  </button>

                  {/* Skip */}
                  <button
                    type="button"
                    onClick={() => handleSkipTarget(participant.userId)}
                    disabled={isSkipped || isCurrentTarget || skippingTarget === participant.userId}
                    title={t('game.ui.targetControl.skippedLabel')}
                    className="w-8 h-8 rounded-full bg-game-danger text-white flex items-center justify-center hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity text-sm"
                  >
                    {skippingTarget === participant.userId ? '…' : '⏭'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
