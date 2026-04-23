import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { LogoLockup } from '../ui/LogoLockup';
import { easeInOut, rise } from '../ui/Timing';

export const HeroScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const logo = spring({ fps, frame, config: { damping: 90, stiffness: 80 } });
  const subtitle = easeInOut(frame, 32, 72);
  const leave = interpolate(frame, [168, 208], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        alignItems: 'center',
        display: 'flex',
        justifyContent: 'center',
        opacity: leave,
        padding: '0 150px',
      }}
    >
      <div style={{ transform: `scale(${0.88 + logo * 0.12})` }}>
        <LogoLockup />
      </div>
      <div
        style={{
          color: '#eef9f2',
          fontSize: 70,
          fontWeight: 820,
          lineHeight: 1.06,
          marginTop: 72,
          maxWidth: 1300,
          opacity: subtitle,
          textAlign: 'center',
          transform: rise(frame, 34, 42),
        }}
      >
        The visual control plane for skills across Codex, Claude Code and OpenCode.
      </div>
      <div
        style={{
          color: '#a9c4b4',
          fontSize: 31,
          fontWeight: 600,
          marginTop: 34,
          opacity: easeInOut(frame, 62, 98),
          textAlign: 'center',
          transform: rise(frame, 64, 24),
        }}
      >
        Open source. Local-first. Built around the full skill lifecycle.
      </div>
    </AbsoluteFill>
  );
};
