import WebSocket from "ws";
import { config } from "../config";
import { TraccarPosition, TraccarDevice } from "./client";

export type PositionCallback = (position: TraccarPosition) => void;
export type PositionBatchCallback = (positions: TraccarPosition[]) => void;
export type DeviceCallback = (device: TraccarDevice) => void;
export type EventCallback = (event: any) => void;

export class TraccarWebSocketListener {
  private ws: WebSocket | null = null;
  private isRunning: boolean = false;
  private onPositionListeners: PositionCallback[] = [];
  private onPositionBatchListeners: PositionBatchCallback[] = [];
  private onDeviceListeners: DeviceCallback[] = [];
  private onEventListeners: EventCallback[] = [];
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private reconnectAttempts: number = 0;
  private readonly baseDelayMs: number = 1000;
  private readonly maxDelayMs: number = 60000;

  constructor() {}

  public onPosition(callback: PositionCallback) {
    this.onPositionListeners.push(callback);
  }

  public onPositionBatch(callback: PositionBatchCallback) {
    this.onPositionBatchListeners.push(callback);
  }

  public onDevice(callback: DeviceCallback) {
    this.onDeviceListeners.push(callback);
  }

  public onEvent(callback: EventCallback) {
    this.onEventListeners.push(callback);
  }

  public start() {
    this.isRunning = true;
    this.reconnectAttempts = 0;
    this.connect();
  }

  public stop() {
    this.isRunning = false;
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  private connect() {
    if (!this.isRunning) return;

    const creds = `${config.traccar.user}:${config.traccar.password}`;
    const authHeader = `Basic ${Buffer.from(creds).toString("base64")}`;

    console.log(`[TraccarWS] Connecting to ${config.traccar.wsUrl} (attempt #${this.reconnectAttempts + 1})...`);

    this.ws = new WebSocket(config.traccar.wsUrl, {
      headers: {
        Authorization: authHeader,
      },
    });

    this.ws.on("open", () => {
      console.log("[TraccarWS] Connection established successfully.");
      this.reconnectAttempts = 0; // Reset backoff on success
      this.setupHeartbeat();
    });

    this.ws.on("message", (data: WebSocket.RawData) => {
      try {
        const payload = JSON.parse(data.toString());
        this.handleMessage(payload);
      } catch (err) {
        console.error("[TraccarWS] Error parsing incoming message:", err);
      }
    });

    this.ws.on("error", (err) => {
      console.error("[TraccarWS] Socket error:", err.message);
    });

    this.ws.on("close", (code, reason) => {
      if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
      if (!this.isRunning) return;

      // Exponential backoff with jitter: delay = min(base * 1.8^attempts + jitter, max)
      const jitter = Math.floor(Math.random() * 500);
      const delay = Math.min(
        Math.floor(this.baseDelayMs * Math.pow(1.8, this.reconnectAttempts)) + jitter,
        this.maxDelayMs
      );
      this.reconnectAttempts++;

      console.warn(
        `[TraccarWS] Socket closed (${code}): ${reason || "No reason"}. Reconnecting in ${delay}ms (attempt #${this.reconnectAttempts})...`
      );

      setTimeout(() => this.connect(), delay);
    });
  }

  private setupHeartbeat() {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.ping();
      }
    }, config.traccar.heartbeatIntervalMs);
  }

  private handleMessage(payload: any) {
    if (payload.positions && Array.isArray(payload.positions) && payload.positions.length > 0) {
      // 1. Dispatch full batch for chronological burst processing
      this.onPositionBatchListeners.forEach((cb) => cb(payload.positions));

      // 2. Dispatch individual positions
      for (const pos of payload.positions) {
        this.onPositionListeners.forEach((cb) => cb(pos));
      }
    }

    if (payload.devices && Array.isArray(payload.devices)) {
      for (const dev of payload.devices) {
        this.onDeviceListeners.forEach((cb) => cb(dev));
      }
    }

    if (payload.events && Array.isArray(payload.events)) {
      for (const ev of payload.events) {
        this.onEventListeners.forEach((cb) => cb(ev));
      }
    }
  }
}
