"""
MachineCare Production Module - Models & Domain Entities
"""

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Optional

@dataclass
class ProductionOrderEntity:
    id: str
    organization_id: str
    order_number: str
    product_name: str
    planned_quantity: float
    produced_quantity: float = 0.0
    scrap_quantity: float = 0.0
    status: str = "planned"  # planned, running, paused, completed
    line_name: Optional[str] = None
    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

@dataclass
class DowntimeEventEntity:
    id: str
    organization_id: str
    line_name: str
    reason: str
    duration_minutes: float
    is_planned: bool = False
    recorded_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class ProductionService:
    def __init__(self):
        self._orders = {}
        self._downtime_events = []

    def save_order(self, order: ProductionOrderEntity) -> ProductionOrderEntity:
        self._orders[order.id] = order
        return order

    def log_downtime(self, event: DowntimeEventEntity) -> DowntimeEventEntity:
        self._downtime_events.append(event)
        return event

    def calculate_oee(self, availability: float, performance: float, quality: float) -> float:
        """Calculates standard Overall Equipment Effectiveness: A * P * Q"""
        return round(availability * performance * quality * 100, 2)
