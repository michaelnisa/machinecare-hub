"""
Sample Enterprise Customer Extension: XYZ Mining Operations
Demonstrates how customer-specific custom logic (e.g. pit blast safety checks, ore tonnage calculations)
lives in an isolated package and only runs when registered for an organization.
"""

from backend.platform.extensions.registry import ExtensionPackage

def calculate_haul_cycle_efficiency(tonnage: float, haul_time_minutes: float) -> float:
    if haul_time_minutes <= 0:
        return 0.0
    return round((tonnage / (haul_time_minutes / 60)), 2)

xyz_mining_extension = (
    ExtensionPackage(
        key="xyz_mining",
        name="XYZ Mining Operations Pack",
        version="1.0.0",
        description="Mining pit tracking, blast safety permits, and haul cycle telemetry.",
    )
    .add_capability("mining_dashboard")
    .add_capability("haul_cycle_calculator")
    .register_handler("on_haul_cycle", calculate_haul_cycle_efficiency)
)
