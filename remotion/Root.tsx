import React from 'react';
import { Composition } from 'remotion';
import { OrnnSkillsPromo } from './OrnnSkillsPromo';

export const RemotionRoot: React.FC = () => (
  <Composition
    id="OrnnSkillsPromo"
    component={OrnnSkillsPromo}
    durationInFrames={720}
    fps={30}
    width={1920}
    height={1080}
  />
);
