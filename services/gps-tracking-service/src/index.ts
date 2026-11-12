/**
 * MachineCare GPS Tracking & Telematics Integration Daemon
 * Runs on Linux VPS to bridge Traccar with Supabase.
 */

import { config } from "./config";
import { TraccarClient } from "./traccar/client";
import { TraccarWebSocketListener } from "./traccar/websocket";
import { GpsSyncEngine } from "./ingestion/syncEngine";
import { startPilotSimulation } from "./simulator/deviceSimulator";

async function main() {
  console.log("=========================================================");
  console.log(" MACHINECARE GPS TRACKING & TELEMATICS SERVICE");
  console.log("=========================================================");
  console.log(`Environment: Node.js ${process.version}`);
  console.log(`Traccar API URL: ${config.traccar.apiUrl}`);
  console.log(`Traccar WS URL:  ${config.traccar.wsUrl}`);
  console.log(`Supabase URL:    ${config.supabase.url ? config.supabase.url.slice(0, 25) + "..." : "NOT SET"}`);
  console.log(`Simulation Mode: ${config.telematics.simulationMode}`);
  console.log("=========================================================");

  const syncEngine = new GpsSyncEngine();
  await syncEngine.initialize();

  if (config.telematics.simulationMode) {
    console.log("[Main] Running in hardware simulation mode for pilot validation.");
    startPilotSimulation(syncEngine, 5000);
  } else {
    // Production Traccar Mode
    const traccarClient = new TraccarClient();

    try {
      console.log("[Main] Verifying Traccar REST API session...");
      const session = await traccarClient.checkSession();
      console.log(`[Main] Authenticated as Traccar user: ${session.name || session.email}`);
    } catch (err: any) {
      console.warn(`[Main] Traccar REST API check warning: ${err.message}. Proceeding to socket listener...`);
    }

    const wsListener = new TraccarWebSocketListener();

    // Use onPositionBatch to ensure burst positions from cell re-connections are processed chronologically
    wsListener.onPositionBatch((positions) => {
      syncEngine.processPositionsBatch(positions);
    });

    wsListener.onEvent((ev) => {
      console.log(`[Main] Device event received: ${ev.type} on device ${ev.deviceId}`);
    });

    wsListener.start();

    // Periodic refresh of device-to-vehicle mappings every 5 minutes
    setInterval(() => {
      syncEngine.refreshDeviceMappings();
    }, 5 * 60 * 1000);

    // Graceful shutdown handling
    process.on("SIGINT", () => {
      console.log("[Main] Received SIGINT. Shutting down cleanly...");
      wsListener.stop();
      syncEngine.stop();
      process.exit(0);
    });

    process.on("SIGTERM", () => {
      console.log("[Main] Received SIGTERM. Shutting down cleanly...");
      wsListener.stop();
      syncEngine.stop();
      process.exit(0);
    });
  }
}

main().catch((err) => {
  console.error("[Main] Fatal service error:", err);
  process.exit(1);
});
