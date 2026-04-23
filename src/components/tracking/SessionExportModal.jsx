import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { normalizePseudo } from '@/lib/trackingUtils';
import { exportTrackGPX } from '@/lib/exportGpx';
import { X, FileDown, Loader2, Route, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

export default function SessionExportModal({ pseudo, onClose }) {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exportingId, setExportingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    const normalized = normalizePseudo(pseudo);
    if (!normalized) { setLoading(false); return; }
    base44.entities.Session.filter({ pseudo: normalized }, '-started_at', 100)
      .then((data) => setSessions(data || []))
      .finally(() => setLoading(false));
  }, [pseudo]);

  const handleDelete = async (session) => {
    setDeletingId(session.id);
    try {
      // Delete all TrackPoints for this session
      const points = await base44.entities.TrackPoint.filter(
        { pseudo: session.pseudo, session_id: session.session_id },
        'recorded_at',
        5000
      );
      const chunkSize = 10;
      for (let i = 0; i < (points || []).length; i += chunkSize) {
        await Promise.all(points.slice(i, i + chunkSize).map(p => base44.entities.TrackPoint.delete(p.id)));
      }
      await base44.entities.Session.delete(session.id);
      setSessions(prev => prev.filter(s => s.id !== session.id));
      toast.success('Session supprimée');
    } finally {
      setDeletingId(null);
    }
  };

  const handleExport = async (session) => {
    setExportingId(session.id);
    try {
      const points = await base44.entities.TrackPoint.filter(
        { pseudo: session.pseudo, session_id: session.session_id },
        'recorded_at',
        5000
      );
      if (!points || points.length === 0) { toast.error('Aucun point GPS pour cette session'); return; }
      exportTrackGPX({ displayName: session.label, points });
      toast.success('GPX exporté');
    } finally {
      setExportingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md glass rounded-3xl p-6 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-secondary/60 flex items-center justify-center text-muted-foreground hover:text-foreground transition"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center shrink-0">
            <FileDown className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground font-mono">Export GPX</div>
            <h2 className="font-display text-xl leading-tight">Choisir une trace</h2>
          </div>
        </div>

        <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-5 h-5 text-primary animate-spin" />
            </div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-10 text-sm font-mono text-muted-foreground">
              Aucune session enregistrée
            </div>
          ) : (
            sessions.map((s) => (
              <div
                key={s.id}
                className="glass rounded-xl px-4 py-3 flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Route className="w-4 h-4 text-primary shrink-0" />
                  <div className="min-w-0">
                    <div className="font-display text-sm truncate">{s.label}</div>
                    <div className="text-[10px] font-mono text-muted-foreground mt-0.5">
                      {s.point_count ?? '?'} pts · {s.distance_km ?? '?'} km
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => handleExport(s)}
                    disabled={exportingId === s.id || deletingId === s.id}
                    className="h-9 px-3 rounded-lg bg-primary/10 text-primary border border-primary/20 text-xs font-display flex items-center gap-1.5 hover:bg-primary/20 transition disabled:opacity-50"
                  >
                    {exportingId === s.id
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      : <FileDown className="w-3.5 h-3.5" />}
                    GPX
                  </button>
                  <button
                    onClick={() => handleDelete(s)}
                    disabled={deletingId === s.id || exportingId === s.id}
                    className="h-9 w-9 rounded-lg bg-destructive/10 text-destructive border border-destructive/20 flex items-center justify-center hover:bg-destructive/20 transition disabled:opacity-50"
                  >
                    {deletingId === s.id
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      : <Trash2 className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}