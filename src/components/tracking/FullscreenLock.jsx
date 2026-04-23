import React, { useEffect, useRef, useState } from 'react';
import { Lock, Unlock } from 'lucide-react';

const LOCK_DELAY_MS = 10000;
const DIM_DELAY_MS = 10000;
const HOLD_DURATION_MS = 1500;
const WAKE_DURATION_MS = 5000;

export default function FullscreenLock({ isFullscreen, isTracking, onExitFullscreen, children }) {
  const [isDimmed, setIsDimmed] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [holdProgress, setHoldProgress] = useState(0);
  const [hasPopup, setHasPopup] = useState(false);

  const dimTimerRef = useRef(null);
  const lockTimerRef = useRef(null);
  const holdTimerRef = useRef(null);
  const holdIntervalRef = useRef(null);
  const holdStartRef = useRef(null);
  const wakeTimerRef = useRef(null);
  const onExitRef = useRef(onExitFullscreen);
  onExitRef.current = onExitFullscreen;

  // Tap on bottom lock icon → wake screen for 5s
  const handleBottomLockTap = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDimmed(false);
    clearTimeout(dimTimerRef.current);
    clearTimeout(wakeTimerRef.current);
    wakeTimerRef.current = setTimeout(() => setIsDimmed(true), WAKE_DURATION_MS);
  };

  const shouldLock = isFullscreen && isTracking;

  const startDimTimer = () => {
    if (dimTimerRef.current) clearTimeout(dimTimerRef.current);
    setIsDimmed(false);
    dimTimerRef.current = setTimeout(() => setIsDimmed(true), DIM_DELAY_MS);
  };

  const scheduleLock = () => {
    if (lockTimerRef.current) clearTimeout(lockTimerRef.current);
    lockTimerRef.current = setTimeout(() => {
      setIsLocked(true);
      startDimTimer();
    }, LOCK_DELAY_MS);
  };

  // Watch for brightness overlay (popup) visibility
  useEffect(() => {
    const brightnessEl = document.querySelector('[style*="opacity"]');
    if (!brightnessEl) return;

    const checkBrightness = () => {
      const opacity = parseFloat(brightnessEl.style.opacity || '0');
      setHasPopup(opacity > 0);
    };

    const observer = new MutationObserver(checkBrightness);
    observer.observe(brightnessEl, { attributes: true, attributeFilter: ['style'] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (shouldLock) {
      // Lance le verrou 10s après l'activation du tracking
      scheduleLock();
    } else {
      // Tracking arrêté : annule tout et déverrouille
      clearTimeout(lockTimerRef.current);
      setIsLocked(false);
      setIsDimmed(false);
      clearTimeout(dimTimerRef.current);
    }
    return () => {
      clearTimeout(lockTimerRef.current);
      clearTimeout(dimTimerRef.current);
    };
  }, [shouldLock]);

  // Pause dimming while popup is visible
  useEffect(() => {
    if (hasPopup && !isDimmed) {
      clearTimeout(dimTimerRef.current);
    } else if (!hasPopup && !isDimmed && isLocked) {
      startDimTimer();
    }
  }, [hasPopup, isDimmed, isLocked]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearTimeout(holdTimerRef.current);
      clearInterval(holdIntervalRef.current);
      clearTimeout(dimTimerRef.current);
      clearTimeout(lockTimerRef.current);
      clearTimeout(wakeTimerRef.current);
    };
  }, []);

  const startHold = (e) => {
    e.preventDefault();
    e.stopPropagation();

    // Clear any existing hold
    clearTimeout(holdTimerRef.current);
    clearInterval(holdIntervalRef.current);

    holdStartRef.current = Date.now();
    setHoldProgress(0);

    holdIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - holdStartRef.current;
      const pct = Math.min((elapsed / HOLD_DURATION_MS) * 100, 100);
      setHoldProgress(pct);
    }, 30);

    holdTimerRef.current = setTimeout(() => {
      clearInterval(holdIntervalRef.current);
      holdIntervalRef.current = null;
      setHoldProgress(0);
      setIsLocked(false);
      setIsDimmed(false);
      clearTimeout(dimTimerRef.current);
      onExitRef.current?.();
      // Re-verrouille 10s après le déverrouillage si toujours en tracking
      scheduleLock();
    }, HOLD_DURATION_MS);
  };

  const cancelHold = (e) => {
    e?.stopPropagation();
    clearTimeout(holdTimerRef.current);
    clearInterval(holdIntervalRef.current);
    holdIntervalRef.current = null;
    setHoldProgress(0);
  };

  if (!shouldLock || !isLocked) return <>{children}</>;

  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - holdProgress / 100);

  return (
    <div className="relative w-full h-full" style={{ touchAction: 'none' }}>
      {/* Blocked content */}
      <div className="w-full h-full pointer-events-none select-none">
        {children}
      </div>

      {/* Full-screen interaction blocker — covers header and main */}
      <div className="fixed inset-0 z-[60]" style={{ touchAction: 'none' }} />

      {/* Dim overlay */}
      <div
        className="fixed inset-0 z-[65] transition-all duration-1000 pointer-events-none"
        style={{ background: isDimmed ? 'rgba(0,0,0,0.92)' : 'rgba(0,0,0,0.0)' }}
      />



      {/* Hold-to-unlock button using lock icon — on top of everything, fully interactive */}
      <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[70] flex flex-col items-center gap-3">
        <div className="relative flex items-center justify-center select-none">
          <svg
            width={72}
            height={72}
            className="absolute pointer-events-none"
            style={{ transform: 'rotate(-90deg)' }}
          >
            <circle cx={36} cy={36} r={radius} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={4} />
            <circle
              cx={36} cy={36} r={radius}
              fill="none"
              stroke="hsl(75,95%,55%)"
              strokeWidth={4}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              style={{ transition: holdProgress === 0 ? 'stroke-dashoffset 0.3s ease' : 'none' }}
            />
          </svg>

          <button
            onMouseDown={startHold}
            onMouseUp={cancelHold}
            onMouseLeave={cancelHold}
            onTouchStart={startHold}
            onTouchEnd={cancelHold}
            onTouchCancel={cancelHold}
            onClick={handleBottomLockTap}
            className="w-[72px] h-[72px] rounded-full flex items-center justify-center bg-black/60 border border-white/10 active:bg-black/80 transition-colors"
            style={{ touchAction: 'none', WebkitUserSelect: 'none', userSelect: 'none' }}
          >
            <Lock className="w-6 h-6 text-white/70" />
          </button>
        </div>
      </div>
    </div>
  );
}