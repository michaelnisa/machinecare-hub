import WebSocket from "ws";
import { config } from "../config";
import { TraccarPosition, TraccarDevice } from "./client";

export type PositionCallback = (position: TraccarPosition) => void;
export type DeviceCallback = (device: TraccarDevice) => void;
export type EventCallback = (event: any) => void;

export class TraccarWebSocketListener {
  private ws: WebSocket | null = null;
  private isRunning: boolean = false;
  private onPositionListeners: PositionCallback[] = [];
  private onDeviceListeners: DeviceCallback[] = [];
  private onEventListeners: EventCallback[] = [];
  private heartbeatTimer: NodeJS.Timeout | null = null;

  constructor() {}

  public onPosition(callback: PositionCallback) {
    this.onPositionListeners.push(callback);
  }

  public onDevice(callback: DeviceCallback) {
    this.onDeviceListeners.push(callback);
  }

  public onEvent(callback: EventCallback) {
    this.onEventListeners.push(callback);
  }

  public start() {
    this.isRunning = true;
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

    console.log(`[TraccarWS] Connecting to ${config.traccar.wsUrl}...`);

    this.ws = new WebSocket(config.traccar.wsUrl, {
      headers: {
        Authorization: authHeader,
      },
    });

    this.ws.on("open", () => {
      console.log("[TraccarWS] Connection established successfully.");
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
      console.warn(`[TraccarWS] Socket closed (${code}): ${reason || "No reason"}. Reconnecting in ${config.traccar.reconnectIntervalMs}ms...`);
      if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
      if (this.isRunning) {
        setTimeout(() => this.connect(), config.traccar.reconnectIntervalMs);
      }
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
    if (payload.positions && Array.isArray(payload.positions)) {
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
