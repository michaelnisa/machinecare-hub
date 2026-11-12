/**
 * MachineCare GPS Telematics Simulator
 * Simulates 5 commercial pilot vehicles moving along Tanzanian transit corridors
 * (Dar es Salaam, Morogoro, Dodoma, Tunduma border, Arusha).
 * Clearly tagged with simulated metadata.
 */

import { GpsSyncEngine } from "../ingestion/syncEngine";
import { TraccarPosition } from "../traccar/client";

interface SimulatedTruck {
  imei: string;
  name: string;
  route: [number, number][]; // [lat, lng] waypoints
  currentIndex: number;
  speed: number;
  odometer: number;
  ignition: boolean;
}

// Actual transit corridor waypoints in Tanzania
const DAR_TO_MOROGORO: [number, number][] = [
  [-6.8162, 39.2783], // Dar Port
  [-6.7924, 39.1982], // Ubungo
  [-6.7582, 38.9811], // Kibaha
  [-6.7021, 38.6412], // Chalinze Junction
  [-6.7612, 38.1251], // Morogoro Highway
  [-6.8211, 37.6621], // Morogoro Town
];

const MOROGORO_TO_DODOMA: [number, number][] = [
  [-6.8211, 37.6621], // Morogoro
  [-6.4521, 36.9812], // Kilosa road
  [-6.2811, 36.5212], // Gairo
  [-6.1821, 35.7482], // Dodoma City Center
];

const MBEYA_TO_TUNDUMA: [number, number][] = [
  [-8.9094, 33.4608], // Mbeya
  [-9.1212, 33.1512], // Vwawa
  [-9.3012, 32.7681], // Tunduma Zambia Border
];

const DAR_TO_ARUSHA: [number, number][] = [
  [-6.7021, 38.6412], // Chalinze
  [-5.4121, 38.0121], // Korogwe
  [-4.7512, 37.8212], // Same
  [-3.3869, 36.6830], // Arusha
];

const DAR_PORT_IDLE: [number, number][] = [
  [-6.8312, 39.2912],
  [-6.8313, 39.2914],
  [-6.8312, 39.2911],
];

export const PILOT_TRUCKS: SimulatedTruck[] = [
  {
    imei: "867823050123451",
    name: "Heavy Hauler 01 (T 101 ABC)",
    route: DAR_TO_MOROGORO,
    currentIndex: 0,
    speed: 72,
    odometer: 148200,
    ignition: true,
  },
  {
    imei: "867823050123452",
    name: "Trans-Africa Tanker 02 (T 202 DEF)",
    route: MOROGORO_TO_DODOMA,
    currentIndex: 1,
    speed: 68,
    odometer: 285400,
    ignition: true,
  },
  {
    imei: "867823050123453",
    name: "Corridor Freight 03 (T 303 GHI)",
    route: MBEYA_TO_TUNDUMA,
    currentIndex: 0,
    speed: 55,
    odometer: 412900,
    ignition: true,
  },
  {
    imei: "867823050123454",
    name: "Northern Express 04 (T 404 JKL)",
    route: DAR_TO_ARUSHA,
    currentIndex: 2,
    speed: 80,
    odometer: 94100,
    ignition: true,
  },
  {
    imei: "867823050123455",
    name: "Port Shuttle 05 (T 505 MNO)",
    route: DAR_PORT_IDLE,
    currentIndex: 0,
    speed: 0,
    odometer: 52300,
    ignition: true, // Idling in terminal
  },
];

export function startPilotSimulation(engine: GpsSyncEngine, intervalMs: number = 5000) {
  console.log(`[Simulator] Starting 5-vehicle pilot telemetry simulation (Interval: ${intervalMs}ms)...`);

  setInterval(async () => {
    for (const truck of PILOT_TRUCKS) {
      // Advance waypoint
      truck.currentIndex = (truck.currentIndex + 1) % truck.route.length;
      const [baseLat, baseLng] = truck.route[truck.currentIndex];

      // Add slight jitter for realism
      const lat = baseLat + (Math.random() - 0.5) * 0.002;
      const lng = baseLng + (Math.random() - 0.5) * 0.002;

      // Increment odometer if moving
      if (truck.speed > 0) {
        truck.odometer += (truck.speed * (intervalMs / 1000)) / 3600;
      }

      const mockTraccarPos: TraccarPosition = {
        id: Math.floor(Math.random() * 100000),
        deviceId: 1,
        protocol: "teltonika",
        deviceTime: new Date().toISOString(),
        fixTime: new Date().toISOString(),
        valid: true,
        latitude: lat,
        longitude: lng,
        altitude: 450,
        speed: truck.speed / 1.852, // convert km/h to knots
        course: 270,
        accuracy: 4.5,
        attributes: {
          ignition: truck.ignition,
          power: 24.2,
          battery: 3.9,
          sat: 14,
          totalDistance: Math.round(truck.odometer * 1000),
          motion: truck.speed > 0,
          simulation: true,
        },
      };

      await engine.processPosition(mockTraccarPos, truck.imei);
    }
  }, intervalMs);
}
