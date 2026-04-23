import React from 'react';

export default function StatTile({ label, value, unit, accent = false }) {
  return (
    <div className={`glass rounded-2xl p-4 md:p-5 relative overflow-hidden ${accent ? 'ring-1 ring-primary/40' : ''}`}>
      <div className="text-[10px] md:text-xs uppercase tracking-[0.2em] text-muted-foreground font-medium">
        {label}
      </div>
      <div className="mt-2 flex items-baseline gap-1.5">
        <span className={`font-display text-2xl md:text-4xl leading-none ${accent ? 'text-primary' : 'text-foreground'}`}>
          {value}
        </span>
        {unit && (
          <span className="text-xs md:text-sm text-muted-foreground font-mono">{unit}</span>
        )}
      </div>
    </div>
  );
}