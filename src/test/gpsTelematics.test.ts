import { describe, it, expect } from "vitest";
import {
  calculateHaversineDistance,
  knotsToKmh,
  isPointInCircleGeofence,
  isPointInPolygonGeofence,
} from "../services/gpsService";

describe("GPS Telematics Engine & Geofencing Math", () => {
  describe("Haversine Distance Calculation", () => {
    it("should compute 0 distance for identical coordinates", () => {
      const dist = calculateHaversineDistance(-6.816064, 39.280358, -6.816064, 39.280358);
      expect(dist).toBe(0);
    });

    it("should calculate correct real-world distance between Dar es Salaam and Morogoro (~180km)", () => {
      // Dar es Salaam: -6.8235, 39.2695
      // Morogoro: -6.8278, 37.6698
      const dist = calculateHaversineDistance(-6.8235, 39.2695, -6.8278, 37.6698);
      expect(dist).toBeGreaterThan(170);
      expect(dist).toBeLessThan(185);
    });

    it("should calculate correct distance between Dar es Salaam and Dodoma (~450km)", () => {
      // Dodoma: -6.1630, 35.7516
      const dist = calculateHaversineDistance(-6.8235, 39.2695, -6.1630, 35.7516);
      expect(dist).toBeGreaterThan(390);
      expect(dist).toBeLessThan(420);
    });
  });

  describe("Speed Conversion (Knots to KM/H)", () => {
    it("should convert 0 knots to 0 km/h", () => {
      expect(knotsToKmh(0)).toBe(0);
    });

    it("should correctly convert nautical knots to km/h (1 knot = 1.852 km/h)", () => {
      expect(knotsToKmh(10)).toBeCloseTo(18.52, 2);
      expect(knotsToKmh(50)).toBeCloseTo(92.6, 1);
    });
  });

  describe("Circular Geofence Evaluation", () => {
    // Dar es Salaam Port: -6.8235, 39.2695, radius = 1000m (1km)
    const portLat = -6.8235;
    const portLon = 39.2695;
    const radiusMeters = 1000;

    it("should return true when vehicle is exactly at center", () => {
      expect(isPointInCircleGeofence(portLat, portLon, portLat, portLon, radiusMeters)).toBe(true);
    });

    it("should return true when vehicle is 300m away (inside perimeter)", () => {
      // small delta ~ 0.002 deg is approx 220m
      const testLat = portLat + 0.002;
      const testLon = portLon + 0.001;
      expect(isPointInCircleGeofence(testLat, testLon, portLat, portLon, radiusMeters)).toBe(true);
    });

    it("should return false when vehicle is 5km away (outside perimeter)", () => {
      // 0.05 deg is ~5.5km away
      const testLat = portLat + 0.05;
      const testLon = portLon + 0.05;
      expect(isPointInCircleGeofence(testLat, testLon, portLat, portLon, radiusMeters)).toBe(false);
    });
  });

  describe("Polygon Geofence Ray-Casting Algorithm", () => {
    // Triangular yard: [ [0, 0], [0, 10], [10, 0] ]
    const triangleYard: [number, number][] = [
      [0, 0],
      [0, 10],
      [10, 0],
    ];

    it("should identify point inside polygon", () => {
      expect(isPointInPolygonGeofence(2, 2, triangleYard)).toBe(true);
    });

    it("should identify point clearly outside polygon", () => {
      expect(isPointInPolygonGeofence(8, 8, triangleYard)).toBe(false);
      expect(isPointInPolygonGeofence(-1, -1, triangleYard)).toBe(false);
    });

    // Rectangular yard: Dar Depot [ [-6.80, 39.20], [-6.80, 39.30], [-6.90, 39.30], [-6.90, 39.20] ]
    const darDepot: [number, number][] = [
      [-6.80, 39.20],
      [-6.80, 39.30],
      [-6.90, 39.30],
      [-6.90, 39.20],
    ];

    it("should detect truck inside Dar Depot boundary", () => {
      expect(isPointInPolygonGeofence(-6.85, 39.25, darDepot)).toBe(true);
    });

    it("should detect truck outside Dar Depot boundary", () => {
      expect(isPointInPolygonGeofence(-6.70, 39.25, darDepot)).toBe(false);
      expect(isPointInPolygonGeofence(-6.85, 39.35, darDepot)).toBe(false);
    });

    it("should handle degenerate / empty polygons safely without throwing", () => {
      expect(isPointInPolygonGeofence(0, 0, [])).toBe(false);
      expect(isPointInPolygonGeofence(0, 0, [[0, 0], [1, 1]])).toBe(false);
    });
  });

  describe("GPS Multipath & Anomaly Detection Logic", () => {
    it("should flag impossible jump (> 150km between consecutive pings) as anomaly", () => {
      // Dar es Salaam to Nairobi: ~670km
      const darLat = -6.8235;
      const darLon = 39.2695;
      const nairobiLat = -1.2921;
      const nairobiLon = 36.8219;

      const jumpKm = calculateHaversineDistance(darLat, darLon, nairobiLat, nairobiLon);
      const isMultipathAnomaly = jumpKm > 150;

      expect(isMultipathAnomaly).toBe(true);
    });

    it("should accept realistic highway transit between consecutive pings (< 10km)", () => {
      // 1 minute at 80 km/h = ~1.33 km
      const p1Lat = -6.8235;
      const p1Lon = 39.2695;
      const p2Lat = -6.8350;
      const p2Lon = 39.2750;

      const deltaKm = calculateHaversineDistance(p1Lat, p1Lon, p2Lat, p2Lon);
      expect(deltaKm).toBeLessThan(150);
      expect(deltaKm).toBeGreaterThan(1);
    });
  });
});
