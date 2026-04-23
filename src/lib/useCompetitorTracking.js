import { useCallback, useEffect, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { normalizePseudo } from '@/lib/trackingUtils';
import useOfflineQueue from '@/lib/useOfflineQueue';

const INTERVAL_MS = 15000; // 15s interval — better battery life

async function acquireWakeLock(ref) {
  if (!('wakeLock' in navigator)) return;
  try {
    ref.current = await navigator.wakeLock.request('screen');
    ref.current.addEventListener('release', () => { ref.current = null; });
  } catch (_) { /* silently ignore */ }
}

export default function useCompetitorTracking({ onError }) {
  const [isTracking, setIsTracking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [points, setPoints] = useState([]);
  const [sessionId, setSessionId] = useState(null);
  const [lastError, setLastError] = useState(null);
  const { enqueue, pendingCount, isOnline } = useOfflineQueue();
  const watchIdRef = useRef(null);
  const intervalRef = useRef(null);
  const lastPosRef = useRef(null);
  const wakeLockRef = useRef(null);
  const sessionIdRef = useRef(null);
  const displayNameRef = useRef(null);
  const isPausedRef = useRef(false);

  const loadExisting = useCallback(async (p) => {
    const normalized = normalizePseudo(p);
    if (!normalized) { setPoints([]); return; }
    const data = await base44.entities.TrackPoint.filter({ pseudo: normalized }, 'recorded_at', 5000);
    setPoints(data || []);
  }, []);

  // Last saved point ref for erratic GPS filtering
  const lastSavedRef = useRef(null);

  // Save a point to DB, filtering erratic GPS jumps
  const savePoint = useCallback(async (pos, sessId, normalized, displayName) => {
    const coords = pos.coords;
    const now = pos.timestamp || Date.now();

    // Filter erratic points: if distance > elapsed_seconds * (80km/h) → skip
    if (lastSavedRef.current) {
      const prev = lastSavedRef.current;
      const elapsed = (now - prev.timestamp) / 1000; // seconds
      const maxDist = (80 / 3.6) * elapsed; // meters at 80km/h
      const R = 6371000;
      const toRad = (d) => (d * Math.PI) / 180;
      const dLat = toRad(coords.latitude - prev.lat);
      const dLng = toRad(coords.longitude - prev.lng);
      const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(prev.lat)) * Math.cos(toRad(coords.latitude)) * Math.sin(dLng / 2) ** 2;
      const dist = 2 * R * Math.asin(Math.sqrt(a));
      if (dist > maxDist) return; // erratic point, skip
    }

    const payload = {
      pseudo: normalized,
      display_name: displayName,
      lat: coords.latitude,
      lng: coords.longitude,
      altitude: coords.altitude ?? undefined,
      speed: coords.speed ?? undefined,
      accuracy: coords.accuracy ?? undefined,
      heading: coords.heading ?? undefined,
      recorded_at: new Date(now).toISOString(),
      session_id: sessId,
    };
    const created = await enqueue(payload);
    lastSavedRef.current = { lat: coords.latitude, lng: coords.longitude, timestamp: now };
    // Add point to local state regardless of network (use payload if not yet persisted)
    setPoints((prev) => [...prev, created || { ...payload, id: `local-${now}` }]);
  }, []);

  // Start (or restart) GPS polling at interval (battery-friendly vs watchPosition)
  const startWatch = useCallback((normalized, sessId, displayName) => {
    // Clear any existing watch/interval first
    if (watchIdRef.current != null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    const getPosition = () => {
      if (isPausedRef.current) return;
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          lastPosRef.current = pos;
          try {
            await savePoint(pos, sessId, normalized, displayName);
          } catch (_) { /* ignore save errors */ }
        },
        (err) => { onError?.(`GPS: ${err.message}`); },
        { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
      );
    };

    // First fix after short delay, then every INTERVAL_MS
    setTimeout(getPosition, 1500);
    intervalRef.current = setInterval(getPosition, INTERVAL_MS);
  }, [onError, savePoint]);

  const start = useCallback(async (displayName) => {
    const normalized = normalizePseudo(displayName);
    if (!normalized) { onError?.("Renseigne un pseudo avant de démarrer."); return; }
    if (!('geolocation' in navigator)) { onError?.("La géolocalisation n'est pas disponible sur cet appareil."); return; }

    setLastError(null);
    const newSession = `${normalized}-${Date.now()}`;
    setSessionId(newSession);
    sessionIdRef.current = newSession;
    displayNameRef.current = displayName.trim();
    lastSavedRef.current = null;
    setPoints([]); // fresh trace for each new session
    setIsTracking(true);
    setIsPaused(false);
    isPausedRef.current = false;

    await acquireWakeLock(wakeLockRef);
    startWatch(normalized, newSession, displayName.trim());
  }, [onError, startWatch]);

  const stop = useCallback(async () => {
    if (watchIdRef.current != null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    lastPosRef.current = null;
    if (wakeLockRef.current) {
      wakeLockRef.current.release().catch(() => {});
      wakeLockRef.current = null;
    }

    // Save session metadata
    const normalized = normalizePseudo(displayNameRef.current || '');
    if (normalized && sessionIdRef.current) {
      setPoints((prev) => {
        const pts = prev;
        const first = pts[0];
        const last = pts[pts.length - 1];
        const dist = pts.reduce((acc, p, i) => {
          if (i === 0) return acc;
          const prev2 = pts[i - 1];
          const R = 6371000;
          const toRad = (d) => (d * Math.PI) / 180;
          const dLat = toRad(p.lat - prev2.lat);
          const dLng = toRad(p.lng - prev2.lng);
          const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(prev2.lat)) * Math.cos(toRad(p.lat)) * Math.sin(dLng / 2) ** 2;
          return acc + 2 * R * Math.asin(Math.sqrt(a));
        }, 0);

        const now = new Date().toISOString();
        const label = `${displayNameRef.current} · ${new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}`;
        base44.entities.Session.create({
          pseudo: normalized,
          display_name: displayNameRef.current,
          session_id: sessionIdRef.current,
          label,
          started_at: first?.recorded_at || now,
          ended_at: last?.recorded_at || now,
          point_count: pts.length,
          distance_km: parseFloat((dist / 1000).toFixed(2)),
        }).catch(() => {});
        return pts;
      });
    }

    setIsTracking(false);
    setIsPaused(false);
    isPausedRef.current = false;
  }, []);

  const pause = useCallback(() => {
    isPausedRef.current = true;
    setIsPaused(true);
  }, []);

  const resume = useCallback(() => {
    isPausedRef.current = false;
    setIsPaused(false);
  }, []);

  const clearAll = useCallback(async (displayName) => {
    const normalized = normalizePseudo(displayName);
    if (!normalized) return;
    // Fetch all points and delete them
    let offset = 0;
    const batchSize = 500;
    while (true) {
      const batch = await base44.entities.TrackPoint.filter({ pseudo: normalized }, 'recorded_at', batchSize);
      if (!batch || batch.length === 0) break;
      // Delete in parallel chunks of 10 to balance speed vs rate limit
      const chunkSize = 10;
      for (let i = 0; i < batch.length; i += chunkSize) {
        const chunk = batch.slice(i, i + chunkSize);
        await Promise.all(chunk.map(p => base44.entities.TrackPoint.delete(p.id)));
      }
      if (batch.length < batchSize) break;
      offset += batchSize;
    }
    lastSavedRef.current = null;
    setPoints([]);
  }, []);

  // On page visibility restore: re-acquire wake lock AND restart GPS watch
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && isTracking) {
        if (!wakeLockRef.current) acquireWakeLock(wakeLockRef);
        const normalized = normalizePseudo(displayNameRef.current || '');
        if (normalized && sessionIdRef.current) {
          startWatch(normalized, sessionIdRef.current, displayNameRef.current);
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [isTracking, startWatch]);

  useEffect(() => {
    return () => {
      if (watchIdRef.current != null) navigator.geolocation.clearWatch(watchIdRef.current);
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (wakeLockRef.current) wakeLockRef.current.release().catch(() => {});
    };
  }, []);

  return { isTracking, isPaused, points, sessionId, lastError, start, stop, pause, resume, clearAll, loadExisting, setPoints, pendingCount, isOnline };
}