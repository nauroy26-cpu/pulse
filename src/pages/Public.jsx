import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Eye, WifiOff } from 'lucide-react';
import TopoBackground from '@/components/tracking/TopoBackground';
import TrackingMap from '@/components/tracking/TrackingMap';
import PulseDot from '@/components/tracking/PulseDot';
import usePublicTracking from '@/lib/usePublicTracking';
import SendMessageButton from '@/components/tracking/SendMessageButton';
import { totalDistance, formatDistance, formatDuration, msToKmh } from '@/lib/trackingUtils';

export default function Public() {
  const navigate = useNavigate();
  const followPseudo = localStorage.getItem('pulse:follow_pseudo') || '';
  const followDisplay = localStorage.getItem('pulse:follow') || followPseudo;

  const navigatingAwayRef = useRef(false);
  const wakeLockRef = useRef(null);

  useEffect(() => {
    if (!followPseudo) navigate('/', { replace: true });
  }, [followPseudo, navigate]);

  // Wake lock — prevent screen from sleeping
  useEffect(() => {
    const acquire = async () => {
      if (!('wakeLock' in navigator)) return;
      try { wakeLockRef.current = await navigator.wakeLock.request('screen'); } catch (_) {}
    };
    acquire();
    const onVisibility = () => { if (document.visibilityState === 'visible') acquire(); };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      wakeLockRef.current?.release().catch(() => {});
    };
  }, []);

  // Auto fullscreen on mount + re-lock if exited accidentally
  useEffect(() => {
    const requestFs = () => {
      document.documentElement.requestFullscreen().catch(() => {});
    };
    if (!document.fullscreenElement) requestFs();

    const handler = () => {
      if (!document.fullscreenElement && !navigatingAwayRef.current) {
        setTimeout(() => {
          document.documentElement.requestFullscreen().catch(() => {});
        }, 200);
      }
    };
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  const { points, loadedPoints, isLive, lastUpdate } = usePublicTracking(followPseudo);

  const stats = useMemo(() => {
    const pts = points;
    const dist = totalDistance(pts);
    const first = pts[0];
    const last = pts[pts.length - 1];
    const duration = first && last ? new Date(last.recorded_at) - new Date(first.recorded_at) : 0;
    const avgSpeed = duration > 0 ? (dist / (duration / 1000)) * 3.6 : 0;
    const currentSpeed = last ? msToKmh(last.speed || 0) : 0;
    const displayName = last?.display_name || first?.display_name || followDisplay;
    return {
      displayName,
      distance: formatDistance(dist),
      duration: formatDuration(duration),
      avg: avgSpeed.toFixed(1),
      current: currentSpeed.toFixed(1),
      count: pts.length,
    };
  }, [points, followDisplay]);

  if (!followPseudo) return null;

  return (
    <div className="h-screen bg-background relative grain overflow-hidden flex flex-col">
      <TopoBackground />

      {/* Header */}
      <header className="relative z-10 px-4 md:px-8 pt-4 pb-2 flex items-center justify-between shrink-0">
        <Link
          to="/"
          onClick={() => {
            navigatingAwayRef.current = true;
            document.exitFullscreen().catch(() => {});
          }}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Retour
        </Link>

        <div className="flex items-center gap-2 glass rounded-full px-3 py-1.5">
          {isLive ? <PulseDot size={8} /> : <span className="w-2 h-2 rounded-full bg-muted-foreground/50" />}
          <span className="font-mono text-sm font-medium">{stats.displayName || followDisplay}</span>
          <span className={`text-[10px] font-mono uppercase tracking-widest ${isLive ? 'text-primary' : 'text-muted-foreground'}`}>
            {isLive ? 'Live' : 'Hors ligne'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Eye className="w-3.5 h-3.5 text-muted-foreground" />
        </div>
      </header>

      {/* Main */}
      <main className="relative z-10 flex-1 px-4 md:px-8 pb-4 grid lg:grid-cols-5 gap-4 min-h-0">

        {/* Left panel */}
        <div className="lg:col-span-2 flex flex-col gap-3 min-h-0">

          {/* Send message button — only when live */}
          {isLive && <SendMessageButton pseudo={stats.displayName || followDisplay} />}

          {/* Stats grid - 2x2 */}
          <div className="grid grid-cols-2 gap-2 shrink-0">
            {[
              { label: 'Distance', value: stats.distance.split(' ')[0], unit: 'km' },
              { label: 'Durée', value: stats.duration, unit: '' },
              { label: 'Vit. instantanée', value: stats.current, unit: 'km/h' },
              { label: 'Vit. moyenne', value: stats.avg, unit: 'km/h' },
            ].map(({ label, value, unit }) => (
              <div key={label} className="glass rounded-xl p-3 text-center ring-1 ring-border">
                <div className="text-[9px] uppercase tracking-widest text-muted-foreground font-mono">{label}</div>
                <div className="font-display text-2xl leading-tight mt-1 text-foreground">{value}</div>
                <div className="text-[9px] text-muted-foreground font-mono">{unit || '\u00a0'}</div>
              </div>
            ))}
          </div>

          {/* Status card */}
          <div className={`glass rounded-xl px-4 py-3 flex items-center gap-3 shrink-0 ${isLive ? 'ring-1 ring-primary/40' : 'ring-1 ring-border'}`}>
            <div className="relative flex items-center justify-center shrink-0">
              {isLive ? (
                <>
                  <span className="absolute w-5 h-5 rounded-full bg-primary/40 animate-ping" />
                  <span className="relative w-3 h-3 rounded-full bg-primary" />
                </>
              ) : (
                <span className="w-3 h-3 rounded-full bg-muted-foreground/50" />
              )}
            </div>
            <div>
              <div className={`text-sm font-display leading-tight ${isLive ? 'text-primary' : 'text-muted-foreground'}`}>
                {isLive ? 'Enregistrement actif' : points.length > 0 ? 'Dernière position connue' : 'Aucun signal'}
              </div>
              {lastUpdate && (
                <div className="text-[10px] font-mono text-muted-foreground mt-0.5 uppercase tracking-widest">
                  MAJ · {lastUpdate.toLocaleTimeString('fr-FR')}
                </div>
              )}
            </div>
          </div>

          {/* Points count */}
          <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider shrink-0 flex items-center gap-2">
            {stats.count} pts
            {!isLive && (
              <span className="flex items-center gap-1 text-muted-foreground/60">
                <WifiOff className="w-3 h-3" /> Hors ligne
              </span>
            )}
          </div>
        </div>

        {/* Map */}
        <div className="lg:col-span-3 min-h-0 h-full">
          <TrackingMap points={points} loadedPoints={loadedPoints} follow={isLive} />
        </div>
      </main>
    </div>
  );
}