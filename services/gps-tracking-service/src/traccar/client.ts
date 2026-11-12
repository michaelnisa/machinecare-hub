import { config } from "../config";

export interface TraccarDevice {
  id: number;
  name: string;
  uniqueId: string; // IMEI
  status: string;
  lastUpdate: string;
  positionId: number;
  attributes: Record<string, any>;
}

export interface TraccarPosition {
  id: number;
  deviceId: number;
  protocol: string;
  deviceTime: string;
  fixTime: string;
  valid: boolean;
  latitude: number;
  longitude: number;
  altitude: number;
  speed: number; // knots in Traccar (1 knot = 1.852 km/h)
  course: number;
  address?: string;
  accuracy: number;
  attributes: {
    ignition?: boolean;
    batteryLevel?: number;
    power?: number;
    battery?: number;
    sat?: number;
    distance?: number;
    totalDistance?: number;
    motion?: boolean;
    alarm?: string;
    [key: string]: any;
  };
}

export class TraccarClient {
  private authHeader: string;

  constructor() {
    const creds = `${config.traccar.user}:${config.traccar.password}`;
    this.authHeader = `Basic ${Buffer.from(creds).toString("base64")}`;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${config.traccar.apiUrl}${endpoint}`;
    const headers = {
      Authorization: this.authHeader,
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(options.headers || {}),
    };

    const res = await fetch(url, { ...options, headers });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Traccar API Error [${res.status}]: ${body || res.statusText}`);
    }
    return res.json() as Promise<T>;
  }

  /**
   * Test API connectivity and auth session
   */
  async checkSession(): Promise<any> {
    return this.request("/session");
  }

  /**
   * Retrieve all registered Traccar devices
   */
  async getDevices(): Promise<TraccarDevice[]> {
    return this.request<TraccarDevice[]>("/devices");
  }

  /**
   * Register or retrieve an existing device by IMEI in Traccar
   */
  async ensureDevice(imei: string, name: string): Promise<TraccarDevice> {
    const devices = await this.getDevices();
    const existing = devices.find((d) => d.uniqueId === imei);
    if (existing) return existing;

    return this.request<TraccarDevice>("/devices", {
      method: "POST",
      body: JSON.stringify({
        name,
        uniqueId: imei,
      }),
    });
  }

  /**
   * Fetch positions for a specific device within a date range
   */
  async getPositions(deviceId: number, from: string, to: string): Promise<TraccarPosition[]> {
    const params = new URLSearchParams({ deviceId: String(deviceId), from, to });
    return this.request<TraccarPosition[]>(`/positions?${params.toString()}`);
  }
}
