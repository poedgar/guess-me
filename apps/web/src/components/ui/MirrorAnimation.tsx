import React from 'react';
import { LottieAnimation } from './LottieAnimation';

interface MirrorAnimationProps {
  style?: React.CSSProperties;
}

export const MirrorAnimation: React.FC<MirrorAnimationProps> = ({ style }) => (
  <LottieAnimation
    source="/animations/Mirror.json"
    autoPlay
    loop
    style={style}
  />
);
