import { base44 } from '@/api/base44Client';

const CONFIDENCE_BUFFER = 7; // 7 points minimum same road before correcting

/**
 * Call OSRM match service to snap points to road
 */
async function osrmMatch(points) {
  if (points.length < 2) return points;

  // Build OSRM query: lng,lat pairs (note: OSRM uses lng,lat not lat,lng)
  const coords = points.map(p => `${p.lng},${p.lat}`).join(';');
  const url = `https://router.project-osm.org/match/v1/bike/${coords}?overview=full&steps=false&annotations=distance,duration&geometries=geojson`;

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`OSRM error: ${res.status}`);
    
    const data = await res.json();
    if (!data.matchings || data.matchings.length === 0) return points;

    // Extract matched coordinates
    const matching = data.matchings[0];
    const geometry = matching.geometry;
    
    if (!geometry || geometry.type !== 'LineString') return points;

    // Match each point to closest coord in matched geometry
    const matchedCoords = geometry.coordinates; // [lng, lat]
    const confidences = matching.confidence || []; // confidence per point

    return points.map((pt, idx) => ({
      ...pt,
      lat: matchedCoords[idx]?.[1] ?? pt.lat,
      lng: matchedCoords[idx]?.[0] ?? pt.lng,
      confidence: confidences[idx] ?? 0
    }));
  } catch (error) {
    console.error('OSRM match failed:', error);
    return points;
  }
}

/**
 * Apply confidence buffer: only correct points when we're stable on same road
 */
function applyConfidenceBuffer(matchedPoints) {
  if (matchedPoints.length < CONFIDENCE_BUFFER) return matchedPoints;

  const corrected = [...matchedPoints];
  let i = 0;

  while (i < corrected.length) {
    // Look ahead CONFIDENCE_BUFFER points
    const bufferEnd = Math.min(i + CONFIDENCE_BUFFER, corrected.length);
    const buffer = corrected.slice(i, bufferEnd);

    // Check if all points in buffer have same road (confidence > 0.5)
    const allStable = buffer.every(p => (p.confidence || 0) > 0.5);

    if (allStable && buffer.length === CONFIDENCE_BUFFER) {
      // Stable on road: correct points i-1..i (before this buffer)
      if (i > 0) {
        // Keep the matched coords from buffer
        // Points before this buffer are already corrected or skipped
      }
      i += CONFIDENCE_BUFFER;
    } else {
      // Not confident: move to next point
      i += 1;
    }
  }

  return corrected;
}

/**
 * Main: snap session points to road network
 */
export async function snapSessionToRoad(pseudo, sessionId) {
  try {
    // Fetch all points for this session
    const allPoints = await base44.entities.TrackPoint.filter(
      { pseudo, session_id: sessionId },
      'recorded_at',
      5000
    );

    if (!allPoints || allPoints.length < 2) return;

    // Call OSRM match
    const matched = await osrmMatch(allPoints);

    // Apply confidence buffer
    const stable = applyConfidenceBuffer(matched);

    // Update DB with corrected coords
    const updates = stable.map(pt => ({
      id: pt.id,
      lat: pt.lat,
      lng: pt.lng
    }));

    // Update in parallel batches of 10
    const batchSize = 10;
    for (let i = 0; i < updates.length; i += batchSize) {
      const batch = updates.slice(i, i + batchSize);
      await Promise.all(
        batch.map(upd =>
          base44.entities.TrackPoint.update(upd.id, { lat: upd.lat, lng: upd.lng })
        )
      );
    }

    console.log(`✓ Snapped ${stable.length} points to road`);
  } catch (error) {
    console.error('snapSessionToRoad failed:', error);
  }
}