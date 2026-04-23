import React, { useState, useEffect, useCallback } from 'react';
import { User, Plus, Pencil, Trash2, Check, X, Eye, EyeOff, ChevronDown, Lock, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';

async function hashPassword(pw) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pw));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Vérifie le mot de passe live depuis le cloud
export async function checkLivePassword(pseudo, pw) {
  const normalized = pseudo.toLowerCase().trim();
  const accounts = await base44.entities.Account.filter({ pseudo: normalized }, '-created_date', 1);
  const acc = accounts?.[0];
  if (!acc?.live_hash) return true; // pas de mdp live = public
  const hash = await hashPassword(pw);
  return hash === acc.live_hash;
}

// Vérifie si un pseudo a un mot de passe live (depuis le cloud)
export async function hasLivePassword(pseudo) {
  const normalized = pseudo.toLowerCase().trim();
  const accounts = await base44.entities.Account.filter({ pseudo: normalized }, '-created_date', 1);
  return !!(accounts?.[0]?.live_hash);
}

/* ── Create form ──────────────────────────────────────────────── */
function CreateForm({ onCreated, onCancel }) {
  const [pseudo, setPseudo] = useState('');
  const [pw, setPw] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [livePw, setLivePw] = useState('');
  const [showLivePw, setShowLivePw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmed = pseudo.trim();
    if (!trimmed) return;
    setLoading(true);
    const normalized = trimmed.toLowerCase();
    const existing = await base44.entities.Account.filter({ pseudo: normalized }, '-created_date', 1);
    if (existing?.length > 0) {
      setError('Ce pseudo existe déjà.');
      setLoading(false);
      return;
    }
    const hash = pw ? await hashPassword(pw) : '';
    const live_hash = livePw ? await hashPassword(livePw) : '';
    await base44.entities.Account.create({ pseudo: normalized, display_name: trimmed, hash, live_hash });
    setLoading(false);
    onCreated(trimmed);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-2 mt-2 border border-border rounded-xl p-3 bg-secondary/10">
      <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground font-mono mb-1">Nouveau compte</div>
      <div className="relative">
        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <input type="text" value={pseudo} onChange={(e) => { setPseudo(e.target.value); setError(''); }}
          placeholder="Pseudo" autoFocus
          className="w-full h-9 bg-secondary/40 border border-border rounded-lg pl-9 pr-3 font-mono text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition" />
      </div>
      <div className="relative">
        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <input type={showPw ? 'text' : 'password'} value={pw} onChange={(e) => setPw(e.target.value)}
          placeholder="Mot de passe compte (optionnel)"
          className="w-full h-9 bg-secondary/40 border border-border rounded-lg pl-9 pr-9 font-mono text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition" />
        <button type="button" onClick={() => setShowPw(v => !v)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition">
          {showPw ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
        </button>
      </div>
      <div className="relative">
        <Eye className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <input type={showLivePw ? 'text' : 'password'} value={livePw} onChange={(e) => setLivePw(e.target.value)}
          placeholder="Mot de passe live (optionnel)"
          className="w-full h-9 bg-secondary/40 border border-border rounded-lg pl-9 pr-9 font-mono text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition" />
        <button type="button" onClick={() => setShowLivePw(v => !v)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition">
          {showLivePw ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
        </button>
      </div>
      {error && <p className="text-[10px] font-mono text-destructive">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={!pseudo.trim() || loading}
          className="flex-1 h-9 rounded-lg bg-primary text-primary-foreground font-display text-xs tracking-wide hover:bg-primary/90 disabled:opacity-40 transition flex items-center justify-center gap-1.5">
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Check className="w-3.5 h-3.5" /> Créer</>}
        </button>
        <button type="button" onClick={onCancel}
          className="h-9 px-3 rounded-lg bg-secondary text-muted-foreground hover:text-foreground transition">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </form>
  );
}

/* ── Inline edit/delete panel ─────────────────────────────────── */
function AccountActionPanel({ account, mode, onClose, onDone }) {
  const [pw, setPw] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [editUnlocked, setEditUnlocked] = useState(!account.hash);
  const [newPseudo, setNewPseudo] = useState(account.display_name || account.pseudo);
  const [newPw, setNewPw] = useState('');
  const [showNewPw, setShowNewPw] = useState(false);
  const [newLivePw, setNewLivePw] = useState('');
  const [showNewLivePw, setShowNewLivePw] = useState(false);
  const [clearLivePw, setClearLivePw] = useState(false);
  const [clearPw, setClearPw] = useState(false);

  const verifyPassword = async () => {
    if (!account.hash) return true;
    const hash = await hashPassword(pw);
    return hash === account.hash;
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const ok = await verifyPassword();
    if (!ok) { setError('Mot de passe incorrect.'); setLoading(false); return; }
    if (mode === 'delete') {
      await base44.entities.Account.delete(account.id);
      onDone();
    } else {
      setEditUnlocked(true);
      setError('');
    }
    setLoading(false);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    const trimmed = newPseudo.trim();
    if (!trimmed) return;
    setLoading(true);
    const normalized = trimmed.toLowerCase();
    if (normalized !== account.pseudo) {
      const conflict = await base44.entities.Account.filter({ pseudo: normalized }, '-created_date', 1);
      if (conflict?.length > 0) { setError('Ce pseudo existe déjà.'); setLoading(false); return; }
    }
    const hash = clearPw ? '' : (newPw ? await hashPassword(newPw) : account.hash);
    const live_hash = clearLivePw ? '' : (newLivePw ? await hashPassword(newLivePw) : (account.live_hash || ''));
    await base44.entities.Account.update(account.id, { pseudo: normalized, display_name: trimmed, hash, live_hash });
    onDone(trimmed);
    setLoading(false);
  };

  // No password + delete
  if (mode === 'delete' && !account.hash) {
    return (
      <div className="px-3 pb-3 space-y-2">
        <p className="text-[10px] font-mono text-muted-foreground">Supprimer <span className="text-foreground">{account.display_name || account.pseudo}</span> ?</p>
        <div className="flex gap-2">
          <button onClick={async () => {
            setLoading(true);
            await base44.entities.Account.delete(account.id);
            onDone();
          }} disabled={loading} className="flex-1 h-8 rounded-lg bg-destructive text-destructive-foreground font-display text-xs flex items-center justify-center gap-1.5 hover:bg-destructive/90 disabled:opacity-40 transition">
            {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <><Trash2 className="w-3 h-3" /> Supprimer</>}
          </button>
          <button onClick={onClose} className="h-8 px-3 rounded-lg bg-secondary text-muted-foreground hover:text-foreground transition">
            <X className="w-3 h-3" />
          </button>
        </div>
      </div>
    );
  }

  // Password-protected: ask password first
  if ((mode === 'delete' || (mode === 'edit' && !editUnlocked)) && account.hash) {
    return (
      <form onSubmit={handlePasswordSubmit} className="px-3 pb-3 space-y-2">
        <p className="text-[10px] font-mono text-muted-foreground">
          {mode === 'delete' ? 'Mot de passe pour supprimer' : 'Mot de passe pour modifier'}
        </p>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input type={showPw ? 'text' : 'password'} value={pw} autoFocus
            onChange={(e) => { setPw(e.target.value); setError(''); }}
            placeholder="Mot de passe"
            className="w-full h-9 bg-secondary/40 border border-border rounded-lg pl-9 pr-9 font-mono text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition" />
          <button type="button" onClick={() => setShowPw(v => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition">
            {showPw ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          </button>
        </div>
        {error && <p className="text-[10px] font-mono text-destructive">{error}</p>}
        <div className="flex gap-2">
          <button type="submit" disabled={!pw || loading}
            className={`flex-1 h-8 rounded-lg font-display text-xs flex items-center justify-center gap-1.5 transition disabled:opacity-40 ${mode === 'delete' ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : 'bg-primary text-primary-foreground hover:bg-primary/90'}`}>
            {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <><Check className="w-3 h-3" /> Confirmer</>}
          </button>
          <button type="button" onClick={onClose} className="h-8 px-3 rounded-lg bg-secondary text-muted-foreground hover:text-foreground transition">
            <X className="w-3 h-3" />
          </button>
        </div>
      </form>
    );
  }

  // Edit form (unlocked)
  return (
    <form onSubmit={handleEditSubmit} className="px-3 pb-3 space-y-2">
      {/* Pseudo */}
      <div className="relative">
        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <input type="text" value={newPseudo} autoFocus
          onChange={(e) => { setNewPseudo(e.target.value); setError(''); }}
          className="w-full h-9 bg-secondary/40 border border-border rounded-lg pl-9 pr-3 font-mono text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition" />
      </div>

      {/* Mot de passe compte */}
      <div>
        <div className="text-[10px] font-mono text-muted-foreground mb-1 flex items-center gap-1.5">
          <Lock className="w-3 h-3" /> Mdp compte {account.hash ? <span className="text-primary/60">· défini</span> : <span className="text-muted-foreground/50">· aucun</span>}
          {account.hash && !clearPw && (
            <button type="button" onClick={() => { setClearPw(true); setNewPw(''); }}
              className="ml-auto text-[10px] text-destructive hover:text-destructive/80 transition">
              Supprimer
            </button>
          )}
          {clearPw && (
            <button type="button" onClick={() => setClearPw(false)}
              className="ml-auto text-[10px] text-muted-foreground hover:text-foreground transition">
              Annuler
            </button>
          )}
        </div>
        {clearPw ? (
          <p className="text-[10px] font-mono text-destructive px-1">Le mdp compte sera supprimé.</p>
        ) : (
          <div className="relative">
            <input type={showNewPw ? 'text' : 'password'} value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              placeholder={account.hash ? '·····' : 'Nouveau (optionnel)'}
              className="w-full h-9 bg-secondary/40 border border-border rounded-lg pl-3 pr-9 font-mono text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition" />
            <button type="button" onClick={() => setShowNewPw(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition">
              {showNewPw ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
          </div>
        )}
      </div>

      {/* Mot de passe live */}
      <div>
        <div className="text-[10px] font-mono text-muted-foreground mb-1 flex items-center gap-1.5">
          <Eye className="w-3 h-3" /> Mdp live {account.live_hash ? <span className="text-accent/70">· défini</span> : <span className="text-muted-foreground/50">· public</span>}
          {account.live_hash && !clearLivePw && (
            <button type="button" onClick={() => setClearLivePw(true)}
              className="ml-auto text-[10px] text-destructive hover:text-destructive/80 transition">
              Supprimer
            </button>
          )}
          {clearLivePw && (
            <button type="button" onClick={() => setClearLivePw(false)}
              className="ml-auto text-[10px] text-muted-foreground hover:text-foreground transition">
              Annuler
            </button>
          )}
        </div>
        {clearLivePw ? (
          <p className="text-[10px] font-mono text-destructive px-1">Le mdp live sera supprimé (accès public).</p>
        ) : (
          <div className="relative">
            <input type={showNewLivePw ? 'text' : 'password'} value={newLivePw}
              onChange={(e) => setNewLivePw(e.target.value)}
              placeholder={account.live_hash ? '·····' : 'Nouveau (optionnel)'}
              className="w-full h-9 bg-secondary/40 border border-border rounded-lg pl-3 pr-9 font-mono text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition" />
            <button type="button" onClick={() => setShowNewLivePw(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition">
              {showNewLivePw ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
          </div>
        )}
      </div>

      {error && <p className="text-[10px] font-mono text-destructive">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={!newPseudo.trim() || loading}
          className="flex-1 h-8 rounded-lg bg-primary text-primary-foreground font-display text-xs flex items-center justify-center gap-1.5 hover:bg-primary/90 disabled:opacity-40 transition">
          {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <><Check className="w-3 h-3" /> Enregistrer</>}
        </button>
        <button type="button" onClick={onClose} className="h-8 px-3 rounded-lg bg-secondary text-muted-foreground hover:text-foreground transition">
          <X className="w-3 h-3" />
        </button>
      </div>
    </form>
  );
}

/* ── Main AccountManager ──────────────────────────────────────── */
export default function AccountManager({ onBack }) {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [action, setAction] = useState(null);

  const refresh = useCallback(async () => {
    const data = await base44.entities.Account.list('-created_date', 100);
    setAccounts(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const handleCreated = () => { refresh(); setCreating(false); };

  const handleDone = (newPseudo) => {
    if (action?.mode === 'edit' && newPseudo) {
      const current = localStorage.getItem('pulse:pseudo');
      if (current && current.toLowerCase() === action.pseudo) localStorage.setItem('pulse:pseudo', newPseudo);
    } else if (action?.mode === 'delete') {
      const current = localStorage.getItem('pulse:pseudo');
      if (current && current.toLowerCase() === action.pseudo) localStorage.removeItem('pulse:pseudo');
    }
    refresh();
    setAction(null);
  };

  const toggleAction = (pseudo, mode) => {
    if (action?.pseudo === pseudo && action?.mode === mode) setAction(null);
    else setAction({ pseudo, mode });
  };

  return (
    <div className="p-4 max-h-[460px] overflow-y-auto">
      <button onClick={onBack} className="flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground hover:text-foreground mb-3 transition">
        <ChevronDown className="w-3 h-3 rotate-90" /> Retour
      </button>
      <div className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground font-mono mb-3">Comptes</div>

      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="w-5 h-5 text-primary animate-spin" />
        </div>
      ) : (
        <div className="space-y-1.5 mb-3">
          {accounts.length === 0 && !creating && (
            <p className="text-[11px] font-mono text-muted-foreground text-center py-2">Aucun compte. Créez-en un.</p>
          )}
          {accounts.map((acc) => {
            const isActionOpen = action?.pseudo === acc.pseudo;
            const displayName = acc.display_name || acc.pseudo;
            return (
              <div key={acc.id} className="rounded-xl border border-border bg-secondary/20 overflow-hidden">
                <div className="flex items-center gap-2 px-3 py-2">
                  <div className="w-7 h-7 rounded-lg bg-secondary flex items-center justify-center text-xs font-display font-bold shrink-0 text-muted-foreground">
                    {displayName[0]?.toUpperCase()}
                  </div>
                  <span className="font-display text-sm leading-tight flex-1 truncate">{displayName}</span>
                  {acc.hash && <Lock className="w-3 h-3 text-muted-foreground/50 shrink-0" />}
                  {acc.live_hash && <Eye className="w-3 h-3 text-accent/60 shrink-0" title="Live protégé" />}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => { setCreating(false); toggleAction(acc.pseudo, 'edit'); }}
                      className={`w-7 h-7 rounded-lg flex items-center justify-center transition ${isActionOpen && action.mode === 'edit' ? 'bg-primary/20 text-primary' : 'bg-secondary/60 text-muted-foreground hover:text-foreground'}`}
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => { setCreating(false); toggleAction(acc.pseudo, 'delete'); }}
                      className={`w-7 h-7 rounded-lg flex items-center justify-center transition ${isActionOpen && action.mode === 'delete' ? 'bg-destructive/30 text-destructive' : 'bg-destructive/10 text-destructive hover:bg-destructive/20'}`}
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {isActionOpen && (
                  <AccountActionPanel
                    account={acc}
                    mode={action.mode}
                    onClose={() => setAction(null)}
                    onDone={handleDone}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}

      {!loading && (creating ? (
        <CreateForm onCreated={handleCreated} onCancel={() => setCreating(false)} />
      ) : (
        <button onClick={() => { setAction(null); setCreating(true); }}
          className="w-full h-9 rounded-xl border border-dashed border-primary/40 text-primary/80 font-mono text-xs flex items-center justify-center gap-1.5 hover:bg-primary/5 transition">
          <Plus className="w-3.5 h-3.5" /> Nouveau compte
        </button>
      ))}
    </div>
  );
}