import React from 'react';
import {
  AbsoluteFill,
  Easing,
  interpolate,
  Sequence,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { EvidenceScene } from './scenes/EvidenceScene';
import { HeroScene } from './scenes/HeroScene';
import { LifecycleScene } from './scenes/LifecycleScene';
import { LogoLockup } from './ui/LogoLockup';

const sceneStyle: React.CSSProperties = {
  background: '#07130f',
  color: '#f7faf6',
  fontFamily:
    'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  overflow: 'hidden',
};

export const OrnnSkillsPromo: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const outro = spring({
    fps,
    frame: frame - 624,
    config: { damping: 120, stiffness: 90 },
  });
  const fadeToFinal = interpolate(frame, [610, 660], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });

  return (
    <AbsoluteFill style={sceneStyle}>
      <BackgroundSystem />
      <Sequence from={0} durationInFrames={210} premountFor={fps}>
        <HeroScene />
      </Sequence>
      <Sequence from={190} durationInFrames={230} premountFor={fps}>
        <LifecycleScene />
      </Sequence>
      <Sequence from={390} durationInFrames={250} premountFor={fps}>
        <EvidenceScene />
      </Sequence>
      <AbsoluteFill
        style={{
          alignItems: 'center',
          background: `rgba(7, 19, 15, ${fadeToFinal})`,
          display: 'flex',
          justifyContent: 'center',
          opacity: fadeToFinal,
          transform: `scale(${0.92 + outro * 0.08})`,
        }}
      >
        <LogoLockup scale={1.4} />
        <div style={{ height: 38 }} />
        <div style={{ color: '#b8cfc2', fontSize: 42, fontWeight: 600 }}>
          See every skill. Manage every instance. Evolve with evidence.
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const BackgroundSystem: React.FC = () => {
  const frame = useCurrentFrame();
  const drift = interpolate(frame, [0, 720], [0, -160], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill>
      <div
        style={{
          bottom: -220,
          height: 620,
          left: -120,
          opacity: 0.36,
          position: 'absolute',
          right: -120,
          transform: `translateX(${drift}px)`,
        }}
      >
        {Array.from({ length: 14 }).map((_, index) => (
          <div
            key={index}
            style={{
              background: index % 3 === 0 ? '#2dd4bf' : '#a3e635',
              height: 2,
              left: `${index * 9}%`,
              opacity: 0.18,
              position: 'absolute',
              top: `${(index % 5) * 18}%`,
              transform: 'rotate(-18deg)',
              width: 540,
            }}
          />
        ))}
      </div>
      <div
        style={{
          background:
            'radial-gradient(circle at 50% 20%, rgba(45,212,191,0.16), transparent 34%), linear-gradient(135deg, rgba(163,230,53,0.08), transparent 42%, rgba(20,184,166,0.1))',
          inset: 0,
          position: 'absolute',
        }}
      />
    </AbsoluteFill>
  );
};
