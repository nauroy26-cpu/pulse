import React, { useEffect, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { normalizePseudo } from '@/lib/trackingUtils';
import { X, FolderOpen, Loader2, Route, Upload } from 'lucide-react';

function parseGPX(text) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(text, 'application/xml');
  const trkpts = doc.querySelectorAll('trkpt');
  const points = [];
  trkpts.forEach((pt) => {
    const lat = parseFloat(pt.getAttribute('lat'));
    const lng = parseFloat(pt.getAttribute('lon'));
    const timeEl = pt.querySelector('time');
    const eleEl = pt.querySelector('ele');
    if (isNaN(lat) || isNaN(lng)) return;
    points.push({
      lat,
      lng,
      altitude: eleEl ? parseFloat(eleEl.textContent) : undefined,
      recorded_at: timeEl ? timeEl.textContent : new Date().toISOString(),
      _loaded: true,
    });
  });
  return points;
}

export default function SessionLoadModal({ pseudo, onLoad, onClose }) {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingId, setLoadingId] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    const normalized = normalizePseudo(pseudo);
    if (!normalized) { setLoading(false); return; }
    base44.entities.Session.filter({ pseudo: normalized }, '-started_at', 100)
      .then((data) => setSessions(data || []))
      .finally(() => setLoading(false));
  }, [pseudo]);

  const handleLoad = async (session) => {
    setLoadingId(session.id);
    const points = await base44.entities.TrackPoint.filter(
      { pseudo: session.pseudo, session_id: session.session_id },
      'recorded_at',
      5000
    );
    onLoad((points || []).map(p => ({ ...p, _loaded: true })));
    onClose();
  };

  const handleFileImport = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const points = parseGPX(ev.target.result);
      if (points.length === 0) return;
      onLoad(points);
      onClose();
    };
    reader.readAsText(file);
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
            <FolderOpen className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground font-mono">Charger</div>
            <h2 className="font-display text-xl leading-tight">Choisir une trace</h2>
          </div>
        </div>

        {/* Import GPX from disk */}
        <button
          onClick={() => fileInputRef.current?.click()}
          className="w-full mb-4 h-11 rounded-xl border border-dashed border-blue-500/50 bg-blue-500/10 text-blue-400 text-sm font-display flex items-center justify-center gap-2 hover:bg-blue-500/20 transition"
        >
          <Upload className="w-4 h-4" /> Importer un fichier GPX
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".gpx,application/gpx+xml"
          className="hidden"
          onChange={handleFileImport}
        />

        {/* Separator */}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 h-px bg-border" />
          <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">Sessions enregistrées</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-1">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-5 h-5 text-primary animate-spin" />
            </div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-6 text-sm font-mono text-muted-foreground">
              Aucune session enregistrée
            </div>
          ) : (
            sessions.map((s) => (
              <button
                key={s.id}
                onClick={() => handleLoad(s)}
                disabled={!!loadingId}
                className="w-full glass rounded-xl px-4 py-3 flex items-center justify-between gap-3 hover:ring-1 hover:ring-primary/40 transition disabled:opacity-50 text-left"
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
                {loadingId === s.id && <Loader2 className="w-4 h-4 animate-spin text-primary shrink-0" />}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}