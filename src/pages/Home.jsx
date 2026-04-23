import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, Eye, EyeOff, Mountain, ArrowRight, ChevronDown, Search, Loader2, Radio, User, X, Settings, Lock } from 'lucide-react';
import AccountManager, { hasLivePassword, checkLivePassword } from '@/components/tracking/AccountManager';
import { base44 } from '@/api/base44Client';
import TopoBackground from '@/components/tracking/TopoBackground';
import PulseDot from '@/components/tracking/PulseDot';

/* ── Competitor modal ─────────────────────────────────────────── */
function CompetitorModal({ onClose }) {
  const [pseudo, setPseudo] = useState(() => localStorage.getItem('pulse:pseudo') || '');
  const navigate = useNavigate();
  const inputRef = useRef(null);

  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 80); }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!pseudo.trim()) return;
    localStorage.setItem('pulse:pseudo', pseudo.trim());
    navigate('/competitor');
  };

  return (
    <ModalShell onClose={onClose}>
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shrink-0">
          <Mountain className="w-5 h-5 text-primary-foreground" strokeWidth={2.2} />
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground font-mono">01 · Athlète</div>
          <h2 className="font-display text-2xl leading-tight">Ton pseudo</h2>
        </div>
      </div>

      <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
        Identifie ta session. Le public te retrouvera avec ce nom en temps réel.
      </p>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="relative">
          <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            ref={inputRef}
            type="text"
            value={pseudo}
            onChange={(e) => setPseudo(e.target.value)}
            placeholder="ex: Maxime_Trail"
            className="w-full h-13 py-3 bg-secondary/40 border border-border rounded-xl pl-11 pr-4 font-mono text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition"
          />
        </div>
        <button
          type="submit"
          disabled={!pseudo.trim()}
          className="w-full h-13 py-3 rounded-xl bg-primary text-primary-foreground font-display text-base tracking-wide hover:bg-primary/90 disabled:opacity-40 transition flex items-center justify-center gap-2 glow-primary"
        >
          ENTRER <ArrowRight className="w-4 h-4" />
        </button>
      </form>
    </ModalShell>
  );
}

/* ── Public modal ─────────────────────────────────────────────── */
function LivePasswordPrompt({ athlete, onSuccess, onCancel }) {
  const [pw, setPw] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef(null);
  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 60); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const ok = await checkLivePassword(athlete.pseudo, pw);
    if (!ok) { setError('Mot de passe incorrect.'); return; }
    onSuccess();
  };

  const displayName = athlete.display_name || athlete.pseudo;
  return (
    <div className="p-2">
      <button onClick={onCancel} className="flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground hover:text-foreground mb-3 transition">
        <ChevronDown className="w-3 h-3 rotate-90" /> Retour
      </button>
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-lg bg-accent/15 flex items-center justify-center text-sm font-display font-bold text-accent shrink-0">
          {displayName[0]?.toUpperCase()}
        </div>
        <div>
          <div className="font-display text-sm">{displayName}</div>
          <div className="text-[10px] font-mono text-muted-foreground">Live protégé</div>
        </div>
      </div>
      <form onSubmit={handleSubmit} className="space-y-2">
        <div className="relative">
          <Eye className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            ref={inputRef}
            type={showPw ? 'text' : 'password'}
            value={pw}
            onChange={(e) => { setPw(e.target.value); setError(''); }}
            placeholder="Mot de passe live"
            className="w-full h-10 bg-secondary/40 border border-border rounded-xl pl-9 pr-9 font-mono text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition"
          />
          <button type="button" onClick={() => setShowPw(v => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition">
            {showPw ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          </button>
        </div>
        {error && <p className="text-[10px] font-mono text-destructive">{error}</p>}
        <button type="submit" disabled={!pw}
          className="w-full h-10 rounded-xl bg-primary text-primary-foreground font-display text-sm tracking-wide hover:bg-primary/90 disabled:opacity-40 transition flex items-center justify-center gap-2">
          Accéder <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </form>
    </div>
  );
}

function PublicModal({ onClose }) {
  const [athletes, setAthletes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [livePasswordFor, setLivePasswordFor] = useState(null);
  // Map pseudo → live_hash from cloud accounts
  const [liveHashMap, setLiveHashMap] = useState({});
  const navigate = useNavigate();

  useEffect(() => {
    async function load() {
      try {
        const [accountData, trackData] = await Promise.all([
          base44.entities.Account.list('-created_date', 200),
          base44.entities.TrackPoint.list('-recorded_at', 500),
        ]);

        // Build last seen map from trackpoints
        const lastSeenMap = new Map();
        (trackData || []).forEach((p) => {
          if (!lastSeenMap.has(p.pseudo)) lastSeenMap.set(p.pseudo, p.recorded_at);
        });

        // Build live hash map
        const hashMap = {};
        (accountData || []).forEach(acc => { hashMap[acc.pseudo] = acc.live_hash || ''; });
        setLiveHashMap(hashMap);

        // Build athlete list from accounts, enriched with last seen
        const list = (accountData || []).map(acc => ({
          pseudo: acc.pseudo,
          display_name: acc.display_name || acc.pseudo,
          recorded_at: lastSeenMap.get(acc.pseudo) || null,
        })).sort((a, b) => {
          if (!a.recorded_at && !b.recorded_at) return 0;
          if (!a.recorded_at) return 1;
          if (!b.recorded_at) return -1;
          return new Date(b.recorded_at) - new Date(a.recorded_at);
        });
        setAthletes(list);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const filtered = athletes.filter((a) =>
    (a.display_name || a.pseudo).toLowerCase().includes(search.toLowerCase())
  );

  const isLive = (p) => p.recorded_at && Date.now() - new Date(p.recorded_at).getTime() < 30000;
  const athleteHasLivePw = (pseudo) => !!liveHashMap[pseudo.toLowerCase()];

  const goToLive = (athlete) => {
    const name = athlete.display_name || athlete.pseudo;
    localStorage.setItem('pulse:follow', name);
    localStorage.setItem('pulse:follow_pseudo', athlete.pseudo);
    navigate('/public');
  };

  const handleSelect = (athlete) => {
    if (athleteHasLivePw(athlete.pseudo)) {
      setLivePasswordFor(athlete);
    } else {
      goToLive(athlete);
    }
  };

  return (
    <ModalShell onClose={onClose}>
      {livePasswordFor ? (
        <LivePasswordPrompt
          athlete={livePasswordFor}
          onSuccess={() => goToLive(livePasswordFor)}
          onCancel={() => setLivePasswordFor(null)}
        />
      ) : (
      <>
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center shrink-0">
          <Eye className="w-5 h-5 text-foreground" strokeWidth={2.2} />
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground font-mono">02 · Public</div>
          <h2 className="font-display text-2xl leading-tight">Choisir un athlète</h2>
        </div>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher…"
          className="w-full h-11 bg-secondary/40 border border-border rounded-xl pl-10 pr-4 font-mono text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition"
        />
      </div>

      <div className="overflow-y-auto max-h-[340px] space-y-2 pr-1">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 text-primary animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm font-mono">
            {search ? 'Aucun résultat.' : 'Aucune session enregistrée.'}
          </div>
        ) : (
          filtered.map((athlete) => {
            const live = isLive(athlete);
            const displayName = athlete.display_name || athlete.pseudo;
            return (
              <motion.button
                key={athlete.pseudo}
                whileHover={{ x: 3 }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                onClick={() => handleSelect(athlete)}
                className="w-full glass rounded-xl px-4 py-3 flex items-center justify-between hover:ring-1 hover:ring-primary/40 transition group"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-sm font-display font-bold shrink-0 ${live ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'}`}>
                    {displayName[0]?.toUpperCase()}
                  </div>
                  <div className="text-left">
                    <div className="font-display text-base leading-tight flex items-center gap-1.5">
                      {displayName}
                      {athleteHasLivePw(athlete.pseudo) && <Eye className="w-3 h-3 text-accent/70" />}
                    </div>
                    <div className="text-[11px] font-mono text-muted-foreground mt-0.5 flex items-center gap-1.5">
                      {live ? (
                        <span className="flex items-center gap-1 text-primary"><PulseDot size={7} /> LIVE</span>
                      ) : (
                        <span className="flex items-center gap-1"><Radio className="w-3 h-3" /> Hors ligne</span>
                      )}
                      <span>·</span>
                      <span>{formatRelTime(athlete.recorded_at)}</span>
                    </div>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all shrink-0" />
              </motion.button>
            );
          })
        )}
      </div>
      </>
      )}
    </ModalShell>
  );
}

/* ── Modal shell ──────────────────────────────────────────────── */
function ModalShell({ children, onClose }) {
  // Close on backdrop click
  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      <motion.div
        className="relative z-10 w-full max-w-md glass rounded-3xl p-6 shadow-2xl"
        initial={{ scale: 0.93, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.93, y: 20 }}
        transition={{ type: 'spring', stiffness: 320, damping: 28 }}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-secondary/60 flex items-center justify-center text-muted-foreground hover:text-foreground transition"
        >
          <X className="w-4 h-4" />
        </button>
        {children}
      </motion.div>
    </motion.div>
  );
}

/* ── Competitor selector (account list + optional password) ───── */
function CompetitorSelector({ onBack, onEnter }) {
  const [accounts, setAccounts] = useState([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [selected, setSelected] = useState(null);
  const [pw, setPw] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const pwRef = useRef(null);

  useEffect(() => {
    base44.entities.Account.list('-created_date', 100).then(data => {
      setAccounts(data || []);
      setLoadingAccounts(false);
    });
  }, []);

  useEffect(() => {
    if (selected?.hash) setTimeout(() => pwRef.current?.focus(), 60);
  }, [selected]);

  const handleSelect = (acc) => {
    if (!acc.hash) {
      localStorage.setItem('pulse:pseudo', acc.display_name || acc.pseudo);
      onEnter(acc.display_name || acc.pseudo);
      return;
    }
    setSelected(acc);
    setPw('');
    setError('');
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pw));
    const hash = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
    if (hash !== selected.hash) { setError('Mot de passe incorrect.'); setSubmitting(false); return; }
    localStorage.setItem('pulse:pseudo', selected.display_name || selected.pseudo);
    onEnter(selected.display_name || selected.pseudo);
    setSubmitting(false);
  };

  const displayName = (acc) => acc.display_name || acc.pseudo;

  return (
    <div className="p-4">
      <button onClick={selected ? () => { setSelected(null); setError(''); } : onBack}
        className="flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground hover:text-foreground mb-3 transition">
        <ChevronDown className="w-3 h-3 rotate-90" /> Retour
      </button>

      {!selected ? (
        <>
          <div className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground font-mono mb-3">Choisir un compte</div>
          {loadingAccounts ? (
            <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 text-primary animate-spin" /></div>
          ) : accounts.length === 0 ? (
            <p className="text-[11px] font-mono text-muted-foreground text-center py-3">
              Aucun compte. Créez-en un dans <span className="text-foreground">Compte</span>.
            </p>
          ) : (
            <div className="space-y-1.5 max-h-56 overflow-y-auto pr-0.5">
              {accounts.map((acc) => (
                <button key={acc.id} onClick={() => handleSelect(acc)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-secondary/30 hover:bg-secondary/60 hover:ring-1 hover:ring-primary/30 transition text-left group">
                  <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center text-sm font-display font-bold shrink-0 group-hover:bg-primary/15 group-hover:text-primary transition">
                    {displayName(acc)[0]?.toUpperCase()}
                  </div>
                  <span className="font-display text-sm leading-tight flex-1">{displayName(acc)}</span>
                  {acc.hash && <Lock className="w-3 h-3 text-muted-foreground shrink-0" />}
                  <ArrowRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
                </button>
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center text-sm font-display font-bold text-primary shrink-0">
              {displayName(selected)[0]?.toUpperCase()}
            </div>
            <span className="font-display text-sm">{displayName(selected)}</span>
          </div>
          <form onSubmit={handlePasswordSubmit} className="space-y-2">
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input
                ref={pwRef}
                type={showPw ? 'text' : 'password'}
                value={pw}
                onChange={(e) => { setPw(e.target.value); setError(''); }}
                placeholder="Mot de passe"
                className="w-full h-10 bg-secondary/40 border border-border rounded-xl pl-9 pr-9 font-mono text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition"
              />
              <button type="button" onClick={() => setShowPw(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition">
                {showPw ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
            {error && <p className="text-[10px] font-mono text-destructive">{error}</p>}
            <button type="submit" disabled={!pw || submitting}
              className="w-full h-10 rounded-xl bg-primary text-primary-foreground font-display text-sm tracking-wide hover:bg-primary/90 disabled:opacity-40 transition flex items-center justify-center gap-2">
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <>ENTRER <ArrowRight className="w-3.5 h-3.5" /></>}
            </button>
          </form>
        </>
      )}
    </div>
  );
}

/* ── Pulse dropdown ───────────────────────────────────────────── */
function PulseDropdown({ onLive }) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(null); // null | 'competitor' | 'account'
  const navigate = useNavigate();
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) { setOpen(false); setView(null); }
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  return (
    <div className="relative" ref={dropdownRef} onClick={(e) => e.stopPropagation()}>
      <button
        onClick={() => { setOpen(v => !v); setView(null); }}
        className="flex items-center gap-1.5 hover:opacity-80 transition"
      >
        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
          <Activity className="w-4 h-4 text-primary-foreground" strokeWidth={3} />
        </div>
        <span className="font-display text-xl tracking-tight">PULSE</span>
        <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground ml-0.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            className="absolute left-0 top-full mt-2 w-72 glass rounded-2xl shadow-2xl z-50 overflow-hidden"
          >
            {view === null && (
              <div className="p-1.5">
                <button
                  onClick={() => setView('account')}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-secondary/60 transition text-left"
                >
                  <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                    <User className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div>
                    <div className="text-sm font-display leading-tight">Compte</div>
                    <div className="text-[10px] font-mono text-muted-foreground">Gérer mon profil</div>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-muted-foreground ml-auto" />
                </button>
                <button
                  onClick={() => setView('competitor')}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-secondary/60 transition text-left"
                >
                  <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
                    <Mountain className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <div className="text-sm font-display leading-tight">Compétiteur</div>
                    <div className="text-[10px] font-mono text-muted-foreground">Lancer le tracking</div>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-muted-foreground ml-auto" />
                </button>
                <button
                  onClick={() => { setOpen(false); setView(null); onLive?.(); }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-secondary/60 transition text-left"
                >
                  <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                    <Eye className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div>
                    <div className="text-sm font-display leading-tight">Live</div>
                    <div className="text-[10px] font-mono text-muted-foreground">Suivre un athlète</div>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-muted-foreground ml-auto" />
                </button>
              </div>
            )}

            {view === 'account' && (
              <AccountManager onBack={() => setView(null)} />
            )}

            {view === 'competitor' && (
              <CompetitorSelector
                onBack={() => setView(null)}
                onEnter={(p) => { setOpen(false); setView(null); navigate('/competitor'); }}
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Page ─────────────────────────────────────────────────────── */
export default function Home() {
  const [showPublic, setShowPublic] = useState(false);

  return (
    <div className="min-h-screen bg-background relative grain overflow-hidden">
      <TopoBackground />

      {/* Header */}
      <header className="relative z-20 px-6 md:px-12 pt-8 flex items-center justify-between">
        <PulseDropdown onLive={() => setShowPublic(true)} />
        <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
          <PulseDot size={8} />
          <span className="uppercase tracking-[0.2em]">Live · 2026</span>
        </div>
      </header>

      {/* Full-screen Live zone */}
      <section className="relative z-10 flex flex-col items-center justify-center min-h-[calc(100vh-80px)] px-6 md:px-12">
        <motion.button
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          whileHover={{ scale: 1.02 }}
          onClick={() => setShowPublic(true)}
          className="group relative w-full max-w-5xl h-[65vh] rounded-3xl overflow-hidden flex flex-col items-center justify-center gap-6 cursor-pointer border border-white/10 hover:border-primary/40 transition-all duration-300"
          style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 100%)' }}
        >
          {/* Corner accents */}
          <span className="absolute top-0 left-0 w-12 h-12 border-t-2 border-l-2 border-primary/40 rounded-tl-3xl" />
          <span className="absolute top-0 right-0 w-12 h-12 border-t-2 border-r-2 border-primary/40 rounded-tr-3xl" />
          <span className="absolute bottom-0 left-0 w-12 h-12 border-b-2 border-l-2 border-primary/40 rounded-bl-3xl" />
          <span className="absolute bottom-0 right-0 w-12 h-12 border-b-2 border-r-2 border-primary/40 rounded-br-3xl" />

          {/* Glow on hover */}
          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
            style={{ background: 'radial-gradient(ellipse at center, hsl(75 95% 55% / 0.06) 0%, transparent 70%)' }} />

          <div className="w-20 h-20 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center group-hover:border-primary/40 group-hover:bg-primary/10 transition-all duration-300">
            <Eye className="w-10 h-10 text-white/50 group-hover:text-primary transition-colors duration-300" strokeWidth={1.5} />
          </div>

          <div className="text-center">
            <div className="text-[11px] uppercase tracking-[0.4em] text-muted-foreground font-mono mb-3 flex items-center justify-center gap-2">
              <PulseDot size={8} /> Live · Spectateur
            </div>
            <h2 className="font-display text-5xl md:text-7xl leading-none text-foreground">Espace Live</h2>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground group-hover:text-primary transition-colors duration-300">
            <span>Suivre un athlète</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
          </div>
        </motion.button>
      </section>

      {/* Public modal */}
      <AnimatePresence>
        {showPublic && <PublicModal onClose={() => setShowPublic(false)} />}
      </AnimatePresence>
    </div>
  );
}

function formatRelTime(dateStr) {
  if (!dateStr) return 'Jamais connecté';
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return `il y a ${diff}s`;
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)}min`;
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)}h`;
  return `il y a ${Math.floor(diff / 86400)}j`;
}