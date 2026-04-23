import React, { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Polyline, CircleMarker, useMap } from 'react-leaflet';
import L from 'leaflet';



function AutoFit({ points, loadedPoints, follow, fitKey }) {
  const map = useMap();
  const firstFit = useRef(false);
  const prevFitKey = useRef(null);

  const allPoints = [...points, ...loadedPoints];

  // Re-fit quand fitKey change (nouvelle trace chargée)
  useEffect(() => {
    if (fitKey !== null && fitKey !== prevFitKey.current) {
      prevFitKey.current = fitKey;
      if (allPoints.length === 0) return;
      if (allPoints.length === 1) {
        map.setView([allPoints[0].lat, allPoints[0].lng], 15);
      } else {
        const bounds = L.latLngBounds(allPoints.map(p => [p.lat, p.lng]));
        map.fitBounds(bounds, { padding: [40, 40] });
      }
      firstFit.current = true;
      return;
    }

    if (allPoints.length === 0) return;

    if (!firstFit.current) {
      if (allPoints.length === 1) {
        map.setView([allPoints[0].lat, allPoints[0].lng], 15);
      } else {
        const bounds = L.latLngBounds(allPoints.map(p => [p.lat, p.lng]));
        map.fitBounds(bounds, { padding: [40, 40] });
      }
      firstFit.current = true;
    } else if (follow && points.length > 0) {
      const last = points[points.length - 1];
      map.panTo([last.lat, last.lng], { animate: true, duration: 0.8 });
    }
  }, [points, loadedPoints, follow, fitKey, map]);

  return null;
}

export default function TrackingMap({ points = [], follow = true, center = [46.5, 2.5], zoom = 5, loadedPoints: loadedPointsProp = [], fitKey = null }) {
  // Separate live points from loaded/imported points
  const livePoints = points.filter(p => !p._loaded);
  const loadedPoints = [...points.filter(p => p._loaded), ...loadedPointsProp];

  const liveLatLngs = livePoints.map(p => [p.lat, p.lng]);
  const loadedLatLngs = loadedPoints.map(p => [p.lat, p.lng]);

  const lastLive = livePoints[livePoints.length - 1];

  // Center initial sur dernier point live ou premier point chargé (pas de persist zoom/position)
  const mapCenter = lastLive
    ? [lastLive.lat, lastLive.lng]
    : loadedPoints[0]
    ? [loadedPoints[0].lat, loadedPoints[0].lng]
    : center;

  return (
    <div className="relative w-full h-full rounded-2xl overflow-hidden ring-1 ring-border">
      <MapContainer
        center={mapCenter}
        zoom={zoom}
        scrollWheelZoom
        className="w-full h-full"
        style={{ minHeight: 300 }}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          attribution='<span style="color:#333">&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a></span>'
          maxZoom={19}
        />

        {/* Loaded / imported trace — blue */}
        {loadedLatLngs.length >= 2 && (
          <Polyline
            positions={loadedLatLngs}
            pathOptions={{ color: '#000', weight: 8, opacity: 0.4 }}
          />
        )}
        {loadedLatLngs.length >= 2 && (
          <Polyline
            positions={loadedLatLngs}
            pathOptions={{ color: '#3b82f6', weight: 4, opacity: 0.9, lineCap: 'round', lineJoin: 'round' }}
          />
        )}
        {loadedPoints[0] && (
          <CircleMarker
            center={[loadedPoints[0].lat, loadedPoints[0].lng]}
            radius={6}
            pathOptions={{ color: '#fff', weight: 2, fillColor: '#3b82f6', fillOpacity: 1 }}
          />
        )}

        {/* Live trace — lime */}
        {liveLatLngs.length >= 2 && (
          <Polyline
            positions={liveLatLngs}
            pathOptions={{ color: '#000', weight: 8, opacity: 0.5 }}
          />
        )}
        {liveLatLngs.length >= 2 && (
          <Polyline
            positions={liveLatLngs}
            pathOptions={{ color: 'hsl(75, 95%, 55%)', weight: 4, opacity: 0.95, lineCap: 'round', lineJoin: 'round' }}
          />
        )}

        {/* Start point (live) */}
        {livePoints[0] && (
          <CircleMarker
            center={[livePoints[0].lat, livePoints[0].lng]}
            radius={6}
            pathOptions={{ color: '#fff', weight: 2, fillColor: 'hsl(18, 85%, 55%)', fillOpacity: 1 }}
          />
        )}

        {/* Current live position */}
        {lastLive && (
          <>
            <CircleMarker
              center={[lastLive.lat, lastLive.lng]}
              radius={14}
              pathOptions={{ color: 'hsl(75, 95%, 55%)', weight: 2, fillColor: 'hsl(75, 95%, 55%)', fillOpacity: 0.15 }}
            />
            <CircleMarker
              center={[lastLive.lat, lastLive.lng]}
              radius={7}
              pathOptions={{ color: '#111', weight: 2, fillColor: 'hsl(75, 95%, 55%)', fillOpacity: 1 }}
            />
          </>
        )}

        <AutoFit points={livePoints} loadedPoints={loadedPoints} follow={follow} fitKey={fitKey} />
      </MapContainer>
    </div>
  );
}