"""
MachineCare Core - Organization & Multi-Tenancy Models
"""

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Dict, Any, Optional, List

@dataclass
class OrganizationSettings:
    currency: str = "TZS"
    default_tax_rate_percent: float = 18.0
    timezone: str = "Africa/Dar_es_Salaam"
    business_hours: Dict[str, Any] = field(default_factory=dict)
    accepted_payment_methods: List[str] = field(default_factory=lambda: ["cash", "bank_transfer", "mobile_money"])
    default_labour_rate_per_hour: float = 0.0

@dataclass
class Organization:
    id: str
    name: str
    industry_profile: str = "mixed"  # manufacturing, fleet_logistics, garage, mixed
    plan: str = "standard"           # lite, standard, enterprise
    logo_url: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    settings: OrganizationSettings = field(default_factory=OrganizationSettings)
    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    is_active: bool = True

@dataclass
class OrganizationMembership:
    id: str
    organization_id: str
    user_id: str
    role: str = "viewer"  # owner, manager, engineer, technician, viewer
    department: Optional[str] = None
    joined_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
