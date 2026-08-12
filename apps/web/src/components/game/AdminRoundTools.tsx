import React, { useState } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAlert } from '../../hooks/useAlert';

interface Props {
  isAdmin: boolean;
  onRestart: () => Promise<void>;
  onSkip: () => Promise<void>;
}

export const AdminRoundTools: React.FC<Props> = ({ isAdmin, onRestart, onSkip }) => {
  const { t } = useLanguage();
  const { showAlert, AlertModal } = useAlert();
  const [expanded, setExpanded] = useState(false);
  const [isRestarting, setIsRestarting] = useState(false);
  const [isSkipping, setIsSkipping] = useState(false);

  if (!isAdmin) return null;

  const confirmRestart = () => {
    showAlert(
      t('game.alerts.restartRoundTitle'),
      t('game.alerts.restartRoundMessage'),
      [
        { text: t('common.cancel'), onPress: () => {}, style: 'secondary' },
        {
          text: t('game.ui.restartRound'),
          onPress: async () => {
            setIsRestarting(true);
            try {
              await onRestart();
            } finally {
              setIsRestarting(false);
            }
          },
          style: 'danger',
        },
      ],
    );
  };

  const confirmSkip = () => {
    showAlert(
      t('game.alerts.skipRoundTitle'),
      t('game.alerts.skipRoundMessage'),
      [
        { text: t('common.cancel'), onPress: () => {}, style: 'secondary' },
        {
          text: t('game.ui.skipRound'),
          onPress: async () => {
            setIsSkipping(true);
            try {
              await onSkip();
            } finally {
              setIsSkipping(false);
            }
          },
          style: 'primary',
        },
      ],
    );
  };

  return (
    <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-700 flex flex-col items-center gap-2">
      {AlertModal}
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        data-cy="admin-tools-toggle"
        className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
      >
        {t('game.ui.adminTools')} {expanded ? '▴' : '▾'}
      </button>
      {expanded && (
        <div className="flex gap-2">
          <button
            type="button"
            data-cy="restart-round-button"
            onClick={confirmRestart}
            disabled={isRestarting || isSkipping}
            className="border border-game-purple text-game-purple px-4 py-1.5 rounded-full text-xs font-semibold hover:bg-game-purple hover:text-white disabled:opacity-50 transition-colors"
          >
            {isRestarting ? t('common.loading') : `↻ ${t('game.ui.restartRound')}`}
          </button>
          <button
            type="button"
            data-cy="skip-round-button"
            onClick={confirmSkip}
            disabled={isRestarting || isSkipping}
            className="border border-gray-400 text-gray-500 px-4 py-1.5 rounded-full text-xs font-semibold hover:bg-gray-400 hover:text-white disabled:opacity-50 transition-colors"
          >
            {isSkipping ? t('common.loading') : `⏭ ${t('game.ui.skipRound')}`}
          </button>
        </div>
      )}
    </div>
  );
};
