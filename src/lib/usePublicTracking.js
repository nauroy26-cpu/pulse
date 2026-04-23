import { useCallback, useEffect, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { normalizePseudo } from '@/lib/trackingUtils';

const POLL_MS = 10000;
const LIVE_THRESHOLD_MS = 60000;

export default function usePublicTracking(pseudo) {
  const [points, setPoints] = useState([]);
  const [loadedPoints, setLoadedPoints] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isLive, setIsLive] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);

  const intervalRef = useRef(null);
  const mountedRef = useRef(true);
  const lastPointTimeRef = useRef(null);   // timestamp ISO of last known point
  const currentSessionIdRef = useRef(null); // track session changes

  // ── Initial full load ──────────────────────────────────────────
  const fullLoad = useCallback(async (normalized) => {
    const allRecent = await base44.entities.TrackPoint.filter(
      { pseudo: normalized },
      '-recorded_at',
      1
    );
    if (!mountedRef.current) return;
    if (!allRecent || allRecent.length === 0) {
      setIsLive(false);
      setLastUpdate(new Date());
      return;
    }

    const mostRecent = allRecent[0];
    const lastTime = new Date(mostRecent.recorded_at).getTime();
    const currentSessionId = mostRecent.session_id;
    currentSessionIdRef.current = currentSessionId;

    // Check session stopped
    let sessionStopped = false;
    if (currentSessionId) {
      const sessionRecords = await base44.entities.Session.filter(
        { pseudo: normalized, session_id: currentSessionId },
        '-created_date',
        1
      );
      if (!mountedRef.current) return;
      sessionStopped = !!sessionRecords?.[0]?.ended_at;
    }

    const live = Date.now() - lastTime < LIVE_THRESHOLD_MS && !sessionStopped;

    // Load reference trace
    const refTraces = await base44.entities.ReferenceTrace.filter({ pseudo: normalized }, '-created_date', 1);
    if (!mountedRef.current) return;
    const refPoints = refTraces?.[0]?.points || [];
    setLoadedPoints(refPoints.map(p => ({ ...p, _loaded: true })));

    // Load full session trace
    const sessionPoints = currentSessionId
      ? await base44.entities.TrackPoint.filter(
          { pseudo: normalized, session_id: currentSessionId },
          'recorded_at',
          5000
        )
      : [mostRecent];

    if (!mountedRef.current) return;
    setPoints(sessionPoints || []);

    // Remember last point time for incremental polling
    const lastPt = sessionPoints?.[sessionPoints.length - 1];
    lastPointTimeRef.current = lastPt?.recorded_at || null;

    setIsLive(live);
    setLastUpdate(new Date());
  }, []);

  // ── Incremental poll — only fetch NEW points since last known ──
  const incrementalPoll = useCallback(async (normalized) => {
    // 1. Check if still live (fetch very latest point)
    const latest = await base44.entities.TrackPoint.filter(
      { pseudo: normalized },
      '-recorded_at',
      1
    );
    if (!mountedRef.current) return;

    if (!latest || latest.length === 0) {
      setIsLive(false);
      setLastUpdate(new Date());
      return;
    }

    const mostRecent = latest[0];
    const lastTime = new Date(mostRecent.recorded_at).getTime();
    const currentSessionId = mostRecent.session_id;

    // Session changed → full reload
    if (currentSessionId !== currentSessionIdRef.current) {
      currentSessionIdRef.current = currentSessionId;
      lastPointTimeRef.current = null;
      await fullLoad(normalized);
      return;
    }

    // Check session stopped
    let sessionStopped = false;
    if (currentSessionId) {
      const sessionRecords = await base44.entities.Session.filter(
        { pseudo: normalized, session_id: currentSessionId },
        '-created_date',
        1
      );
      if (!mountedRef.current) return;
      sessionStopped = !!sessionRecords?.[0]?.ended_at;
    }

    const live = Date.now() - lastTime < LIVE_THRESHOLD_MS && !sessionStopped;
    setIsLive(live);
    setLastUpdate(new Date());

    if (!live) return; // offline — keep last known points, no new fetch needed

    // 2. Fetch only new points since lastPointTimeRef
    if (!lastPointTimeRef.current) {
      await fullLoad(normalized);
      return;
    }

    // We can't filter by recorded_at > X directly, so fetch recent points and append only new ones
    // Fetch last 200 to cover any burst, deduplicate by id
    const recent = await base44.entities.TrackPoint.filter(
      { pseudo: normalized, session_id: currentSessionId },
      '-recorded_at',
      200
    );
    if (!mountedRef.current) return;

    const lastKnownTime = new Date(lastPointTimeRef.current).getTime();
    const newPts = (recent || [])
      .filter(p => new Date(p.recorded_at).getTime() > lastKnownTime)
      .sort((a, b) => new Date(a.recorded_at) - new Date(b.recorded_at));

    if (newPts.length > 0) {
      setPoints(prev => [...prev, ...newPts]);
      lastPointTimeRef.current = newPts[newPts.length - 1].recorded_at;
    }

    // Also refresh reference trace if it changed (cheap — 1 record)
    const refTraces = await base44.entities.ReferenceTrace.filter({ pseudo: normalized }, '-created_date', 1);
    if (!mountedRef.current) return;
    const refPoints = refTraces?.[0]?.points || [];
    setLoadedPoints(refPoints.map(p => ({ ...p, _loaded: true })));
  }, [fullLoad]);

  // ── Bootstrap ──────────────────────────────────────────────────
  useEffect(() => {
    mountedRef.current = true;
    const normalized = normalizePseudo(pseudo);

    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }

    if (!normalized) {
      setPoints([]);
      setIsLive(false);
      return;
    }

    setLoading(true);
    lastPointTimeRef.current = null;
    currentSessionIdRef.current = null;

    fullLoad(normalized).finally(() => { if (mountedRef.current) setLoading(false); });
    intervalRef.current = setInterval(() => incrementalPoll(normalized), POLL_MS);

    return () => {
      mountedRef.current = false;
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [pseudo, fullLoad, incrementalPoll]);

  return { points, loadedPoints, loading, isLive, lastUpdate, refresh: () => fullLoad(normalizePseudo(pseudo)) };
}