import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Radio, AlertTriangle, Play, Square, Pause, Trash2, FileDown, FolderOpen } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import FullscreenLock from '@/components/tracking/FullscreenLock';
import { toast } from 'sonner';
import TopoBackground from '@/components/tracking/TopoBackground';
import TrackingMap from '@/components/tracking/TrackingMap.jsx';
import PulseDot from '@/components/tracking/PulseDot';
import useCompetitorTracking from '@/lib/useCompetitorTracking';
import { totalDistance, formatDistance, formatDuration, msToKmh, normalizePseudo } from '@/lib/trackingUtils';
import SessionExportModal from '@/components/tracking/SessionExportModal';
import SessionLoadModal from '@/components/tracking/SessionLoadModal';
import LiveMessagePopup from '@/components/tracking/LiveMessagePopup';

export default function Competitor() {
  const navigate = useNavigate();
  const pseudo = localStorage.getItem('pulse:pseudo') || '';

  useEffect(() => {
    if (!pseudo) navigate('/', { replace: true });
  }, [pseudo, navigate]);

  const [showExportModal, setShowExportModal] = useState(false);
  const [showLoadModal, setShowLoadModal] = useState(false);

  // Points chargés (Load / GPX importé) — indépendants de la session live
  const [loadedPoints, setLoadedPoints] = useState([]);

  const [isFullscreen, setIsFullscreen] = useState(false);
  // Flag pour savoir si l'utilisateur a cliqué sur "Retour" (navigation volontaire)
  const navigatingAwayRef = React.useRef(false);

  useEffect(() => {
    const handler = () => {
      const inFs = !!document.fullscreenElement;
      setIsFullscreen(inFs);
      // Rétablir le fullscreen si quitté accidentellement (pas via Retour)
      if (!inFs && !navigatingAwayRef.current) {
        setTimeout(() => {
          document.documentElement.requestFullscreen().catch(() => {});
          setIsFullscreen(true);
        }, 200);
      }
    };
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  const { isTracking, isPaused, points, setPoints, sessionId, start, stop, pause, resume, pendingCount, isOnline } = useCompetitorTracking({ onError: (m) => toast.error(m) });

  // Persist loaded points to ReferenceTrace only when tracking is active
  useEffect(() => {
    if (!isTracking || !pseudo) return;
    const normalized = normalizePseudo(pseudo);
    if (!normalized) return;
    const save = async () => {
      const existing = await base44.entities.ReferenceTrace.filter({ pseudo: normalized }, '-created_date', 10);
      await Promise.all((existing || []).map(r => base44.entities.ReferenceTrace.delete(r.id)));
      if (loadedPoints.length > 0) {
        const slim = loadedPoints.map(p => ({ lat: p.lat, lng: p.lng, altitude: p.altitude, recorded_at: p.recorded_at }));
        await base44.entities.ReferenceTrace.create({ pseudo: normalized, points: slim, label: 'ref' });
      }
    };
    save().catch(() => {});
  }, [isTracking, loadedPoints, pseudo]);

  // Ne pas recharger l'historique au montage — la vue live ne montre que la session active
  // useEffect(() => { if (pseudo) loadExisting(pseudo); }, [pseudo, loadExisting]);

  // Auto fullscreen on mount
  useEffect(() => {
    if (document.fullscreenElement) return;
    document.documentElement.requestFullscreen().catch(() => {});
    setIsFullscreen(true);
  }, []);

  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!isTracking || isPaused) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [isTracking, isPaused]);

  const stats = useMemo(() => {
    const dist = totalDistance(points);
    const first = points[0];
    const last = points[points.length - 1];
    // La durée utilise `now` pour s'actualiser chaque seconde, les autres stats dépendent uniquement des points
    const duration = first ? (isPaused && last ? new Date(last.recorded_at) - new Date(first.recorded_at) : now - new Date(first.recorded_at).getTime()) : 0;
    const avgSpeed = duration > 0 ? (dist / (duration / 1000)) * 3.6 : 0;
    const currentSpeed = last ? msToKmh(last.speed || 0) : 0;
    return {
      distance: formatDistance(dist),
      duration: formatDuration(duration),
      avg: avgSpeed.toFixed(1),
      current: currentSpeed.toFixed(1),
      count: points.length,
    };
  }, [points, now, isPaused]);

  // START : on remet à zéro uniquement les points live, les loadedPoints restent
  const handleStart = async () => { await start(pseudo); toast.success(`Live · ${pseudo}`); };
  const handleStop = async () => {
    stop();
    // Supprimer la trace chargée de ReferenceTrace
    const normalized = normalizePseudo(pseudo);
    if (normalized) {
      const existing = await base44.entities.ReferenceTrace.filter({ pseudo: normalized }, '-created_date', 10);
      await Promise.all((existing || []).map(r => base44.entities.ReferenceTrace.delete(r.id)));
    }
    toast('Session stoppée', { icon: '⏹' });
  };
  const handlePauseResume = () => {
    if (isPaused) { resume(); toast('Reprise', { icon: '▶' }); }
    else { pause(); toast('En pause', { icon: '⏸' }); }
  };
  const handleClear = async () => {
    // Clear efface aussi les points chargés
    setLoadedPoints([]);
    if (!sessionId) { setPoints([]); return; }
    setPoints([]);
    // Supprimer uniquement les points de la session courante
    const { normalizePseudo } = await import('@/lib/trackingUtils');
    const normalized = normalizePseudo(pseudo);
    if (!normalized) return;
    let batch;
    do {
      batch = await base44.entities.TrackPoint.filter({ pseudo: normalized, session_id: sessionId }, 'recorded_at', 500);
      if (!batch || batch.length === 0) break;
      const chunkSize = 10;
      for (let i = 0; i < batch.length; i += chunkSize) {
        await Promise.all(batch.slice(i, i + chunkSize).map(p => base44.entities.TrackPoint.delete(p.id)));
      }
    } while (batch.length === 500);
  };
  const handleExport = () => setShowExportModal(true);

  const handleExitFullscreen = () => {
    // Appelé par le bouton hold-to-unlock — on déverrouille mais reste en fullscreen
    // (l'écran se déverrouille, le plein écran reste actif)
  };

  if (!pseudo) return null;

  return (
    <>
    <LiveMessagePopup pseudo={pseudo} />
    {showExportModal && (
      <SessionExportModal pseudo={pseudo} onClose={() => setShowExportModal(false)} />
    )}
    {showLoadModal && (
      <SessionLoadModal pseudo={pseudo} onLoad={(pts) => setLoadedPoints(pts)} onClose={() => setShowLoadModal(false)} />
    )}
    <div className="h-screen bg-background relative grain overflow-hidden flex flex-col">
      <TopoBackground />

      <FullscreenLock isFullscreen={isFullscreen} isTracking={isTracking} onExitFullscreen={handleExitFullscreen}>
      {/* Header */}
      <header className="relative z-10 px-4 md:px-8 pt-4 pb-2 flex items-center justify-between shrink-0">
        <Link
          to="/"
          onClick={() => { navigatingAwayRef.current = true; document.exitFullscreen().catch(() => {}); }}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Retour
        </Link>

        <div className="flex items-center gap-2 glass rounded-full px-3 py-1.5">
          {isTracking ? <PulseDot size={8} /> : <span className="w-2 h-2 rounded-full bg-muted-foreground/50" />}
          <span className="font-mono text-sm font-medium">{pseudo}</span>
          <span className={`text-[10px] font-mono uppercase tracking-widest ${isTracking && !isPaused ? 'text-primary' : isPaused ? 'text-accent' : 'text-muted-foreground'}`}>
            {isTracking ? (isPaused ? 'Paused' : 'Live') : 'Hors ligne'}
          </span>
          {!isOnline && (
            <span className="text-[10px] font-mono text-destructive uppercase tracking-widest flex items-center gap-1">
              · No signal
            </span>
          )}
          {isOnline && pendingCount > 0 && (
            <span className="text-[10px] font-mono text-accent uppercase tracking-widest">
              · Sync {pendingCount}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Radio className="w-3.5 h-3.5 text-muted-foreground" />
        </div>
      </header>

      {/* Main */}
      <main className="relative z-10 flex-1 px-4 md:px-8 pb-4 grid lg:grid-cols-5 gap-4 min-h-0">

        {/* Left panel */}
        <div className="lg:col-span-2 flex flex-col gap-3 min-h-0">

          {/* Stats grid - 2x2 */}
          <div className="grid grid-cols-2 gap-2 shrink-0">
            {[
              { label: 'Distance', value: stats.distance.split(' ')[0], unit: 'km' },
              { label: 'Durée', value: stats.duration, unit: '' },
              { label: 'Vit. instant.', value: stats.current, unit: 'km/h' },
              { label: 'Vit. moyenne', value: stats.avg, unit: 'km/h' },
            ].map(({ label, value, unit }) => (
              <div key={label} className="glass rounded-xl p-3 text-center ring-1 ring-border">
                <div className="text-[9px] uppercase tracking-widest text-muted-foreground font-mono">{label}</div>
                <div className="font-display text-2xl leading-tight mt-1 text-foreground">{value}</div>
                <div className="text-[9px] text-muted-foreground font-mono">{unit || '\u00a0'}</div>
              </div>
            ))}
          </div>

          {/* Controls */}
          <div className="flex flex-col gap-2 shrink-0">
            {/* Start / Pause / Stop row */}
            <div className="grid grid-cols-2 gap-2">
              {!isTracking ? (
                <button
                  onClick={handleStart}
                  className="h-12 rounded-xl bg-primary text-primary-foreground font-mono text-xs font-medium tracking-widest uppercase flex items-center justify-center gap-2 ring-1 ring-primary/60 glow-primary hover:bg-primary/90 transition col-span-2"
                >
                  <Play className="w-4 h-4" fill="currentColor" /> START
                </button>
              ) : (
                <>
                  <button
                    onClick={handlePauseResume}
                    className={`h-12 rounded-xl font-mono text-xs font-medium tracking-widest uppercase flex items-center justify-center gap-2 ring-1 transition ${
                      isPaused
                        ? 'bg-primary text-primary-foreground ring-primary/60 glow-primary hover:bg-primary/90'
                        : 'bg-secondary text-foreground ring-border hover:bg-secondary/80'
                    }`}
                  >
                    {isPaused
                      ? <><Play className="w-4 h-4" fill="currentColor" /> RESUME</>
                      : <><Pause className="w-4 h-4" fill="currentColor" /> PAUSE</>
                    }
                  </button>
                  <button
                    onClick={handleStop}
                    className="h-12 rounded-xl bg-destructive text-destructive-foreground font-mono text-xs font-medium tracking-widest uppercase flex items-center justify-center gap-2 ring-1 ring-destructive/60 hover:bg-destructive/90 transition"
                  >
                    <Square className="w-4 h-4" fill="currentColor" /> STOP
                  </button>
                </>
              )}
            </div>
            {/* Clear / Load / GPX row — always 3 columns */}
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={handleClear}
                disabled={points.length === 0 && loadedPoints.length === 0}
                className="h-10 rounded-xl bg-secondary text-foreground font-mono text-xs font-medium tracking-widest uppercase flex items-center justify-center gap-1.5 ring-1 ring-border hover:bg-secondary/80 transition disabled:opacity-40"
              >
                <Trash2 className="w-3.5 h-3.5" /> Clear
              </button>
              <button
                onClick={() => setShowLoadModal(true)}
                className="h-10 rounded-xl bg-secondary text-foreground font-mono text-xs font-medium tracking-widest uppercase flex items-center justify-center gap-1.5 ring-1 ring-border hover:bg-secondary/80 transition"
              >
                <FolderOpen className="w-3.5 h-3.5" /> Load
              </button>
              <button
                onClick={handleExport}
                className="h-10 rounded-xl bg-secondary text-foreground font-mono text-xs font-medium tracking-widest uppercase flex items-center justify-center gap-1.5 ring-1 ring-border hover:bg-secondary/80 transition"
              >
                <FileDown className="w-3.5 h-3.5" /> GPX
              </button>
            </div>
          </div>

          {/* GPS warning */}
          {!navigator.geolocation && (
            <div className="flex items-center gap-1 text-[10px] font-mono text-destructive uppercase tracking-wider shrink-0">
              <AlertTriangle className="w-3 h-3" /> GPS indisponible
            </div>
          )}
        </div>

        {/* Map */}
        <div className="lg:col-span-3 min-h-0 h-full">
          <TrackingMap points={points} loadedPoints={loadedPoints} follow={isTracking} />
        </div>
      </main>
      </FullscreenLock>
    </div>
    </>
  );
}