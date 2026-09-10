"""
MachineCare Safety (HSE) Module - Models & Domain Entities
"""

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Optional, Dict

@dataclass
class IncidentReportEntity:
    id: str
    organization_id: str
    title: str
    severity: str  # near_miss, low, medium, high, fatal
    description: str
    reported_by: str
    reported_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

@dataclass
class PermitToWorkEntity:
    id: str
    organization_id: str
    permit_number: str
    work_order_id: Optional[str]
    permit_type: str  # hot_work, confined_space, working_at_height, electrical
    status: str = "draft"  # draft, approved, active, closed
    approved_by: Optional[str] = None

class SafetyService:
    def __init__(self):
        self._incidents: Dict[str, IncidentReportEntity] = {}
        self._permits: Dict[str, PermitToWorkEntity] = {}

    def report_incident(self, incident: IncidentReportEntity) -> IncidentReportEntity:
        self._incidents[incident.id] = incident
        return incident

    def create_ptw(self, permit: PermitToWorkEntity) -> PermitToWorkEntity:
        self._permits[permit.id] = permit
        return permit

    def approve_ptw(self, permit_id: str, approver_id: str) -> PermitToWorkEntity:
        if permit_id not in self._permits:
            raise ValueError("Permit not found")
        ptw = self._permits[permit_id]
        ptw.approved_by = approver_id
        ptw.status = "approved"
        return ptw
