import React from 'react';

export default function TopoBackground({ className = "" }) {
  return (
    <div className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}>
      <svg
        className="absolute inset-0 w-full h-full opacity-[0.07]"
        viewBox="0 0 1200 800"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <linearGradient id="topoGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="hsl(75, 95%, 55%)" />
            <stop offset="100%" stopColor="hsl(18, 85%, 55%)" />
          </linearGradient>
        </defs>
        {/* Elevation contour lines */}
        {Array.from({ length: 14 }).map((_, i) => (
          <path
            key={i}
            d={`M -50 ${100 + i * 55} Q ${200 + i * 20} ${50 + i * 40} ${500 + i * 10} ${150 + i * 45} T ${900} ${200 + i * 40} T ${1250} ${180 + i * 50}`}
            stroke="url(#topoGrad)"
            strokeWidth="1"
            fill="none"
          />
        ))}
      </svg>
      {/* Radial glow */}
      <div className="absolute top-1/4 -left-40 w-[600px] h-[600px] rounded-full bg-primary/10 blur-[120px]" />
      <div className="absolute bottom-0 -right-40 w-[500px] h-[500px] rounded-full bg-accent/10 blur-[120px]" />
    </div>
  );
}