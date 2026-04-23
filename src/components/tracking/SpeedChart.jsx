import React, { useMemo } from 'react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts';
import { msToKmh } from '@/lib/trackingUtils';

export default function SpeedChart({ points = [] }) {
  const data = useMemo(() => {
    if (!points || points.length === 0) return [];
    const t0 = new Date(points[0].recorded_at).getTime();
    return points.map((p) => ({
      t: Math.round((new Date(p.recorded_at).getTime() - t0) / 1000),
      speed: Number(msToKmh(p.speed || 0).toFixed(1)),
    }));
  }, [points]);

  if (data.length < 2) {
    return (
      <div className="h-32 flex items-center justify-center text-xs text-muted-foreground font-mono">
        En attente de données…
      </div>
    );
  }

  return (
    <div className="h-32 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="spdGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(75, 95%, 55%)" stopOpacity={0.5} />
              <stop offset="100%" stopColor="hsl(75, 95%, 55%)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="t" hide />
          <YAxis hide />
          <Tooltip
            contentStyle={{ background: '#111', border: '1px solid #222', borderRadius: 8, fontSize: 12 }}
            labelFormatter={(v) => `${v}s`}
            formatter={(v) => [`${v} km/h`, 'Vitesse']}
          />
          <Area type="monotone" dataKey="speed" stroke="hsl(75, 95%, 55%)" strokeWidth={2} fill="url(#spdGrad)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}