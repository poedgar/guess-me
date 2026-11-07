import React from 'react';
import { useLanguage } from '../../contexts/LanguageContext';

interface HeaderLogoProps {
  /** `hero` = full illustration for landing screens, `icon` = compact app icon. */
  variant?: 'hero' | 'icon';
}

export const HeaderLogo: React.FC<HeaderLogoProps> = ({ variant = 'hero' }) => {
  const { t } = useLanguage();
  if (variant === 'icon') {
    return (
      <img
        src="/logo.png"
        alt={t('app.title')}
        className="w-full h-full object-contain rounded-xl"
        data-testid="header-logo"
      />
    );
  }

  return (
    <div className="flex justify-center mb-8" data-testid="header-logo">
      <img
        src="/hero.png"
        alt={t('app.title')}
        className="w-64 h-64 max-w-full object-contain"
      />
    </div>
  );
};
