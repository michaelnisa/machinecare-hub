"""
MachineCare Connected Data (IoT & Telemetry) Module - Models & Domain Entities
"""

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any

@dataclass
class TelemetryDataPoint:
    id: str
    organization_id: str
    device_id: str
    asset_id: Optional[str]
    metric_name: str  # temperature, vibration, pressure, current, rpm
    metric_value: float
    unit: str
    timestamp: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class ConnectedDataService:
    def __init__(self):
        self._telemetry_stream: List[TelemetryDataPoint] = []
        self._alarm_thresholds: Dict[str, float] = {
            "temperature_high": 95.0,  # Celsius
            "vibration_high": 4.5,     # mm/s RMS
        }

    def ingest_telemetry(self, point: TelemetryDataPoint) -> Dict[str, Any]:
        self._telemetry_stream.append(point)
        # Check alarm conditions
        alert_triggered = False
        threshold_key = f"{point.metric_name}_high"
        if threshold_key in self._alarm_thresholds:
            if point.metric_value >= self._alarm_thresholds[threshold_key]:
                alert_triggered = True

        return {
            "ingested": True,
            "point_id": point.id,
            "alarm_triggered": alert_triggered,
        }
