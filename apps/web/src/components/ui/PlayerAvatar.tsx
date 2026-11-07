import React from 'react';

interface PlayerAvatarProps {
  /** Avatar number from `getAvatarId(participant)`. */
  avatarId: number;
  name: string;
  size?: 'sm' | 'md' | 'lg';
}

const sizeClasses = {
  sm: 'w-8 h-8',
  md: 'w-12 h-12',
  lg: 'w-16 h-16',
};

export const PlayerAvatar: React.FC<PlayerAvatarProps> = ({ avatarId, name, size = 'md' }) => (
  <img
    src={`/avatars/avatar-${String(avatarId).padStart(2, '0')}.png`}
    alt={name}
    title={name}
    className={`${sizeClasses[size]} rounded-full object-cover flex-shrink-0`}
    loading="lazy"
  />
);
