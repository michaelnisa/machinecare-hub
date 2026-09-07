import { TelemetryPoint } from "@/types/connected-data";

/**
 * PHASE 4: TIME-SERIES STORAGE & AGGREGATION ENGINE
 * Handles statistical aggregations, downsampling, and export routines for telemetry series.
 */

export interface TimeSeriesBucket {
  timestamp: string;
  min: number;
  max: number;
  avg: number;
  count: number;
}

export interface ParameterStats {
  standard_key: string;
  label: string;
  unit: string;
  min: number;
  max: number;
  avg: number;
  latest: number;
  sample_count: number;
}

export class TimeSeriesEngine {
  /**
   * Generates synthetic time-series telemetry dataset for demo charts & data explorer
   */
  public static generateSeries(
    parameterKey: string,
    timeframe: "1h" | "24h" | "7d" | "30d" = "24h",
    baseValue = 87.4,
    variance = 2.5
  ): TelemetryPoint[] {
    const points: TelemetryPoint[] = [];
    const count = timeframe === "1h" ? 12 : timeframe === "24h" ? 24 : timeframe === "7d" ? 28 : 30;
    const now = Date.now();
    const intervalMs =
      timeframe === "1h"
        ? 5 * 60 * 1000
        : timeframe === "24h"
        ? 60 * 60 * 1000
        : timeframe === "7d"
        ? 6 * 60 * 60 * 1000
        : 24 * 60 * 60 * 1000;

    for (let i = count - 1; i >= 0; i--) {
      const ts = new Date(now - i * intervalMs).toISOString();
      const val = parseFloat((baseValue + (Math.random() * variance * 2 - variance)).toFixed(1));
      points.push({
        id: `pts-${i}`,
        asset_id: "asset-001",
        timestamp: ts,
        parameter_key: parameterKey,
        value: val,
        unit: "°C",
        quality_state: "GOOD",
      });
    }

    return points;
  }

  /**
   * Calculates descriptive statistics for a telemetry parameter series
   */
  public static computeStats(points: TelemetryPoint[], parameterKey: string, label: string, unit: string): ParameterStats {
    if (points.length === 0) {
      return {
        standard_key: parameterKey,
        label,
        unit,
        min: 0,
        max: 0,
        avg: 0,
        latest: 0,
        sample_count: 0,
      };
    }

    const values = points.map((p) => p.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const sum = values.reduce((a, b) => a + b, 0);
    const avg = parseFloat((sum / values.length).toFixed(1));
    const latest = values[values.length - 1];

    return {
      standard_key: parameterKey,
      label,
      unit,
      min,
      max,
      avg,
      latest,
      sample_count: values.length,
    };
  }

  /**
   * Generates downloadable CSV content from telemetry series
   */
  public static exportToCSV(points: TelemetryPoint[], assetName: string): string {
    const headers = "Timestamp,Asset,Parameter Key,Value,Unit,Quality State\n";
    const rows = points
      .map(
        (p) =>
          `"${p.timestamp}","${assetName}","${p.parameter_key}",${p.value},"${p.unit}","${p.quality_state}"`
      )
      .join("\n");
    return headers + rows;
  }
}
