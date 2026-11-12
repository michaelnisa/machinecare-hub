import dotenv from "dotenv";
dotenv.config();

export const config = {
  traccar: {
    apiUrl: process.env.TRACCAR_API_URL || "https://gps.machinecare.co.tz/api",
    wsUrl: process.env.TRACCAR_WS_URL || "wss://gps.machinecare.co.tz/api/socket",
    user: process.env.TRACCAR_ADMIN_USER || "admin",
    password: process.env.TRACCAR_ADMIN_PASSWORD || "",
    reconnectIntervalMs: 5000,
    heartbeatIntervalMs: 25000,
  },
  supabase: {
    url: process.env.SUPABASE_URL || "",
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
  },
  telematics: {
    overspeedThresholdKmh: Number(process.env.OVERSPEED_THRESHOLD_KMH || 90),
    lowBatteryThresholdVolts: Number(process.env.LOW_BATTERY_VOLTS || 11.5),
    batchFlushIntervalMs: Number(process.env.BATCH_FLUSH_INTERVAL_MS || 3000),
    maxBatchSize: Number(process.env.MAX_BATCH_SIZE || 100),
    gpsJumpThresholdKm: Number(process.env.GPS_JUMP_THRESHOLD_KM || 150), // jump filter
    simulationMode: process.env.SIMULATION_MODE === "true",
  },
};
