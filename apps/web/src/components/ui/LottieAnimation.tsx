import React from 'react';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';

interface LottieAnimationProps {
  source: string;
  autoPlay?: boolean;
  loop?: boolean;
  style?: React.CSSProperties;
}

export const LottieAnimation: React.FC<LottieAnimationProps> = ({
  source,
  autoPlay = true,
  loop = true,
  style,
}) => {
  return (
    <div style={style}>
      <DotLottieReact
        src={source}
        autoplay={autoPlay}
        loop={loop}
      />
    </div>
  );
};
