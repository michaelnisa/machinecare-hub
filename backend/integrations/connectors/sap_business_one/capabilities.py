"""
MachineCare ERP Integration Platform - SAP Business One Capabilities
"""

from backend.integrations.core.base import ConnectorCapabilities

def get_sap_capabilities() -> ConnectorCapabilities:
    return ConnectorCapabilities(
        read=[
            "customers",
            "suppliers",
            "parts",
            "items",
            "inventory",
            "warehouses",
            "assets",
            "purchase_orders",
            "production_orders",
        ],
        write=[
            "purchase_requests",
            "maintenance_costs",
            "production_results",
        ],
        supports_webhooks=False,  # SAP B1 typically uses polling or B1iSN
        supports_delta_sync=True,
        supports_batching=True,
        rate_limit_per_minute=180,
    )
