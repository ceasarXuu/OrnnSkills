import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { Panel } from '../ui/Panel';
import { easeInOut, rise } from '../ui/Timing';

const metrics = [
  { label: 'Skill families indexed', value: '128', accent: '#a3e635' },
  { label: 'Host instances mapped', value: '346', accent: '#2dd4bf' },
  { label: 'Revisions tracked', value: '1.2k', accent: '#facc15' },
];

const signals = ['usage frequency', 'active projects', 'retry signals', 'version diff'];

export const EvidenceScene: React.FC = () => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 24, 218, 250], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{ opacity, padding: '112px 130px' }}>
      <div style={{ display: 'grid', gap: 44, gridTemplateColumns: '0.92fr 1.08fr' }}>
        <div>
          <div
            style={{
              color: '#f7faf6',
              fontSize: 61,
              fontWeight: 840,
              lineHeight: 1.04,
              opacity: easeInOut(frame, 10, 38),
              transform: rise(frame, 10, 38),
            }}
          >
            Decisions backed by local evidence.
          </div>
          <div
            style={{
              color: '#aec8b8',
              fontSize: 30,
              fontWeight: 590,
              lineHeight: 1.35,
              marginTop: 34,
              opacity: easeInOut(frame, 34, 68),
              transform: rise(frame, 34, 28),
            }}
          >
            OrnnSkills turns scattered skill files into readable inventory, usage and revision
            context before recommending change.
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginTop: 48 }}>
            {signals.map((signal, index) => (
              <div
                key={signal}
                style={{
                  background: 'rgba(217, 249, 157, 0.1)',
                  border: '1px solid rgba(217, 249, 157, 0.28)',
                  borderRadius: 999,
                  color: '#d9f99d',
                  fontSize: 24,
                  fontWeight: 750,
                  opacity: easeInOut(frame, 62 + index * 10, 88 + index * 10),
                  padding: '14px 22px',
                }}
              >
                {signal}
              </div>
            ))}
          </div>
        </div>
        <Panel style={{ minHeight: 710, padding: 34 }}>
          <DashboardMock frame={frame} />
        </Panel>
      </div>
    </AbsoluteFill>
  );
};

const DashboardMock: React.FC<{ frame: number }> = ({ frame }) => (
  <div>
    <div style={{ alignItems: 'center', display: 'flex', justifyContent: 'space-between' }}>
      <div style={{ color: '#f7faf6', fontSize: 31, fontWeight: 820 }}>Skill dashboard</div>
      <div style={{ color: '#78e0d2', fontSize: 20, fontWeight: 750 }}>local index healthy</div>
    </div>
    <div style={{ display: 'grid', gap: 18, gridTemplateColumns: 'repeat(3, 1fr)', marginTop: 28 }}>
      {metrics.map((metric, index) => (
        <div
          key={metric.label}
          style={{
            background: 'rgba(7, 19, 15, 0.62)',
            border: '1px solid rgba(247, 250, 246, 0.12)',
            borderRadius: 14,
            opacity: easeInOut(frame, 46 + index * 12, 74 + index * 12),
            padding: 22,
            transform: rise(frame, 46 + index * 12, 28),
          }}
        >
          <div style={{ color: metric.accent, fontSize: 42, fontWeight: 860 }}>
            {metric.value}
          </div>
          <div style={{ color: '#9fb7aa', fontSize: 18, fontWeight: 650, marginTop: 8 }}>
            {metric.label}
          </div>
        </div>
      ))}
    </div>
    <div style={{ marginTop: 34 }}>
      {['storybook-skills-standard', 'coe-debug', 'shadcn', 'chronicle'].map((skill, index) => {
        const active = easeInOut(frame, 88 + index * 16, 118 + index * 16);
        return (
          <div
            key={skill}
            style={{
              alignItems: 'center',
              background: index === 0 ? 'rgba(45, 212, 191, 0.18)' : 'rgba(247, 250, 246, 0.06)',
              border: '1px solid rgba(247, 250, 246, 0.12)',
              borderRadius: 12,
              display: 'grid',
              gridTemplateColumns: '1.2fr 0.9fr 0.7fr',
              marginBottom: 14,
              opacity: active,
              padding: '20px 22px',
              transform: rise(frame, 88 + index * 16, 22),
            }}
          >
            <div style={{ color: '#f7faf6', fontSize: 24, fontWeight: 780 }}>{skill}</div>
            <div style={{ color: '#b8cfc2', fontSize: 20, fontWeight: 650 }}>
              {index + 2} hosts / {index + 4} projects
            </div>
            <div style={{ color: index === 0 ? '#d9f99d' : '#78e0d2', fontSize: 20, fontWeight: 760 }}>
              {index === 0 ? 'evolve' : 'stable'}
            </div>
          </div>
        );
      })}
    </div>
  </div>
);
