import React from 'react';

interface HeaderLogoProps {
  /** `hero` = full illustration for landing screens, `icon` = compact app icon. */
  variant?: 'hero' | 'icon';
}

export const HeaderLogo: React.FC<HeaderLogoProps> = ({ variant = 'hero' }) => {
  if (variant === 'icon') {
    return (
      <img
        src="/logo.png"
        alt="In The Mirror"
        className="w-full h-full object-contain rounded-xl"
        data-testid="header-logo"
      />
    );
  }

  return (
    <div className="flex justify-center mb-8" data-testid="header-logo">
      <img
        src="/hero.jpg"
        alt="In The Mirror"
        className="w-64 h-64 max-w-full object-contain"
      />
    </div>
  );
};
