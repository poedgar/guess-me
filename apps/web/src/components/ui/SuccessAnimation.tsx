import React from 'react';
import { LottieAnimation } from './LottieAnimation';

interface SuccessAnimationProps {
  style?: React.CSSProperties;
}

export const SuccessAnimation: React.FC<SuccessAnimationProps> = ({ style }) => (
  <LottieAnimation
    source="/animations/Success.json"
    autoPlay
    loop={false}
    style={style}
  />
);
