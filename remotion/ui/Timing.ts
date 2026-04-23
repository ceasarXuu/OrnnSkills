import { Easing, interpolate } from 'remotion';

export const easeInOut = (frame: number, start: number, end: number): number =>
  interpolate(frame, [start, end], [0, 1], {
    easing: Easing.inOut(Easing.cubic),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

export const rise = (frame: number, start: number, distance = 34): string => {
  const amount = interpolate(frame, [start, start + 28], [distance, 0], {
    easing: Easing.out(Easing.cubic),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return `translateY(${amount}px)`;
};
