import React from 'react';

type PanelProps = {
  children: React.ReactNode;
  style?: React.CSSProperties;
};

export const Panel: React.FC<PanelProps> = ({ children, style }) => (
  <div
    style={{
      background: 'rgba(247, 250, 246, 0.075)',
      border: '1px solid rgba(247, 250, 246, 0.14)',
      borderRadius: 18,
      boxShadow: '0 28px 90px rgba(0, 0, 0, 0.32)',
      padding: 28,
      ...style,
    }}
  >
    {children}
  </div>
);
