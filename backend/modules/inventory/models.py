"""
MachineCare Inventory Module - Models & Domain Entities
"""

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Optional

@dataclass
class PartEntity:
    id: str
    organization_id: str
    part_number: str
    name: str
    unit: str = "PCS"
    quantity_on_hand: float = 0.0
    quantity_reserved: float = 0.0
    min_reorder_point: float = 0.0
    unit_cost: float = 0.0
    currency: str = "TZS"

@dataclass
class MaterialRequestEntity:
    id: str
    organization_id: str
    work_order_id: Optional[str]
    part_id: str
    quantity: float
    status: str = "pending"  # pending, approved, issued, rejected
    requested_by: str = ""
    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
