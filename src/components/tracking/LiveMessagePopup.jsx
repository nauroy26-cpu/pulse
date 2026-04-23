import React, { useEffect, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { normalizePseudo } from '@/lib/trackingUtils';
import { AnimatePresence, motion } from 'framer-motion';
import { MessageCircle } from 'lucide-react';

const DISPLAY_MS = 10000;
const POLL_MS = 5000;

export default function LiveMessagePopup({ pseudo }) {
  const [popup, setPopup] = useState(null); // { id, message }
  const timerRef = useRef(null);
  const brightnessRef = useRef(null);

  const dismiss = () => {
    setPopup(null);
    // Restore low brightness
    if (brightnessRef.current) {
      brightnessRef.current.style.opacity = '0';
    }
    clearTimeout(timerRef.current);
  };

  useEffect(() => {
    const normalized = normalizePseudo(pseudo);
    if (!normalized) return;

    const showMessage = async (msg) => {
      // Mark as read immediately
      await base44.entities.LiveMessage.update(msg.id, { read_at: new Date().toISOString() });

      // Sound — bip bip
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        [0, 180].forEach((delay) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.frequency.value = 880;
          osc.type = 'sine';
          gain.gain.setValueAtTime(0.4, ctx.currentTime + delay / 1000);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay / 1000 + 0.15);
          osc.start(ctx.currentTime + delay / 1000);
          osc.stop(ctx.currentTime + delay / 1000 + 0.15);
        });
      } catch (_) {}

      // Show popup
      setPopup({ id: msg.id, message: msg.message });

      // Max brightness
      if (brightnessRef.current) {
        brightnessRef.current.style.opacity = '1';
      }

      // Try screen brightness via Wake Lock (keeps screen on + bright)
      try {
        if ('wakeLock' in navigator) {
          await navigator.wakeLock.request('screen');
        }
      } catch (_) {}

      // Auto-dismiss after DISPLAY_MS
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(dismiss, DISPLAY_MS);
    };

    // Subscribe to new messages
    const unsubscribe = base44.entities.LiveMessage.subscribe((event) => {
      if (event.type === 'create' && event.data.pseudo === normalized && !event.data.read_at) {
        showMessage(event.data);
      }
    });

    return () => {
      unsubscribe();
      clearTimeout(timerRef.current);
    };
  }, [pseudo]);

  return (
    <>
      {/* Brightness overlay — white flash at high opacity when message arrives */}
      <div
        ref={brightnessRef}
        className="fixed inset-0 z-[90] pointer-events-none transition-opacity duration-500"
        style={{ background: 'rgba(255,255,255,0.18)', opacity: 0 }}
      />

      <AnimatePresence>
        {popup && (
          <motion.div
            className="fixed top-0 left-0 right-0 z-[100] md:left-auto md:top-20 md:w-[calc(var(--left-panel-width,50vw))] p-4 md:p-8"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            onClick={dismiss}
          >
            <motion.div
              className="w-full"
              initial={{ scale: 0.85 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.85 }}
              transition={{ type: 'spring', stiffness: 260, damping: 22 }}
            >
              {/* Icon */}
              <div className="flex justify-center mb-4">
                <div className="w-14 h-14 rounded-xl bg-primary flex items-center justify-center glow-primary">
                  <MessageCircle className="w-7 h-7 text-primary-foreground" />
                </div>
              </div>

              {/* Message */}
              <div className="glass rounded-2xl px-6 py-6 text-center shadow-2xl border border-primary/30">
                <div className="text-[10px] uppercase tracking-[0.3em] font-mono text-primary mb-3">
                  Message live
                </div>
                <p className="font-display text-2xl leading-tight text-foreground break-words whitespace-pre-wrap">
                  {popup.message}
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}