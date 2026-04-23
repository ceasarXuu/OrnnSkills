import React from 'react';

type LogoLockupProps = {
  scale?: number;
};

export const LogoLockup: React.FC<LogoLockupProps> = ({ scale = 1 }) => (
  <div
    style={{
      alignItems: 'center',
      display: 'flex',
      gap: 26 * scale,
      transform: `scale(${scale})`,
      transformOrigin: 'center',
    }}
  >
    <div
      style={{
        alignItems: 'center',
        background: 'linear-gradient(145deg, #d9f99d, #2dd4bf 54%, #0f766e)',
        borderRadius: 28,
        boxShadow: '0 26px 70px rgba(45, 212, 191, 0.26)',
        display: 'flex',
        height: 104,
        justifyContent: 'center',
        width: 104,
      }}
    >
      <div
        style={{
          border: '5px solid rgba(7, 19, 15, 0.85)',
          borderRadius: 18,
          height: 48,
          position: 'relative',
          transform: 'rotate(45deg)',
          width: 48,
        }}
      >
        <div
          style={{
            background: '#07130f',
            borderRadius: 999,
            height: 14,
            left: 12,
            position: 'absolute',
            top: 12,
            width: 14,
          }}
        />
      </div>
    </div>
    <div>
      <div style={{ color: '#f7faf6', fontSize: 74, fontWeight: 850, lineHeight: 0.92 }}>
        OrnnSkills
      </div>
      <div style={{ color: '#9fb7aa', fontSize: 23, fontWeight: 700, marginTop: 12 }}>
        Local-first SkillOps dashboard
      </div>
    </div>
  </div>
);
