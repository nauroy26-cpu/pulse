import { useEffect } from 'react';

const PROMPT = `PULSE — Application de tracking GPS live pour compétitions sportives

Crée une application React appelée PULSE avec un design dark sport moderne (fond très sombre #0f0f0f, accent vert lime hsl(75,95%,55%), accent orange hsl(18,85%,55%), typographies Archivo Black + Space Grotesk + JetBrains Mono). Utilise Tailwind CSS, Framer Motion, react-leaflet pour la carte, et lucide-react pour les icônes.

---

ENTITÉS (base de données)

- Account : pseudo (normalisé minuscules), display_name, hash (SHA-256 mot de passe compte), live_hash (SHA-256 mot de passe live)
- TrackPoint : pseudo, display_name, lat, lng, altitude, speed, accuracy, heading, recorded_at (datetime), session_id
- Session : pseudo, display_name, session_id, label, started_at, ended_at, point_count, distance_km
- ReferenceTrace : pseudo, points (array d'objets {lat,lng,altitude,recorded_at}), label
- LiveMessage : pseudo, message, read_at (datetime nullable)

---

PAGES

1. Home (/)
- Header avec logo PULSE (icône Activity) + dropdown avec 3 options : Compte, Compétiteur, Live
- Grande zone cliquable centrale "Espace Live" avec icône Eye, animation hover
- Modale "Compétiteur" : liste les comptes existants, sélection → si compte protégé demande mot de passe (hash SHA-256 vérifié côté client), stocke le pseudo dans localStorage
- Modale "Live / Public" : liste les athlètes (depuis Account), indicateur LIVE si un TrackPoint a été enregistré il y a moins de 30s, si live_hash défini demande mot de passe avant accès
- Dropdown "Compte" : AccountManager inline — liste, création, édition, suppression des comptes avec gestion des 2 mots de passe (compte + live), hash SHA-256 côté client

2. Competitor (/competitor)
- Accessible uniquement si localStorage.pulse:pseudo défini
- Interface fullscreen avec auto-lock (FullscreenLock component — overlay qui se verrouille automatiquement, hold-to-unlock)
- Wake lock pour garder l'écran allumé
- Header : pseudo, statut Live/Paused/Hors ligne, indicateur offline/sync
- Grille 2x2 de stats : Distance (km), Durée (HH:MM:SS), Vitesse instantanée (km/h), Vitesse moyenne (km/h)
- Boutons : START / PAUSE / RESUME / STOP / CLEAR / LOAD / GPX
- Carte react-leaflet plein écran droite (trace live en vert lime, trace chargée en bleu)
- Bouton LOAD : ouvre SessionLoadModal — import GPX local ou charger une session sauvegardée
- Bouton GPX : ouvre SessionExportModal — liste sessions, export GPX ou suppression
- LiveMessagePopup : poll toutes les 5s les LiveMessage non lus pour ce pseudo, affiche popup plein écran avec animation si message reçu, marque comme lu

3. Public (/public)
- Lit localStorage.pulse:follow_pseudo pour savoir qui suivre
- Wake lock + fullscreen automatique
- Header : nom athlète, badge LIVE ou Hors ligne
- Grille 2x2 de stats identique (calculée depuis les points)
- Carte avec la trace live (vert) + trace de référence (bleu)
- Bouton "Message" (SendMessageButton) pour envoyer un LiveMessage à l'athlète — uniquement si live
- Statut card : "Enregistrement actif" / "Dernière position connue" / "Aucun signal"
- Affiche toujours les derniers points connus même si l'athlète est hors ligne

---

HOOKS CUSTOM

useCompetitorTracking
- GPS via getCurrentPosition toutes les 15 secondes (pas watchPosition — économie batterie)
- Filtre les points GPS erratiques (si déplacement > 80km/h depuis dernier point → skip)
- Queue offline : stocke en localStorage si pas de réseau, flush automatique à la reconnexion
- Wake lock, visibilitychange handler pour reprendre le GPS si l'app revient au premier plan
- À l'arrêt (STOP) : sauvegarde une entité Session avec métadonnées

usePublicTracking
- Chargement initial complet de la session en cours (tous les TrackPoints de la session active)
- Polling incrémental toutes les 10 secondes : ne fetche que les nouveaux points depuis le dernier timestamp connu (évite de recharger toute la trace)
- Si la session change → rechargement complet automatique
- Persist les points en mémoire même si l'athlète passe hors ligne
- Charge aussi la ReferenceTrace associée au pseudo

---

COMPOSANTS

- TrackingMap : MapContainer leaflet, fond CartoCDN Voyager dark, polyline verte pour trace live, polyline bleue pour trace chargée/référence, marqueur orange au départ, marqueur vert animé à la position actuelle, AutoFit (fitBounds au premier chargement, pan vers dernier point ensuite)
- PulseDot : point animé avec ring pulsant (couleur configurable)
- TopoBackground : SVG décoratif de courbes de niveau + blobs de lumière
- FullscreenLock : overlay qui se verrouille après 10s d'inactivité en tracking, fond semi-transparent, indicateur "maintenir pour déverrouiller" avec progress circulaire
- AccountManager : CRUD complet des comptes dans le dropdown
- LiveMessagePopup : poll, affichage popup, brightness overlay, wake lock
- SendMessageButton : bouton + modale d'envoi de message avec textarea (Shift+Enter pour saut de ligne, envoi sur bouton uniquement)
- SessionExportModal : liste sessions, export GPX, suppression
- SessionLoadModal : import GPX (parse XML), chargement session existante

---

UTILITAIRES

- trackingUtils.js : haversine distance, totalDistance(points), formatDistance, formatDuration, msToKmh, normalizePseudo
- exportGpx.js : génère et télécharge un fichier GPX depuis un array de points
- useOfflineQueue.js : queue localStorage + flush réseau automatique

---

DESIGN

- Fond hsl(0,0%,6%), cartes glass rgba(20,20,20,0.55) avec backdrop-blur
- Font display : Archivo Black (titres), Space Grotesk (corps), JetBrains Mono (données/chiffres)
- Composants .glass : background: rgba(20,20,20,0.55); backdrop-filter: blur(20px)
- Animations Framer Motion sur toutes les modales et transitions
- Responsive mobile-first, safe areas respectées
`;

export default function DownloadPrompt() {
  useEffect(() => {
    const blob = new Blob([PROMPT], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'PULSE_prompt.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    // Go back after download
    window.history.back();
  }, []);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <p className="font-mono text-muted-foreground text-sm">Téléchargement en cours…</p>
    </div>
  );
}