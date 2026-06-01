import { useLanguage } from '../contexts/LanguageContext';
import React from 'react';


const stepColors = [
  'bg-game-green',
  'bg-game-blue',
  'bg-game-orange',
  'bg-game-purple',
  'bg-game-danger',
];

const steps = [
  { key: 'step1', color: stepColors[0] },
  { key: 'step2', color: stepColors[1] },
  { key: 'step3', color: stepColors[2] },
  { key: 'step4', color: stepColors[3] },
  { key: 'step5', color: stepColors[4] },
];

const scoringItems = [
  { badge: 'comments', color: 'bg-game-green' },
  { badge: 'target',   color: 'bg-game-blue' },
  { badge: 'guessing', color: 'bg-game-orange' },
];

const adminFeatures = ['feature1', 'feature2', 'feature3', 'feature4'];
const tips = ['tip1', 'tip2', 'tip3', 'tip4', 'tip5'];

export function RulesPage() {
  const { t } = useLanguage();
  return (
    <div className="space-y-5">
      {/* Overview */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-3">
          {t('rules.overview.title')}
        </h2>
        <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
          {t('rules.overview.description')}
        </p>
      </div>

      {/* How to Play */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-2xl">▶️</span>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">{t('rules.howToPlay.title')}</h2>
        </div>
        <div className="space-y-4">
          {steps.map((step, idx) => (
            <div key={step.key} className="flex items-start gap-4">
              <div className={`w-8 h-8 rounded-full ${step.color} flex items-center justify-center flex-shrink-0 shadow`}>
                <span className="text-white text-sm font-bold">{idx + 1}</span>
              </div>
              <div className="flex-1">
                <p className="font-bold text-gray-900 dark:text-white text-sm">
                  {t(`rules.howToPlay.${step.key}.title`)}
                </p>
                <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed mt-0.5">
                  {t(`rules.howToPlay.${step.key}.description`)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Scoring */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-2xl">🏆</span>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">{t('rules.scoring.title')}</h2>
        </div>
        <div className="space-y-4">
          {scoringItems.map(item => (
            <div key={item.badge} className="flex items-start gap-4">
              <span className={`${item.color} text-white text-xs font-bold px-3 py-1 rounded-full flex-shrink-0`}>
                {t(`rules.scoring.${item.badge}.badge`)}
              </span>
              <div className="flex-1">
                <p className="font-bold text-gray-900 dark:text-white text-sm">
                  {t(`rules.scoring.${item.badge}.title`)}
                </p>
                <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed mt-0.5">
                  {t(`rules.scoring.${item.badge}.description`)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Admin Features */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-2xl">👑</span>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">{t('rules.admin.title')}</h2>
        </div>
        <div className="space-y-3">
          {adminFeatures.map(f => (
            <div key={f} className="flex items-center gap-3">
              <span className="text-game-green text-lg flex-shrink-0">✓</span>
              <p className="text-gray-700 dark:text-gray-300 text-sm">{t(`rules.admin.${f}`)}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Tips */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-2xl">💡</span>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">{t('rules.tips.title')}</h2>
        </div>
        <div className="space-y-3">
          {tips.map(tip => (
            <p key={tip} className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed">
              💡 <span className="font-semibold">{t(`rules.tips.${tip}`)}</span>
            </p>
          ))}
        </div>
      </div>

      {/* Footer */}
      <p className="text-center text-gray-500 dark:text-gray-400 font-semibold py-4">
        {t('rules.footer')}
      </p>
    </div>
  );
}
