"""
MachineCare ERP Integration Platform - IBM Maximo Capabilities Declaration
"""

from backend.integrations.core.base import ConnectorCapabilities

def get_maximo_capabilities() -> ConnectorCapabilities:
    """Returns declared capabilities for IBM Maximo EAM integration."""
    return ConnectorCapabilities(
        read=[
            "assets",
            "work_orders",
            "locations",
            "parts",
            "inventory",
            "pm_schedules",
            "job_plans",
        ],
        write=[
            "meter_readings",
            "service_requests",
            "work_orders",
            "work_order_actuals",
            "maintenance_costs",
        ],
        supports_webhooks=True,
        supports_delta_sync=True,
        supports_batching=True,
        rate_limit_per_minute=300,
    )
