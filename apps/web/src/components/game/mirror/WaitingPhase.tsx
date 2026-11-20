import { useLanguage } from '../../../contexts/LanguageContext';
import React, { useState } from 'react';
import { Game } from '@mirror/shared';
import { QRCodeSVG } from 'qrcode.react';
import { useGame } from '../../../contexts/GameContext';
import { useAuth } from '../../../contexts/AuthContext';
import { useAlert } from '../../../hooks/useAlert';
import { Leaderboard } from '../Leaderboard';
import { useScrollIntoViewOnChange } from '../../../hooks/useScrollIntoViewOnChange';
import { getDisplayName } from '../../../utils/displayName';
import { TargetControlPanel } from './TargetControlPanel';
import { PULSE_COLORS } from '../../../constants/pulseColors';


interface WaitingPhaseProps {
  game: Game;
}

export const WaitingPhase: React.FC<WaitingPhaseProps> = ({ game }) => {
  const { user } = useAuth();
  const {
    loading,
    startGame,
    startBasketGame,
    startIdeaGame,
    updateAdminWritesComments,
    updateShowSurnames,
    updateTargetSelectionMode,
    updateShowGuessResults,
    updateIdeaIncognitoMode,
    updateMyName,
    setGameType,
  } = useGame();
  const { showAlert, AlertModal } = useAlert();
  const { t } = useLanguage();
  const [isStarting, setIsStarting] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [isSavingName, setIsSavingName] = useState(false);

  const isAdmin = user?.uid === game.adminId;
  const isClashAdmin = isAdmin && game.gameType === 'clash';

  // Clash admins don't have actionable controls in this section — their
  // real controls (team assignment, leader selection, start button) live in
  // ClashSetupPanel, rendered separately below WaitingPhase. Auto-scrolling
  // them to the "waiting for admin to start" filler here would be actively
  // wrong, so the ref is only attached for everyone else.
  const scrollRef = useScrollIntoViewOnChange<HTMLDivElement>(
    `${isAdmin}:${game.gameType ?? 'mirror'}`,
    'center',
    PULSE_COLORS.orange,
  );

  const handleStartGame = async () => {
    try {
      setIsStarting(true);
      if (game.gameType === 'basket') {
        await startBasketGame();
      } else if (game.gameType === 'ideas') {
        await startIdeaGame();
      } else {
        await startGame();
      }
    } catch (error) {
      setIsStarting(false);
      showAlert(
        t('common.error'),
        (error instanceof Error && error.message) || t('game.alerts.startGameFailed'),
      );
    }
  };

  const makeToggler = (updater: (v: any) => Promise<void>, getNewValue: () => any) => async () => {
    try {
      await updater(getNewValue());
    } catch (error) {
      showAlert(
        t('common.error'),
        (error instanceof Error && error.message) || t('game.alerts.updateSettingsFailed'),
      );
    }
  };

  const handleToggleAdminComments = makeToggler(
    updateAdminWritesComments,
    () => !(game.adminWritesComments ?? false),
  );
  const handleToggleShowSurnames = makeToggler(
    updateShowSurnames,
    () => !(game.showSurnames ?? false),
  );
  const handleToggleTargetMode = makeToggler(
    updateTargetSelectionMode,
    () => (game.targetSelectionMode ?? 'random') === 'random' ? 'chronological' : 'random',
  );
  const handleToggleShowGuessResults = makeToggler(
    updateShowGuessResults,
    () => !(game.showGuessResults ?? false),
  );
  const handleToggleIdeaIncognitoMode = makeToggler(
    updateIdeaIncognitoMode,
    () => !(game.ideaIncognitoMode ?? true),
  );

  const startEditingName = (currentName: string) => {
    setNameInput(currentName);
    setIsEditingName(true);
  };

  const cancelEditingName = () => {
    setIsEditingName(false);
    setNameInput('');
  };

  const handleSaveName = async () => {
    try {
      setIsSavingName(true);
      await updateMyName(nameInput);
      setIsEditingName(false);
      setNameInput('');
    } catch (error) {
      showAlert(
        t('common.error'),
        (error instanceof Error && error.message) || t('game.alerts.updateSettingsFailed'),
      );
    } finally {
      setIsSavingName(false);
    }
  };

  return (
    <>
      {AlertModal}
      <div className="space-y-6">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border-2 border-game-orange">
          <div className="flex items-start justify-between mb-4 gap-4">
            <div className="flex-1">
              <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                {t('game.ui.gameIdLabel')}
              </p>
              <button
                type="button"
                onClick={() => {
                  const url = `${window.location.origin}/game/${game.id}`;
                  navigator.clipboard.writeText(url).then(() =>
                    showAlert(t('game.alerts.copiedTitle'), t('game.alerts.copiedMessage'))
                  );
                }}
                className="font-mono font-bold text-lg text-gray-900 dark:text-white hover:text-game-blue transition-colors text-left"
                title={t('game.ui.copyGameLink')}
              >
                {game.id} 🔗
              </button>
              <span className="mt-2 inline-block bg-game-orange/20 text-game-orange text-xs font-bold px-3 py-1 rounded-full">
                {t('game.ui.statusWaiting')}
              </span>
            </div>
            {isAdmin && (
              <div className="bg-white dark:bg-gray-700 p-2 rounded-xl shadow-sm border border-gray-100 dark:border-gray-600 flex-shrink-0">
                <QRCodeSVG
                  value={`${window.location.origin}/game/${game.id}`}
                  size={80}
                  level="M"
                />
              </div>
            )}
          </div>

          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            {t('game.ui.participants')} ({game.participants?.length ?? 0})
          </p>
          <div className="space-y-2 max-h-40 overflow-y-auto mb-4">
            {game.participants?.map((p, idx) => {
              const isSelf = p.userId === user?.uid;
              return (
                <div
                  key={p.userId}
                  data-cy="participant-row"
                  data-cy-user-id={p.userId}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
                    p.userId === game.adminId
                      ? 'bg-game-orange/10 border border-game-orange/30'
                      : 'bg-gray-50 dark:bg-gray-700'
                  }`}
                >
                  <span className="text-sm text-gray-500 dark:text-gray-400 w-5">{idx + 1}.</span>
                  {isSelf && isEditingName ? (
                    <div className="flex-1 flex items-center gap-2">
                      <input
                        type="text"
                        value={nameInput}
                        onChange={(e) => setNameInput(e.target.value)}
                        maxLength={40}
                        autoFocus
                        data-cy="edit-name-input"
                        className="flex-1 text-sm px-2 py-1 rounded border border-game-blue bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                      />
                      <button
                        type="button"
                        onClick={handleSaveName}
                        disabled={isSavingName || !nameInput.trim()}
                        data-cy="save-name-button"
                        className="text-xs font-semibold text-game-green hover:opacity-80 disabled:opacity-50"
                      >
                        {isSavingName ? t('common.loading') : t('common.save')}
                      </button>
                      <button
                        type="button"
                        onClick={cancelEditingName}
                        disabled={isSavingName}
                        className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                      >
                        {t('common.cancel')}
                      </button>
                    </div>
                  ) : (
                    <span className="text-sm font-medium text-gray-900 dark:text-white flex-1">
                      {getDisplayName(p.userName, game.showSurnames ?? false)}
                      {p.userId === game.adminId && ' 👑'}
                      {isSelf && (
                        <button
                          type="button"
                          onClick={() => startEditingName(p.userName)}
                          title={t('game.ui.editName')}
                          data-cy="edit-name-button"
                          className="ml-2 text-xs text-gray-400 hover:text-game-blue"
                        >
                          ✏️
                        </button>
                      )}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Game type selector */}
          {isAdmin && (
            <div className="flex gap-2 mb-4">
              {(['mirror', 'basket', 'clash', 'ideas'] as const).map(type => (
                <button
                  key={type}
                  type="button"
                  data-cy="game-type-button"
                  data-cy-type={type}
                  onClick={() => setGameType(type).catch(() => {})}
                  className={`flex-1 py-2 rounded-full text-xs font-semibold border-2 transition-all ${
                    (game.gameType ?? 'mirror') === type
                      ? 'bg-game-blue border-game-blue text-white'
                      : 'border-game-blue text-game-blue hover:bg-game-blue/10'
                  }`}
                >
                  {t(`game.ui.gameType${type.charAt(0).toUpperCase() + type.slice(1)}`)}
                </button>
              ))}
            </div>
          )}

          {/* Admin settings */}
          {isAdmin && (
            <div className="space-y-3 border-t border-gray-200 dark:border-gray-700 pt-4 mb-4">
              {[
                {
                  id: 'admin-writes-comments',
                  label: t('game.ui.adminWritesCommentsTitle'),
                  desc: t('game.ui.adminWritesCommentsDescription'),
                  checked: game.adminWritesComments ?? false,
                  onChange: handleToggleAdminComments,
                },
                {
                  id: 'show-surnames',
                  label: t('game.ui.showSurnamesTitle'),
                  desc: t('game.ui.showSurnamesDescription'),
                  checked: game.showSurnames ?? false,
                  onChange: handleToggleShowSurnames,
                },
                {
                  id: 'target-selection-mode',
                  label: t('game.ui.targetSelectionModeTitle'),
                  desc: t('game.ui.targetSelectionModeDescription'),
                  checked: (game.targetSelectionMode ?? 'random') === 'chronological',
                  onChange: handleToggleTargetMode,
                },
                {
                  id: 'show-guess-results',
                  label: t('game.ui.showGuessResultsTitle'),
                  desc: t('game.ui.showGuessResultsDescription'),
                  checked: game.showGuessResults ?? false,
                  onChange: handleToggleShowGuessResults,
                },
              ].map(({ id, label, desc, checked, onChange }) => (
                <label key={id} className="flex items-center justify-between gap-4 cursor-pointer">
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">{label}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{desc}</p>
                  </div>
                  <input
                    type="checkbox"
                    data-cy={`${id}-toggle`}
                    checked={checked}
                    onChange={onChange}
                    className="w-5 h-5 accent-game-green"
                  />
                </label>
              ))}
            </div>
          )}

          {/* Idea game settings */}
          {isAdmin && game.gameType === 'ideas' && (
            <div className="space-y-3 border-t border-gray-200 dark:border-gray-700 pt-4 mb-4">
              {[
                {
                  id: 'idea-incognito-mode',
                  label: t('game.ui.ideaIncognitoModeTitle'),
                  desc: t('game.ui.ideaIncognitoModeDescription'),
                  checked: game.ideaIncognitoMode ?? true,
                  onChange: handleToggleIdeaIncognitoMode,
                },
              ].map(({ id, label, desc, checked, onChange }) => (
                <label key={id} className="flex items-center justify-between gap-4 cursor-pointer">
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">{label}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{desc}</p>
                  </div>
                  <input
                    type="checkbox"
                    data-cy={`${id}-toggle`}
                    checked={checked}
                    onChange={onChange}
                    className="w-5 h-5 accent-game-green"
                  />
                </label>
              ))}
            </div>
          )}

          <div ref={isClashAdmin ? undefined : scrollRef}>
            {isAdmin && (game.gameType ?? 'mirror') !== 'clash' ? (
              <button
                type="button"
                onClick={handleStartGame}
                disabled={game.participants.length < 2 || isStarting || loading}
                data-cy="start-game-button"
                className="w-full bg-game-green text-white px-6 py-3 rounded-full font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {loading || isStarting ? t('common.loading') : t('game.ui.startGame')}
              </button>
            ) : (
              <p className="text-center text-gray-500 dark:text-gray-400 text-sm">
                {t('game.ui.waitingForAdminStart')}
              </p>
            )}
          </div>
        </div>

        {isAdmin && (game.gameType ?? 'mirror') !== 'clash' && (
          <TargetControlPanel game={game} />
        )}

        {game.scores && Object.keys(game.scores).length > 0 && (
          <Leaderboard
            game={game}
            participants={game.participants}
            scores={game.scores}
            guessResults={game.guessResults}
            title={t('game.ui.leaderboardTitle')}
            showSurnames={game.showSurnames}
          />
        )}
      </div>
    </>
  );
};
