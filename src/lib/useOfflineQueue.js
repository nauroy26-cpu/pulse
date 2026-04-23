import { useCallback, useEffect, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';

const QUEUE_KEY = 'pulse:offline_queue';

function loadQueue() {
  try { return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]'); }
  catch { return []; }
}

function saveQueue(q) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(q));
}

export function clearOfflineQueue() {
  localStorage.removeItem(QUEUE_KEY);
}

/**
 * Returns:
 *  - enqueue(payload): add a point to the queue (and try to flush immediately)
 *  - pendingCount: number of points waiting to be sent
 *  - isOnline: current network status
 */
export default function useOfflineQueue() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(() => loadQueue().length);
  const flushingRef = useRef(false);

  const flush = useCallback(async () => {
    if (flushingRef.current) return;
    const q = loadQueue();
    if (q.length === 0) return;
    flushingRef.current = true;

    const failed = [];
    for (const payload of q) {
      try {
        await base44.entities.TrackPoint.create(payload);
      } catch {
        failed.push(payload);
      }
    }

    saveQueue(failed);
    setPendingCount(failed.length);
    flushingRef.current = false;
  }, []);

  // Listen for online/offline events
  useEffect(() => {
    const onOnline = () => { setIsOnline(true); flush(); };
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [flush]);

  // On mount: if online and queue has items, flush them
  useEffect(() => {
    if (navigator.onLine) flush();
  }, [flush]);

  const enqueue = useCallback(async (payload) => {
    if (navigator.onLine) {
      try {
        const created = await base44.entities.TrackPoint.create(payload);
        return created;
      } catch {
        // Network error despite online flag → queue it
      }
    }
    // Store in queue
    const q = loadQueue();
    q.push(payload);
    saveQueue(q);
    setPendingCount(q.length);
    return null; // not yet persisted
  }, []);

  return { enqueue, pendingCount, isOnline };
}