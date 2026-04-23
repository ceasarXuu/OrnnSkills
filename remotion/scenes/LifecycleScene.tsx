import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { Panel } from '../ui/Panel';
import { easeInOut, rise } from '../ui/Timing';

const steps = ['Scan', 'Understand', 'Manage', 'Evolve', 'Verify'];

export const LifecycleScene: React.FC = () => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 24, 196, 230], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{ opacity, padding: '118px 128px' }}>
      <div
        style={{
          color: '#f7faf6',
          fontSize: 60,
          fontWeight: 820,
          opacity: easeInOut(frame, 6, 34),
          transform: rise(frame, 8, 32),
        }}
      >
        A lifecycle manager, not a folder full of prompts.
      </div>
      <div style={{ display: 'flex', gap: 24, marginTop: 56 }}>
        {steps.map((step, index) => {
          const active = easeInOut(frame, 28 + index * 22, 54 + index * 22);
          return (
            <Panel
              key={step}
              style={{
                flex: 1,
                minHeight: 230,
                opacity: active,
                padding: 26,
                transform: rise(frame, 28 + index * 22, 42),
              }}
            >
              <div style={{ color: '#a3e635', fontSize: 22, fontWeight: 800 }}>
                0{index + 1}
              </div>
              <div style={{ color: '#f7faf6', fontSize: 41, fontWeight: 810, marginTop: 54 }}>
                {step}
              </div>
              <div
                style={{
                  background: 'rgba(45, 212, 191, 0.45)',
                  height: 4,
                  marginTop: 26,
                  transform: `scaleX(${active})`,
                  transformOrigin: 'left',
                  width: '100%',
                }}
              />
            </Panel>
          );
        })}
      </div>
      <FlowLine frame={frame} />
    </AbsoluteFill>
  );
};

const FlowLine: React.FC<{ frame: number }> = ({ frame }) => {
  const progress = easeInOut(frame, 72, 156);

  return (
    <div style={{ height: 280, marginTop: 58, position: 'relative' }}>
      <div
        style={{
          background: 'rgba(247, 250, 246, 0.14)',
          height: 3,
          left: 60,
          position: 'absolute',
          right: 60,
          top: 114,
        }}
      />
      <div
        style={{
          background: 'linear-gradient(90deg, #a3e635, #2dd4bf)',
          height: 6,
          left: 60,
          position: 'absolute',
          top: 112,
          transform: `scaleX(${progress})`,
          transformOrigin: 'left',
          width: 'calc(100% - 120px)',
        }}
      />
      {steps.map((step, index) => {
        const pulse = easeInOut(frame, 84 + index * 15, 104 + index * 15);
        return (
          <div
            key={step}
            style={{
              alignItems: 'center',
              background: pulse > 0.5 ? '#d9f99d' : '#12352c',
              border: '2px solid rgba(247, 250, 246, 0.34)',
              borderRadius: 999,
              color: pulse > 0.5 ? '#07130f' : '#d9f99d',
              display: 'flex',
              fontSize: 24,
              fontWeight: 820,
              height: 88,
              justifyContent: 'center',
              left: `${7 + index * 21}%`,
              position: 'absolute',
              top: 72,
              width: 88,
            }}
          >
            {index + 1}
          </div>
        );
      })}
    </div>
  );
};
