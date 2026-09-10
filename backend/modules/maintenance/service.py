"""
MachineCare Maintenance Module - Public Service Interface
Demonstrates loose coupling: requests parts check through InventoryService,
and checks asset validity through AssetService without manipulating their tables directly.
"""

from typing import Dict, Optional, List
from .models import WorkOrderEntity, PMScheduleEntity
from backend.modules.assets.service import AssetService
from backend.modules.inventory.service import InventoryService

class MaintenanceService:
    def __init__(
        self,
        asset_service: Optional[AssetService] = None,
        inventory_service: Optional[InventoryService] = None,
    ):
        self.asset_service = asset_service
        self.inventory_service = inventory_service
        self._work_orders: Dict[str, WorkOrderEntity] = {}
        self._schedules: Dict[str, PMScheduleEntity] = {}

    def create_work_order(self, wo: WorkOrderEntity) -> WorkOrderEntity:
        # Validate asset through AssetService if available
        if self.asset_service:
            asset = self.asset_service.get_asset(wo.organization_id, wo.asset_id)
            if not asset:
                raise ValueError(f"Asset '{wo.asset_id}' does not exist in organization.")
        
        # Check if cost requires managerial approval threshold (e.g. > 5M TZS)
        if wo.estimated_cost >= 5_000_000:
            wo.requires_approval = True
            wo.status = "pending_approval"

        self._work_orders[wo.id] = wo
        return wo

    def check_spare_parts_available(self, organization_id: str, part_id: str, quantity: float) -> bool:
        """Section 7: Uses InventoryService public contract."""
        if not self.inventory_service:
            return True
        return self.inventory_service.check_part_availability(organization_id, part_id, quantity)

    def approve_work_order(self, wo_id: str, approved_by_user_id: str) -> WorkOrderEntity:
        if wo_id not in self._work_orders:
            raise ValueError(f"Work Order {wo_id} not found")
        wo = self._work_orders[wo_id]
        wo.approved_by = approved_by_user_id
        wo.requires_approval = False
        wo.status = "open"
        return wo

    def get_work_order(self, organization_id: str, wo_id: str) -> Optional[WorkOrderEntity]:
        wo = self._work_orders.get(wo_id)
        if wo and wo.organization_id == organization_id:
            return wo
        return None
