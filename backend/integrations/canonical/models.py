"""
MachineCare ERP Integration Platform - Canonical Domain Models
Defines enterprise-standard canonical models completely independent of any ERP.
"""

from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from typing import Dict, List, Any, Optional

def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

@dataclass
class BaseCanonicalEntity:
    """Base class for all MachineCare canonical entities."""
    id: str
    organization_id: str
    source_system: str = "machinecare"
    external_ids: Dict[str, Optional[str]] = field(default_factory=dict)
    sync_status: str = "synced"  # synced, pending, conflict, error
    created_at: str = field(default_factory=now_iso)
    updated_at: str = field(default_factory=now_iso)
    last_synced_at: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]):
        return cls(**{k: v for k, v in data.items() if k in cls.__dataclass_fields__})

@dataclass
class Asset(BaseCanonicalEntity):
    name: str = ""
    asset_code: str = ""
    asset_type: str = "equipment"
    asset_category: Optional[str] = None
    manufacturer: Optional[str] = None
    model: Optional[str] = None
    serial_number: Optional[str] = None
    commission_date: Optional[str] = None
    status: str = "active"  # active, inactive, maintenance, retired
    location: Optional[str] = None
    site_id: Optional[str] = None
    department: Optional[str] = None
    operating_hours: float = 0.0
    parent_asset_id: Optional[str] = None
    hierarchy_path: Optional[str] = None

@dataclass
class Part(BaseCanonicalEntity):
    part_number: str = ""
    name: str = ""
    description: Optional[str] = None
    unit: str = "PCS"
    category: Optional[str] = None
    available_quantity: float = 0.0
    reserved_quantity: float = 0.0
    min_reorder_level: float = 0.0
    warehouse_id: Optional[str] = None
    unit_cost: float = 0.0
    currency: str = "TZS"
    barcode: Optional[str] = None

@dataclass
class InventoryItem(BaseCanonicalEntity):
    part_id: str = ""
    warehouse_id: str = ""
    batch_number: Optional[str] = None
    location_in_warehouse: Optional[str] = None
    quantity: float = 0.0
    unit_cost: float = 0.0
    expiry_date: Optional[str] = None

@dataclass
class Warehouse(BaseCanonicalEntity):
    code: str = ""
    name: str = ""
    location: Optional[str] = None
    site_id: Optional[str] = None
    is_quarantine: bool = False
    is_active: bool = True

@dataclass
class InventoryBalance(BaseCanonicalEntity):
    part_id: str = ""
    warehouse_id: str = ""
    available_quantity: float = 0.0
    reserved_quantity: float = 0.0
    on_order_quantity: float = 0.0
    last_updated_at: str = field(default_factory=now_iso)

@dataclass
class PurchaseRequestItem:
    part_number: str
    name: str
    quantity: float
    unit: str = "PCS"
    estimated_cost: float = 0.0
    notes: Optional[str] = None

@dataclass
class PurchaseRequest(BaseCanonicalEntity):
    request_number: str = ""
    requested_by: str = ""
    items: List[Dict[str, Any]] = field(default_factory=list)
    priority: str = "normal"  # low, normal, high, critical
    status: str = "pending"   # draft, pending, approved, sent, completed, cancelled
    source: str = "machinecare"
    notes: Optional[str] = None
    currency: str = "TZS"
    total_estimated_amount: float = 0.0

@dataclass
class PurchaseOrder(BaseCanonicalEntity):
    order_number: str = ""
    supplier_id: Optional[str] = None
    supplier_name: Optional[str] = None
    items: List[Dict[str, Any]] = field(default_factory=list)
    status: str = "draft"  # draft, ordered, partially_received, received, cancelled
    currency: str = "TZS"
    total_amount: float = 0.0
    order_date: Optional[str] = None
    expected_delivery_date: Optional[str] = None

@dataclass
class ProductionOrder(BaseCanonicalEntity):
    order_number: str = ""
    product_id: str = ""
    product_name: Optional[str] = None
    target_quantity: float = 0.0
    actual_quantity: float = 0.0
    scrap_quantity: float = 0.0
    downtime_minutes: float = 0.0
    status: str = "planned"  # planned, running, completed, cancelled
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    line_id: Optional[str] = None

@dataclass
class WorkOrder(BaseCanonicalEntity):
    work_order_number: str = ""
    asset_id: str = ""
    title: str = ""
    description: Optional[str] = None
    priority: str = "medium"  # low, medium, high, urgent
    status: str = "open"      # open, in_progress, completed, closed
    work_type: str = "CM"     # PM (Preventive), CM (Corrective), EM (Emergency), CBM (Condition-based)
    job_plan_id: Optional[str] = None
    pm_number: Optional[str] = None
    location_id: Optional[str] = None
    assigned_to: Optional[str] = None
    start_date: Optional[str] = None
    completed_date: Optional[str] = None
    total_cost: float = 0.0
    currency: str = "TZS"

@dataclass
class MeterReading(BaseCanonicalEntity):
    """Canonical model for IoT, CAN-bus, sensor, and run-hour readings sent to EAM."""
    asset_id: str = ""
    meter_name: str = ""       # RUNHOURS, ENGINE_TEMP, VIBRATION, ODOMETER
    reading_value: float = 0.0
    reading_type: str = "CONTINUOUS"  # CONTINUOUS, GAUGE, CHARACTERISTIC
    unit: str = "HOURS"        # HOURS, CELSIUS, MM_S, KM, PSI
    reading_date: str = field(default_factory=now_iso)
    delta_value: Optional[float] = None
    device_id: Optional[str] = None
    inspector_id: Optional[str] = None

@dataclass
class MaintenanceCost(BaseCanonicalEntity):
    work_order_id: str = ""
    asset_id: str = ""
    parts_cost: float = 0.0
    labor_cost: float = 0.0
    external_cost: float = 0.0
    total_cost: float = 0.0
    currency: str = "TZS"
    cost_center_id: Optional[str] = None
    date: str = field(default_factory=now_iso)
    notes: Optional[str] = None

@dataclass
class Customer(BaseCanonicalEntity):
    customer_code: str = ""
    name: str = ""
    contact_person: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    tax_identifier: Optional[str] = None
    currency: str = "TZS"

@dataclass
class Supplier(BaseCanonicalEntity):
    supplier_code: str = ""
    name: str = ""
    contact_person: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    tax_identifier: Optional[str] = None
    payment_terms: Optional[str] = None

@dataclass
class Site(BaseCanonicalEntity):
    code: str = ""
    name: str = ""
    location: Optional[str] = None
    customer_id: Optional[str] = None
    is_active: bool = True

@dataclass
class CostCenter(BaseCanonicalEntity):
    code: str = ""
    name: str = ""
    description: Optional[str] = None
    is_active: bool = True

@dataclass
class Employee(BaseCanonicalEntity):
    employee_code: str = ""
    full_name: str = ""
    email: Optional[str] = None
    department: Optional[str] = None
    role: Optional[str] = None

@dataclass
class Document(BaseCanonicalEntity):
    title: str = ""
    document_type: str = ""
    file_url: str = ""
    entity_reference_type: Optional[str] = None
    entity_reference_id: Optional[str] = None
