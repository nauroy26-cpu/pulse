import { useCallback, useEffect, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { normalizePseudo, totalDistance } from '@/lib/trackingUtils';
import useOfflineQueue from '@/lib/useOfflineQueue';

const MIN_INTERVAL_MS = 5000;  // 5s when GPS accuracy is poor (poll more)
const MAX_INTERVAL_MS = 20000; // 20s when GPS accuracy is good (poll less)

const STATE_KEY = 'pulse:tracking_state';

async function acquireWakeLock(ref) {
  if (!('wakeLock' in navigator)) return;
  try {
    ref.current = await navigator.wakeLock.request('screen');
    ref.current.addEventListener('release', () => { ref.current = null; });
  } catch (_) { /* silently ignore */ }
}

async function enterFullscreen() {
  try {
    const el = document.documentElement;
    if (!document.fullscreenElement) {
      if (el.requestFullscreen) {
        await el.requestFullscreen({ navigationUI: 'hide' });
      } else if (el.webkitRequestFullscreen) {
        await el.webkitRequestFullscreen();
      }
    }
  } catch (_) {}
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

  // Save a GPS point to DB (with erratic point filter)
  const savePoint = useCallback(async (pos, sessId, normalized, displayName) => {
    const coords = pos.coords;
    const now = pos.timestamp || Date.now();

    // Filter bad accuracy
    if (coords.accuracy != null && coords.accuracy > 60) return;

    // Filter erratic points: if distance > elapsed_seconds * (80km/h) → skip
    if (lastSavedRef.current) {
      const prev = lastSavedRef.current;
      const elapsed = (now - prev.timestamp) / 1000;
      const maxDist = (80 / 3.6) * elapsed;
      const R = 6371000;
      const toRad = (d) => (d * Math.PI) / 180;
      const dLat = toRad(coords.latitude - prev.lat);
      const dLng = toRad(coords.longitude - prev.lng);
      const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(prev.lat)) * Math.cos(toRad(coords.latitude)) * Math.sin(dLng / 2) ** 2;
      const dist = 2 * R * Math.asin(Math.sqrt(a));
      if (dist > maxDist) return;
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
    setPoints((prev) => [...prev, created || { ...payload, id: `local-${now}` }]);
  }, [enqueue]);

  // Start (or restart) GPS polling at dynamic interval based on accuracy
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
          // Reschedule with dynamic interval based on accuracy
          rescheduleNextPosition();
        },
        (err) => { onError?.(`GPS: ${err.message}`); },
        { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
      );
    };

    const rescheduleNextPosition = () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      // Adaptive polling: bad accuracy (high value) → poll faster to find good point
      let nextInterval = MIN_INTERVAL_MS;
      if (lastPosRef.current?.coords?.accuracy != null) {
        const accuracy = lastPosRef.current.coords.accuracy;
        // Inverse: accuracy 50m (good) → 20s, accuracy 100m (poor) → 5s
        nextInterval = MAX_INTERVAL_MS - Math.min((accuracy - 5) / 95 * (MAX_INTERVAL_MS - MIN_INTERVAL_MS), MAX_INTERVAL_MS - MIN_INTERVAL_MS);
      }
      intervalRef.current = setInterval(getPosition, nextInterval);
    };

    // First fix after short delay, then reschedule dynamically
    setTimeout(getPosition, 1500);
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

    await enterFullscreen();
    await acquireWakeLock(wakeLockRef);

    // Lock orientation to portrait
    try {
      if ('orientation' in screen && 'lock' in screen.orientation) {
        await screen.orientation.lock('portrait');
      }
    } catch (_) {}

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

    await enterFullscreen();

    // Unlock orientation
    try {
      if ('orientation' in screen && 'unlock' in screen.orientation) {
        screen.orientation.unlock();
      }
    } catch (_) {}

    // Save session metadata
    const normalized = normalizePseudo(displayNameRef.current || '');
    if (normalized && sessionIdRef.current) {
      setPoints((pts) => {
        const first = pts[0];
        const last = pts[pts.length - 1];
        const dist = totalDistance(pts);
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
    // Wake lock only — GPS interval continue de tourner, isPausedRef.current=false suffit
    acquireWakeLock(wakeLockRef);
  }, []);

  const resumeFromBackground = useCallback(async (displayName, sessId) => {
    const normalized = normalizePseudo(displayName);
    if (!normalized) { onError?.("Renseigne un pseudo avant de démarrer."); return; }

    sessionIdRef.current = sessId;
    displayNameRef.current = displayName;
    setIsTracking(true);
    setIsPaused(false);
    isPausedRef.current = false;

    await enterFullscreen();
    await acquireWakeLock(wakeLockRef);

    // Lock orientation
    try {
      if ('orientation' in screen && 'lock' in screen.orientation) {
        await screen.orientation.lock('portrait');
      }
    } catch (_) {}

    startWatch(normalized, sessId, displayName);
  }, [onError, startWatch]);

  const clearAll = useCallback(async (displayName) => {
    const normalized = normalizePseudo(displayName);
    if (!normalized) return;
    const batchSize = 500;
    while (true) {
      const batch = await base44.entities.TrackPoint.filter({ pseudo: normalized }, 'recorded_at', batchSize);
      if (!batch || batch.length === 0) break;
      const chunkSize = 10;
      for (let i = 0; i < batch.length; i += chunkSize) {
        await Promise.all(batch.slice(i, i + chunkSize).map(p => base44.entities.TrackPoint.delete(p.id)));
      }
      if (batch.length < batchSize) break;
    }
    lastSavedRef.current = null;
    setPoints([]);
  }, []);

  // Save state to localStorage
  useEffect(() => {
    if (isTracking || isPaused) {
      localStorage.setItem(STATE_KEY, JSON.stringify({
        isTracking,
        isPaused,
        displayName: displayNameRef.current,
        sessionId: sessionIdRef.current,
      }));
    } else {
      localStorage.removeItem(STATE_KEY);
    }
  }, [isTracking, isPaused]);

  // On page visibility restore: auto-resume if was tracking/paused
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        const saved = (() => {
          try { return JSON.parse(localStorage.getItem(STATE_KEY)); } catch { return null; }
        })();

        if (saved && (saved.isTracking || saved.isPaused)) {
          // Was tracking or paused → auto-resume same session
          if (!isTracking) {
            resumeFromBackground(saved.displayName, saved.sessionId);
            if (saved.isPaused) {
              setTimeout(() => pause(), 500);
            }
          }
        } else if (isTracking) {
          // App was active but lost state → just re-setup GPS
          if (!wakeLockRef.current) acquireWakeLock(wakeLockRef);
          const normalized = normalizePseudo(displayNameRef.current || '');
          if (normalized && sessionIdRef.current) {
            startWatch(normalized, sessionIdRef.current, displayNameRef.current);
          }
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [isTracking, pause, startWatch, resumeFromBackground]);

  useEffect(() => {
    return () => {
      if (watchIdRef.current != null) navigator.geolocation.clearWatch(watchIdRef.current);
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (wakeLockRef.current) wakeLockRef.current.release().catch(() => {});
    };
  }, []);

  return { isTracking, isPaused, points, sessionId, lastError, start, stop, pause, resume, clearAll, loadExisting, setPoints, pendingCount, isOnline, resumeFromBackground };
}