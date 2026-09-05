"""
MachineCare ERP Integration Platform - Microsoft Dynamics 365 Business Central Capabilities
"""

from backend.integrations.core.base import ConnectorCapabilities

def get_dynamics_capabilities() -> ConnectorCapabilities:
    return ConnectorCapabilities(
        read=[
            "customers",
            "suppliers",
            "vendors",
            "parts",
            "items",
            "inventory",
            "locations",
            "assets",
            "purchase_orders",
            "production_orders",
        ],
        write=[
            "purchase_requests",
            "maintenance_costs",
            "production_results",
        ],
        supports_webhooks=True,
        supports_delta_sync=True,
        supports_batching=True,
        rate_limit_per_minute=300,
    )
