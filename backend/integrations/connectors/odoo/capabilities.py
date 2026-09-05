"""
MachineCare ERP Integration Platform - Odoo Capabilities Matrix
"""

from backend.integrations.core.base import ConnectorCapabilities

def get_odoo_capabilities() -> ConnectorCapabilities:
    return ConnectorCapabilities(
        read=[
            "customers",
            "suppliers",
            "parts",
            "products",
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
            "inventory_adjustments",
        ],
        supports_webhooks=True,
        supports_delta_sync=True,
        supports_batching=True,
        rate_limit_per_minute=240,
    )
