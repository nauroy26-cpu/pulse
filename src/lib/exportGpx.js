export function exportTrackGPX({ displayName, points }) {
  const name = displayName || 'Session';
  const safeName = name.replace(/[^a-z0-9_-]/gi, '_');

  const trkpts = points.map((p) => {
    const ele = p.altitude != null ? `\n        <ele>${p.altitude.toFixed(1)}</ele>` : '';
    const speed = p.speed != null ? `\n        <extensions><speed>${p.speed.toFixed(3)}</speed></extensions>` : '';
    return `    <trkpt lat="${p.lat}" lon="${p.lng}">
        <time>${new Date(p.recorded_at).toISOString()}</time>${ele}${speed}
    </trkpt>`;
  }).join('\n');

  const gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="PULSE Live Sport Tracking"
  xmlns="http://www.topografix.com/GPX/1/1"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">
  <metadata>
    <name>${name}</name>
    <time>${new Date().toISOString()}</time>
  </metadata>
  <trk>
    <name>${name}</name>
    <trkseg>
${trkpts}
    </trkseg>
  </trk>
</gpx>`;

  const blob = new Blob([gpx], { type: 'application/gpx+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `pulse-${safeName}-${Date.now()}.gpx`;
  a.click();
  URL.revokeObjectURL(url);
}