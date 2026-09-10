"""
MachineCare Core - Tenant Configuration Models
"""

from dataclasses import dataclass, field
from typing import Dict, Any, List

@dataclass
class NumberingPrefixConfig:
    work_order_prefix: str = "WO-"
    purchase_request_prefix: str = "PR-"
    purchase_order_prefix: str = "PO-"
    part_prefix: str = "PRT-"
    job_prefix: str = "JOB-"
    invoice_prefix: str = "INV-"

@dataclass
class LocalizationConfig:
    default_language: str = "en"  # en, sw
    date_format: str = "YYYY-MM-DD"
    time_format: str = "24h"
    default_currency: str = "TZS"

@dataclass
class TenantConfig:
    organization_id: str
    numbering: NumberingPrefixConfig = field(default_factory=NumberingPrefixConfig)
    localization: LocalizationConfig = field(default_factory=LocalizationConfig)
    enabled_modules: List[str] = field(
        default_factory=lambda: [
            "assets",
            "maintenance",
            "production",
            "inventory",
            "fleet",
            "safety",
            "workshop",
            "connected_data",
        ]
    )
    operational_preferences: Dict[str, Any] = field(default_factory=dict)
