import React from 'react';

export default function PulseDot({ size = 14, color = "hsl(75,95%,55%)" }) {
  return (
    <span className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <span
        className="absolute inset-0 rounded-full pulse-ring"
        style={{ background: color, opacity: 0.6 }}
      />
      <span
        className="relative rounded-full"
        style={{ width: size * 0.6, height: size * 0.6, background: color, boxShadow: `0 0 12px ${color}` }}
      />
    </span>
  );
}