"""
MachineCare Platform - Tenant-Isolated Audit Logging
"""

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List

@dataclass
class AuditLogEntry:
    id: str
    organization_id: str
    user_id: str
    action: str  # create, update, delete, approve, export
    resource: str  # work_order, asset, part, ptw, job
    resource_id: str
    before_state: Optional[Dict[str, Any]] = None
    after_state: Optional[Dict[str, Any]] = None
    timestamp: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class AuditService:
    def __init__(self):
        self._logs: Dict[str, List[AuditLogEntry]] = {}

    def log(self, entry: AuditLogEntry) -> AuditLogEntry:
        if entry.organization_id not in self._logs:
            self._logs[entry.organization_id] = []
        self._logs[entry.organization_id].append(entry)
        return entry

    def get_audit_trail(self, organization_id: str, resource: Optional[str] = None) -> List[AuditLogEntry]:
        """Strictly tenant-isolated log lookup."""
        logs = self._logs.get(organization_id, [])
        if resource:
            return [l for l in logs if l.resource == resource]
        return list(logs)
