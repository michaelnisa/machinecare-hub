"""
MachineCare Platform - Custom Fields Architecture
Allows customers to define custom fields without altering core database tables.
"""

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any

ALLOWED_FIELD_TYPES = {
    "text", "number", "decimal", "boolean", "date",
    "datetime", "select", "multi_select", "user",
    "asset", "part", "file", "url"
}

@dataclass
class CustomFieldDefinition:
    id: str
    organization_id: str
    entity_type: str  # 'asset', 'work_order', 'part', 'vendor', 'vehicle'
    field_key: str    # e.g. 'pit_number', 'equipment_class'
    field_label: str  # e.g. 'Pit Number', 'Equipment Class'
    field_type: str   # from ALLOWED_FIELD_TYPES
    is_required: bool = False
    default_value: Any = None
    options: List[str] = field(default_factory=list)  # for select, multi_select
    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

    def __post_init__(self):
        if self.field_type not in ALLOWED_FIELD_TYPES:
            raise ValueError(f"Unsupported custom field type: {self.field_type}")

@dataclass
class CustomFieldValue:
    id: str
    organization_id: str
    field_definition_id: str
    entity_id: str
    value: Any
    updated_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
