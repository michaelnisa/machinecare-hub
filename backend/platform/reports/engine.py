"""
MachineCare Platform - Reusable Report Engine
Supports column definitions, filters, sorting, grouping, and exports.
"""

from dataclasses import dataclass, field
from typing import Dict, List, Any, Optional

@dataclass
class ReportFilter:
    column: str
    operator: str  # eq, gte, lte, in
    value: Any

@dataclass
class ReportDefinition:
    id: str
    organization_id: str
    name: str
    data_source: str  # assets, work_orders, fuel_logs, downtime
    columns: List[str]
    filters: List[ReportFilter] = field(default_factory=list)
    group_by: Optional[str] = None
    sort_by: Optional[str] = None
    sort_order: str = "desc"

class ReportEngine:
    @staticmethod
    def execute_query(data: List[Dict[str, Any]], definition: ReportDefinition) -> List[Dict[str, Any]]:
        results = []
        for row in data:
            match = True
            for flt in definition.filters:
                row_val = row.get(flt.column)
                if flt.operator == "eq" and row_val != flt.value:
                    match = False
                    break
                elif flt.operator == "gte" and (row_val is None or row_val < flt.value):
                    match = False
                    break
            if match:
                # Project specified columns
                projected = {col: row.get(col) for col in definition.columns if col in row}
                results.append(projected)
        return results
