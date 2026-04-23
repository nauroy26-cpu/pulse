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

    const poll = async () => {
      const msgs = await base44.entities.LiveMessage.filter(
        { pseudo: normalized },
        'created_date',
        10
      );
      // Find first unread message
      const unread = (msgs || []).find(m => !m.read_at);
      if (!unread) return;

      // Mark as read immediately
      await base44.entities.LiveMessage.update(unread.id, { read_at: new Date().toISOString() });

      // Show popup
      setPopup({ id: unread.id, message: unread.message });

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

    const interval = setInterval(poll, POLL_MS);
    return () => {
      clearInterval(interval);
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
            className="fixed inset-0 z-[100] flex items-center justify-center p-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={dismiss}
          >
            {/* Semi-transparent backdrop — still shows map/UI behind */}
            <div className="absolute inset-0 bg-black/75 backdrop-blur-md" />

            <motion.div
              className="relative z-10 w-full max-w-lg"
              initial={{ scale: 0.85, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.85, y: 20 }}
              transition={{ type: 'spring', stiffness: 260, damping: 22 }}
            >
              {/* Icon */}
              <div className="flex justify-center mb-6">
                <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center glow-primary">
                  <MessageCircle className="w-8 h-8 text-primary-foreground" />
                </div>
              </div>

              {/* Message */}
              <div className="glass rounded-3xl px-8 py-8 text-center shadow-2xl border border-primary/30">
                <div className="text-[11px] uppercase tracking-[0.35em] font-mono text-primary mb-4">
                  Message live
                </div>
                <p className="font-display text-3xl md:text-4xl leading-tight text-foreground break-words whitespace-pre-wrap">
                  {popup.message}
                </p>
              </div>

              <p className="text-center text-[11px] font-mono text-muted-foreground mt-5 uppercase tracking-widest">
                Toucher pour fermer
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}