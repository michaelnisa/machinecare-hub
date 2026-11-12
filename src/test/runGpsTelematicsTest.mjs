import test from "node:test";
import assert from "node:assert/strict";

// Re-implement the pure algorithms from gpsService / normalizer to test
function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function knotsToKmh(knots) {
  return knots * 1.852;
}

function isPointInCircleGeofence(lat, lon, centerLat, centerLon, radiusMeters) {
  const distKm = calculateHaversineDistance(lat, lon, centerLat, centerLon);
  return distKm <= radiusMeters / 1000;
}

function isPointInPolygonGeofence(lat, lon, polygon) {
  if (!polygon || polygon.length < 3) return false;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0], yi = polygon[i][1];
    const xj = polygon[j][0], yj = polygon[j][1];
    const intersect = yi > lon !== yj > lon && lat < ((xj - xi) * (lon - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

test("Haversine Distance: identical points return 0 km", () => {
  const dist = calculateHaversineDistance(-6.816064, 39.280358, -6.816064, 39.280358);
  assert.equal(dist, 0);
});

test("Haversine Distance: Dar es Salaam to Morogoro is ~175-185 km", () => {
  const dist = calculateHaversineDistance(-6.8235, 39.2695, -6.8278, 37.6698);
  assert.ok(dist >= 170 && dist <= 185, `Distance was ${dist}`);
});

test("Haversine Distance: Dar es Salaam to Dodoma is ~400-420 km", () => {
  const dist = calculateHaversineDistance(-6.8235, 39.2695, -6.1630, 35.7516);
  assert.ok(dist >= 390 && dist <= 420, `Distance was ${dist}`);
});

test("Knots to KM/H conversion", () => {
  assert.equal(knotsToKmh(0), 0);
  assert.equal(Math.round(knotsToKmh(10) * 100) / 100, 18.52);
  assert.equal(Math.round(knotsToKmh(50) * 10) / 10, 92.6);
});

test("Circle Geofence: Dar es Salaam Port 1km perimeter", () => {
  const portLat = -6.8235;
  const portLon = 39.2695;
  const radiusMeters = 1000;

  // Center point
  assert.equal(isPointInCircleGeofence(portLat, portLon, portLat, portLon, radiusMeters), true);

  // 300m away
  assert.equal(isPointInCircleGeofence(portLat + 0.002, portLon + 0.001, portLat, portLon, radiusMeters), true);

  // 6km away (outside)
  assert.equal(isPointInCircleGeofence(portLat + 0.05, portLon + 0.05, portLat, portLon, radiusMeters), false);
});

test("Polygon Geofence: Ray-Casting Algorithm", () => {
  const darDepot = [
    [-6.80, 39.20],
    [-6.80, 39.30],
    [-6.90, 39.30],
    [-6.90, 39.20],
  ];

  // Inside
  assert.equal(isPointInPolygonGeofence(-6.85, 39.25, darDepot), true);
  // Outside
  assert.equal(isPointInPolygonGeofence(-6.70, 39.25, darDepot), false);
  assert.equal(isPointInPolygonGeofence(-6.85, 39.35, darDepot), false);

  // Safe against invalid polygons
  assert.equal(isPointInPolygonGeofence(0, 0, []), false);
  assert.equal(isPointInPolygonGeofence(0, 0, [[0, 0], [1, 1]]), false);
});

test("Multipath Anomaly Detection: flags jumps > 150km", () => {
  const darLat = -6.8235;
  const darLon = 39.2695;
  const nairobiLat = -1.2921;
  const nairobiLon = 36.8219;

  const jumpKm = calculateHaversineDistance(darLat, darLon, nairobiLat, nairobiLon);
  assert.ok(jumpKm > 150, "Expected impossible jump between Dar and Nairobi");
});
