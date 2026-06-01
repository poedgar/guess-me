import React from 'react';
import { MirrorAnimation } from './MirrorAnimation';

export const HeaderLogo: React.FC = () => (
  <div className="flex justify-center mb-8">
    <div style={{ width: 150, height: 150 }}>
      <MirrorAnimation />
    </div>
  </div>
);
