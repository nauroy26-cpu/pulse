// Haversine distance in meters
export function haversine(a, b) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function totalDistance(points) {
  if (!points || points.length < 2) return 0;
  let d = 0;
  for (let i = 1; i < points.length; i++) {
    d += haversine(points[i - 1], points[i]);
  }
  return d;
}

export function formatDuration(ms) {
  if (!ms || ms < 0) ms = 0;
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(h)}:${pad(m)}:${pad(sec)}`;
}

export function formatDistance(m) {
  if (!m) return "0.00 km";
  return `${(m / 1000).toFixed(2)} km`;
}

export function msToKmh(speed) {
  if (!speed || speed < 0) return 0;
  return speed * 3.6;
}

export function normalizePseudo(p) {
  return (p || "").trim().toLowerCase();
}

// Filtre les points GPS aberrants :
// - accuracy trop élevée (signal faible)
// - vitesse instantanée impossible entre deux points (> maxSpeedKmh)
export function filterGpsPoints(points, { maxAccuracy = 50, maxSpeedKmh = 200 } = {}) {
  if (!points || points.length === 0) return points;
  const filtered = [];
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    // Filtre précision GPS
    if (p.accuracy != null && p.accuracy > maxAccuracy) continue;
    // Filtre vitesse impossible par rapport au point précédent accepté
    if (filtered.length > 0) {
      const prev = filtered[filtered.length - 1];
      const dt = (new Date(p.recorded_at) - new Date(prev.recorded_at)) / 1000; // secondes
      if (dt > 0) {
        const dist = haversine(prev, p);
        const speedKmh = (dist / dt) * 3.6;
        if (speedKmh > maxSpeedKmh) continue;
      }
    }
    filtered.push(p);
  }
  return filtered;
}