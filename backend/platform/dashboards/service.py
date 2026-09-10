"""
MachineCare Platform - Dynamic Dashboard Configuration
Supports KPI, table, chart, trend, alerts widgets customizable per tenant.
"""

from dataclasses import dataclass, field
from typing import Dict, List, Any, Optional

@dataclass
class WidgetConfig:
    id: str
    widget_type: str  # kpi, chart, table, trend, alerts
    title: str
    data_source: str  # assets, work_orders, oee, inventory, fleet
    layout_col_span: int = 1

@dataclass
class DashboardLayout:
    id: str
    organization_id: str
    role: str  # manager, engineer, technician, viewer
    widgets: List[WidgetConfig] = field(default_factory=list)

class DashboardService:
    def __init__(self):
        self._layouts: Dict[str, DashboardLayout] = {}

    def save_layout(self, layout: DashboardLayout) -> DashboardLayout:
        key = f"{layout.organization_id}_{layout.role}"
        self._layouts[key] = layout
        return layout

    def get_layout(self, organization_id: str, role: str) -> Optional[DashboardLayout]:
        return self._layouts.get(f"{organization_id}_{role}")
