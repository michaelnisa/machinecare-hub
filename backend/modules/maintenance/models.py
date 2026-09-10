"""
MachineCare Maintenance Module - Models & Domain Entities
"""

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any

@dataclass
class WorkOrderEntity:
    id: str
    organization_id: str
    work_order_number: str
    asset_id: str
    title: str
    description: Optional[str] = None
    priority: str = "medium"  # low, medium, high, critical
    status: str = "open"      # open, in_progress, pending_approval, completed, cancelled
    assigned_to: Optional[str] = None
    estimated_cost: float = 0.0
    actual_cost: float = 0.0
    requires_approval: bool = False
    approved_by: Optional[str] = None
    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    completed_at: Optional[str] = None

@dataclass
class PMScheduleEntity:
    id: str
    organization_id: str
    asset_id: str
    title: str
    frequency_type: str = "time"  # time, meter
    interval_days: Optional[int] = 30
    interval_meter_units: Optional[float] = None
    last_completed_at: Optional[str] = None
    next_due_at: Optional[str] = None
    is_active: bool = True
