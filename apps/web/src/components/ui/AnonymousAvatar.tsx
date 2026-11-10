import React from 'react';
import { useLanguage } from '../../contexts/LanguageContext';

interface AnonymousAvatarProps {
  /** Avatar number from `assignAnonymousAvatars(...)`. */
  avatarId: number;
  size?: 'sm' | 'md';
}

const sizeClasses = {
  sm: 'w-8 h-8',
  md: 'w-10 h-10',
};

/** Cartoon avatar shown next to anonymous content (comments, ideas). */
export const AnonymousAvatar: React.FC<AnonymousAvatarProps> = ({ avatarId, size = 'md' }) => {
  const { t } = useLanguage();
  return (
    <img
      src={`/avatars/avatar-${String(avatarId).padStart(2, '0')}.png`}
      alt={t('common.anonymous')}
      title={t('common.anonymous')}
      className={`${sizeClasses[size]} rounded-full object-cover flex-shrink-0 bg-cream`}
      loading="lazy"
      data-cy="anonymous-avatar"
    />
  );
};
