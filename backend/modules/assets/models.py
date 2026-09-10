"""
MachineCare Assets Module - Models & Domain Entities
"""

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Optional, Dict, Any

@dataclass
class AssetEntity:
    id: str
    organization_id: str
    name: str
    asset_code: str
    category: Optional[str] = None
    status: str = "operational"  # operational, in_maintenance, offline, retired
    location: Optional[str] = None
    department: Optional[str] = None
    operating_hours: float = 0.0
    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

@dataclass
class MeterReading:
    id: str
    organization_id: str
    asset_id: str
    reading_value: float
    reading_type: str = "hours"  # hours, km, cycles
    recorded_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
