"""
MachineCare Inventory Module - Public Service Interface
Provides public methods for other modules (e.g. Maintenance) to query parts availability
without direct table manipulation.
"""

from typing import Dict, Optional, List
from .models import PartEntity, MaterialRequestEntity

class InventoryService:
    def __init__(self):
        self._parts: Dict[str, PartEntity] = {}
        self._requests: Dict[str, MaterialRequestEntity] = {}

    def save_part(self, part: PartEntity) -> PartEntity:
        self._parts[part.id] = part
        return part

    def get_part(self, organization_id: str, part_id: str) -> Optional[PartEntity]:
        part = self._parts.get(part_id)
        if part and part.organization_id == organization_id:
            return part
        return None

    def check_part_availability(self, organization_id: str, part_id: str, required_qty: float) -> bool:
        """Section 7: Public service method for Maintenance to check parts."""
        part = self.get_part(organization_id, part_id)
        if not part:
            return False
        available = part.quantity_on_hand - part.quantity_reserved
        return available >= required_qty

    def reserve_part(self, organization_id: str, part_id: str, qty: float) -> bool:
        """Reserves a part for a work order."""
        if not self.check_part_availability(organization_id, part_id, qty):
            return False
        part = self._parts[part_id]
        part.quantity_reserved += qty
        return True

    def create_material_request(self, request: MaterialRequestEntity) -> MaterialRequestEntity:
        self._requests[request.id] = request
        return request
