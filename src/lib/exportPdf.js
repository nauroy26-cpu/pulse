import jsPDF from 'jspdf';
import { formatDistance, formatDuration, totalDistance, msToKmh } from '@/lib/trackingUtils';

export function exportTrackPDF({ displayName, points }) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();

  // Header band
  doc.setFillColor(17, 17, 17);
  doc.rect(0, 0, W, 32, 'F');
  doc.setFillColor(198, 255, 61);
  doc.rect(0, 32, W, 1.2, 'F');

  doc.setTextColor(198, 255, 61);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.text('PULSE', 15, 20);

  doc.setTextColor(200, 200, 200);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('Live Sport Tracking — Rapport de session', 42, 20);

  doc.setTextColor(30, 30, 30);

  // Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text(`Session — ${displayName || 'Anonyme'}`, 15, 50);

  // Stats
  const dist = totalDistance(points);
  const first = points[0];
  const last = points[points.length - 1];
  const duration = first && last ? new Date(last.recorded_at) - new Date(first.recorded_at) : 0;
  const avgSpeed = duration > 0 ? (dist / (duration / 1000)) * 3.6 : 0;
  const maxSpeed = points.reduce((m, p) => Math.max(m, msToKmh(p.speed || 0)), 0);

  const stats = [
    ['Points enregistrés', String(points.length)],
    ['Distance', formatDistance(dist)],
    ['Durée', formatDuration(duration)],
    ['Vitesse moyenne', `${avgSpeed.toFixed(1)} km/h`],
    ['Vitesse max', `${maxSpeed.toFixed(1)} km/h`],
    ['Début', first ? new Date(first.recorded_at).toLocaleString('fr-FR') : '—'],
    ['Fin', last ? new Date(last.recorded_at).toLocaleString('fr-FR') : '—'],
  ];

  doc.setFontSize(10);
  let y = 62;
  stats.forEach(([k, v]) => {
    doc.setTextColor(120, 120, 120);
    doc.setFont('helvetica', 'normal');
    doc.text(k.toUpperCase(), 15, y);
    doc.setTextColor(20, 20, 20);
    doc.setFont('helvetica', 'bold');
    doc.text(v, 90, y);
    y += 7;
  });

  // Mini track chart
  if (points.length >= 2) {
    const chartX = 15, chartY = y + 10, chartW = W - 30, chartH = 70;
    doc.setDrawColor(230, 230, 230);
    doc.setFillColor(250, 250, 250);
    doc.roundedRect(chartX, chartY, chartW, chartH, 2, 2, 'FD');

    const lats = points.map(p => p.lat), lngs = points.map(p => p.lng);
    const minLat = Math.min(...lats), maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
    const spanLat = Math.max(maxLat - minLat, 0.0001);
    const spanLng = Math.max(maxLng - minLng, 0.0001);
    const pad = 6;

    doc.setDrawColor(198, 255, 61);
    doc.setLineWidth(1.2);
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1], b = points[i];
      const ax = chartX + pad + ((a.lng - minLng) / spanLng) * (chartW - 2 * pad);
      const ay = chartY + chartH - pad - ((a.lat - minLat) / spanLat) * (chartH - 2 * pad);
      const bx = chartX + pad + ((b.lng - minLng) / spanLng) * (chartW - 2 * pad);
      const by = chartY + chartH - pad - ((b.lat - minLat) / spanLat) * (chartH - 2 * pad);
      doc.line(ax, ay, bx, by);
    }

    doc.setFontSize(8);
    doc.setTextColor(130, 130, 130);
    doc.setFont('helvetica', 'normal');
    doc.text('Tracé GPS (projection équirectangulaire)', chartX + 2, chartY + chartH + 5);
    y = chartY + chartH + 12;
  }

  // Points table (first 30)
  if (points.length > 0) {
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(20, 20, 20);
    doc.text('Points enregistrés', 15, y + 6);
    y += 12;

    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(120, 120, 120);
    doc.text('HORODATAGE', 15, y);
    doc.text('LAT', 75, y);
    doc.text('LNG', 110, y);
    doc.text('VIT (km/h)', 150, y);
    y += 2;
    doc.setDrawColor(230, 230, 230);
    doc.line(15, y, W - 15, y);
    y += 4;

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 30, 30);
    const limit = Math.min(points.length, 35);
    for (let i = 0; i < limit; i++) {
      const p = points[i];
      if (y > H - 20) {
        doc.addPage();
        y = 20;
      }
      doc.text(new Date(p.recorded_at).toLocaleString('fr-FR'), 15, y);
      doc.text(p.lat.toFixed(5), 75, y);
      doc.text(p.lng.toFixed(5), 110, y);
      doc.text(msToKmh(p.speed || 0).toFixed(1), 150, y);
      y += 5;
    }
    if (points.length > limit) {
      doc.setTextColor(130, 130, 130);
      doc.text(`… et ${points.length - limit} autres points`, 15, y + 3);
    }
  }

  // Footer
  doc.setTextColor(150, 150, 150);
  doc.setFontSize(8);
  doc.text(`Généré le ${new Date().toLocaleString('fr-FR')}`, 15, H - 10);
  doc.text('PULSE · pulse-tracking', W - 15, H - 10, { align: 'right' });

  const safeName = (displayName || 'session').replace(/[^a-z0-9_-]/gi, '_');
  doc.save(`pulse-${safeName}-${Date.now()}.pdf`);
}