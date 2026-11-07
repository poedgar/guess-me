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
      <picture className="w-full">
        <source media="(min-width: 768px)" srcSet="/hero-desktop.jpg" />
        <img
          src="/hero-mobile.jpg"
          alt="In The Mirror"
          className="w-full max-h-64 object-cover rounded-2xl shadow-md"
        />
      </picture>
    </div>
  );
};
