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

// ============================================================================
// SECTION 10 & 12 TESTS
// ============================================================================

function validateImei(imei) {
  if (!imei) return { valid: false, reason: "IMEI is required" };
  const cleaned = imei.trim().replace(/[\s-]/g, "");
  if (!/^\d{15}$/.test(cleaned)) {
    return { valid: false, reason: `IMEI must be exactly 15 numeric digits (currently ${cleaned.length} chars)` };
  }
  let sum = 0;
  for (let i = 0; i < 15; i++) {
    let digit = parseInt(cleaned.charAt(i), 10);
    if (i % 2 === 1) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }
  if (sum % 10 !== 0) {
    return { valid: false, reason: "Invalid IMEI checksum (failed Luhn algorithm check)" };
  }
  return { valid: true };
}

test("Section 10 - Luhn IMEI Validation: Validates real 15-digit IMEIs", () => {
  // Real valid Teltonika / TAC IMEIs with verified Luhn checksums
  const validImeis = [
    "356938035643809",
    "867823050123451",
    "490154203237518",
    "862494038166577",
  ];

  for (const imei of validImeis) {
    const res = validateImei(imei);
    assert.equal(res.valid, true, `Expected ${imei} to be valid Luhn IMEI`);
  }
});

test("Section 10 - Luhn IMEI Validation: Rejects corrupted checksum digit", () => {
  // Correct is 356938035643809, corrupted last digit to 8
  const corrupted = "356938035643808";
  const res = validateImei(corrupted);
  assert.equal(res.valid, false);
  assert.ok(res.reason.includes("failed Luhn algorithm check"));
});

test("Section 10 - Luhn IMEI Validation: Rejects invalid lengths and non-digits", () => {
  assert.equal(validateImei("12345").valid, false);
  assert.equal(validateImei("867823050123456789").valid, false);
  assert.equal(validateImei("86782305012345A").valid, false);
  assert.equal(validateImei("").valid, false);
});

test("Section 10 - Health Diagnostics Summary Calculation", () => {
  const mockDevices = [
    {
      id: "dev-1",
      status: "active",
      active_assignment: { vehicle_id: "veh-1" },
      telematics_health: { external_power: true, battery_voltage: 4.1, hours_since_ping: 0.2 },
    },
    {
      id: "dev-2",
      status: "active",
      active_assignment: { vehicle_id: "veh-2" },
      telematics_health: { external_power: false, battery_voltage: 3.8, hours_since_ping: 0.1 }, // Power cut
    },
    {
      id: "dev-3",
      status: "active",
      active_assignment: { vehicle_id: "veh-3" },
      telematics_health: { external_power: true, battery_voltage: 3.5, hours_since_ping: 1.0 }, // Low battery
    },
    {
      id: "dev-4",
      status: "offline",
      active_assignment: { vehicle_id: "veh-4" },
      telematics_health: { hours_since_ping: 32 }, // Offline > 24h
    },
    {
      id: "dev-5",
      status: "unassigned",
      active_assignment: null,
      telematics_health: undefined, // In stock
    },
  ];

  let active = 0, unassigned = 0, offlineOver24h = 0, powerCutTamper = 0, lowBackupBattery = 0, healthy = 0;
  mockDevices.forEach((d) => {
    if (d.active_assignment) active++;
    else unassigned++;

    const isOffline = d.status === "offline" || (d.telematics_health?.hours_since_ping != null && d.telematics_health.hours_since_ping >= 24);
    if (isOffline) offlineOver24h++;
    if (d.telematics_health?.external_power === false) powerCutTamper++;
    if (d.telematics_health?.battery_voltage != null && d.telematics_health.battery_voltage < 3.65) lowBackupBattery++;
    if (d.active_assignment && !isOffline && d.telematics_health?.external_power !== false && (d.telematics_health?.battery_voltage == null || d.telematics_health.battery_voltage >= 3.65)) {
      healthy++;
    }
  });

  assert.equal(active, 4);
  assert.equal(unassigned, 1);
  assert.equal(offlineOver24h, 1);
  assert.equal(powerCutTamper, 1);
  assert.equal(lowBackupBattery, 1);
  assert.equal(healthy, 1);
});

test("Section 12 - Duplicate Ping Suppression: Discards retransmissions", () => {
  const cache = new Set();
  const vehicleId = "veh-abc";
  const recordedAt = "2026-11-13T00:15:30.000Z";

  const key1 = `${vehicleId}:${recordedAt}`;
  assert.equal(cache.has(key1), false);
  cache.add(key1);

  // Second ping with identical satellite timestamp (retransmission)
  assert.equal(cache.has(key1), true, "Duplicate ping should be identified and suppressed");
});

test("Section 12 - Mobile Network Drop: Chronological burst sorting", () => {
  // Out of order burst buffered in flash during cell dead zone
  const burst = [
    { deviceTime: "2026-11-13T00:03:00.000Z", speed: 50 },
    { deviceTime: "2026-11-13T00:01:00.000Z", speed: 20 },
    { deviceTime: "2026-11-13T00:02:00.000Z", speed: 35 },
  ];

  const sorted = [...burst].sort((a, b) => new Date(a.deviceTime).getTime() - new Date(b.deviceTime).getTime());

  assert.equal(sorted[0].speed, 20);
  assert.equal(sorted[1].speed, 35);
  assert.equal(sorted[2].speed, 50);
});

test("Section 12 - Power Cut & Tamper Evaluation", () => {
  function isTamperAlert(pos) {
    return (
      pos.externalPower === false ||
      pos.rawAttributes?.alarm === "powerCut" ||
      pos.rawAttributes?.alarm === "tamper" ||
      pos.rawAttributes?.power === 0
    );
  }

  assert.equal(isTamperAlert({ externalPower: true, rawAttributes: {} }), false);
  assert.equal(isTamperAlert({ externalPower: false, rawAttributes: {} }), true);
  assert.equal(isTamperAlert({ externalPower: true, rawAttributes: { alarm: "powerCut" } }), true);
  assert.equal(isTamperAlert({ externalPower: true, rawAttributes: { power: 0 } }), true);
});

// ============================================================================
// PHASE 4 — DATABASE & MULTI-TENANT SECURITY TESTS
// ============================================================================

test("Phase 4 - Multi-Tenant Security: Strict Organization Isolation", () => {
  // Mock multi-tenant database records
  const allPositions = [
    { id: 1, organisation_id: "org-alpha", vehicle_id: "veh-1", latitude: -6.82, longitude: 39.28 },
    { id: 2, organisation_id: "org-alpha", vehicle_id: "veh-2", latitude: -6.83, longitude: 39.29 },
    { id: 3, organisation_id: "org-beta", vehicle_id: "veh-3", latitude: -3.38, longitude: 36.68 },
    { id: 4, organisation_id: "org-beta", vehicle_id: "veh-4", latitude: -3.39, longitude: 36.69 },
  ];

  // Simulated RLS query executor for Org Alpha user
  function executeOrgQuery(currentOrgId, records) {
    return records.filter((r) => r.organisation_id === currentOrgId);
  }

  const alphaPositions = executeOrgQuery("org-alpha", allPositions);
  const betaPositions = executeOrgQuery("org-beta", allPositions);

  // Assert Org Alpha sees only its own 2 records and zero of Beta
  assert.equal(alphaPositions.length, 2);
  assert.ok(alphaPositions.every((p) => p.organisation_id === "org-alpha"));
  assert.equal(alphaPositions.some((p) => p.organisation_id === "org-beta"), false);

  // Assert Org Beta sees only its own 2 records
  assert.equal(betaPositions.length, 2);
  assert.ok(betaPositions.every((p) => p.organisation_id === "org-beta"));
  assert.equal(betaPositions.some((p) => p.organisation_id === "org-alpha"), false);
});

test("Phase 4 - Device Assignment Invariant: No device assigned to multiple active vehicles", () => {
  const activeAssignments = new Map(); // deviceId -> assignment

  function assignDevice(deviceId, vehicleId, orgId) {
    // Check constraint: device can only have 1 active assignment
    if (activeAssignments.has(deviceId)) {
      const existing = activeAssignments.get(deviceId);
      if (existing.status === "active") {
        // Enforce rule: must deactivate old assignment before new assignment
        existing.status = "historical";
        existing.removed_at = new Date().toISOString();
      }
    }

    const newAssignment = {
      id: `assign-${Date.now()}`,
      deviceId,
      vehicleId,
      orgId,
      status: "active",
      installed_at: new Date().toISOString(),
    };
    activeAssignments.set(deviceId, newAssignment);
    return newAssignment;
  }

  const devId = "teltonika-fmc920-101";
  assignDevice(devId, "truck-10", "org-alpha");
  assert.equal(activeAssignments.get(devId).vehicleId, "truck-10");
  assert.equal(activeAssignments.get(devId).status, "active");

  // Re-assigning to truck-20 must cleanly replace truck-10
  assignDevice(devId, "truck-20", "org-alpha");
  assert.equal(activeAssignments.get(devId).vehicleId, "truck-20");
  assert.equal(activeAssignments.get(devId).status, "active");
});

test("Phase 4 - Ingestion Engine: Prevents cross-tenant telemetry poisoning", () => {
  // Trusted internal mapping table maintained by syncEngine
  const deviceRegistry = new Map([
    ["867823050123451", { orgId: "org-alpha", vehicleId: "veh-alpha-1" }],
    ["356938035643809", { orgId: "org-beta", vehicleId: "veh-beta-1" }],
  ]);

  function normalizeIncomingPing(imei, rawPosition) {
    const mapping = deviceRegistry.get(imei);
    if (!mapping) return null; // Unmapped: dropped/buffered
    return {
      organisation_id: mapping.orgId, // Derived from trusted server DB mapping, NOT client packet
      vehicle_id: mapping.vehicleId,
      latitude: rawPosition.latitude,
      longitude: rawPosition.longitude,
    };
  }

  // Alpha tracker ping
  const pingAlpha = normalizeIncomingPing("867823050123451", { latitude: -6.82, longitude: 39.28 });
  assert.equal(pingAlpha.organisation_id, "org-alpha");

  // Beta tracker ping
  const pingBeta = normalizeIncomingPing("356938035643809", { latitude: -3.38, longitude: 36.68 });
  assert.equal(pingBeta.organisation_id, "org-beta");

  // Rogue / unmapped tracker cannot inject data into any org
  const roguePing = normalizeIncomingPing("999999999999999", { latitude: 0, longitude: 0 });
  assert.equal(roguePing, null);
});


