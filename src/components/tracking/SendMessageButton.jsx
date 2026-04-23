import React, { useState } from 'react';
import { MessageCircle, Send, X, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { normalizePseudo } from '@/lib/trackingUtils';
import { AnimatePresence, motion } from 'framer-motion';

export default function SendMessageButton({ pseudo }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!message.trim()) return;
    setLoading(true);
    await base44.entities.LiveMessage.create({
      pseudo: normalizePseudo(pseudo),
      message: message.trim(),
    });
    setLoading(false);
    setSent(true);
    setMessage('');
    setTimeout(() => { setSent(false); setOpen(false); }, 1500);
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-secondary/60 hover:bg-secondary transition text-xs font-mono text-muted-foreground hover:text-foreground border border-border"
      >
        <MessageCircle className="w-3.5 h-3.5" />
        Message
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-[200] flex items-start justify-center pt-20 px-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
            <motion.div
              className="relative z-10 w-full max-w-sm glass rounded-2xl p-5 shadow-2xl"
              initial={{ y: 30, scale: 0.95 }}
              animate={{ y: 0, scale: 1 }}
              exit={{ y: 30, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 300, damping: 28 }}
            >
              <button onClick={() => setOpen(false)}
                className="absolute top-3 right-3 w-7 h-7 rounded-full bg-secondary/60 flex items-center justify-center text-muted-foreground hover:text-foreground transition">
                <X className="w-3.5 h-3.5" />
              </button>
              <div className="text-[10px] uppercase tracking-[0.3em] font-mono text-muted-foreground mb-1">Message live</div>
              <div className="font-display text-base mb-3">Envoyer à <span className="text-primary">{pseudo}</span></div>

              {sent ? (
                <div className="flex items-center justify-center gap-2 py-4 text-primary font-mono text-sm">
                  ✓ Message envoyé !
                </div>
              ) : (
                <form onSubmit={handleSend} onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }} className="space-y-3">
                  <div className="relative">
                    <textarea
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) e.stopPropagation(); }}
                      placeholder="Écris ton message…"
                      autoFocus
                      rows={3}
                      maxLength={120}
                      style={{ color: '#fff', background: 'rgba(255,255,255,0.08)' }}
                      className="w-full border border-border rounded-xl px-4 py-3 pr-12 font-sans text-base placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition resize-none"
                    />
                    <button
                      type="submit"
                      disabled={!message.trim() || loading}
                      className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-lg bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 disabled:opacity-40 transition"
                    >
                      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    </button>
                  </div>
                  <span className="text-[10px] font-mono text-muted-foreground">{message.length}/120</span>
                </form>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}