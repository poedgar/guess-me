import React from 'react';
import { LottieAnimation } from './LottieAnimation';

interface LiquidLoaderProps {
  size?: number;
}

export const LiquidLoader: React.FC<LiquidLoaderProps> = ({ size = 100 }) => (
  <div className="flex items-center justify-center">
    <div style={{ width: size, height: size }}>
      <LottieAnimation
        source="/animations/Liquid-4-Dot-Loader.json"
        autoPlay
        loop
      />
    </div>
  </div>
);
