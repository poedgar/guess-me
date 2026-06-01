import React from 'react';
import { LottieAnimation } from './LottieAnimation';

interface LoginAnimationProps {
  style?: React.CSSProperties;
}

export const LoginAnimation: React.FC<LoginAnimationProps> = ({ style }) => (
  <LottieAnimation
    source="/animations/Login.json"
    autoPlay
    loop
    style={style}
  />
);
