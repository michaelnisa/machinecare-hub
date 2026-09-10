"""
MachineCare Platform - Organization-Level Feature Flag Service
Replaces hardcoded customer names or fixed industry enums with capability checks.
"""

from typing import Dict, Set

DEFAULT_FEATURES = {
    "assets": True,
    "maintenance": True,
    "inventory": True,
    "production": True,
    "fleet": True,
    "safety": True,
    "workshop": True,
    "connected_data": True,
    "custom_fields": True,
    "advanced_analytics": False,
    "erp_integrations": True,
}

class FeatureFlagService:
    def __init__(self):
        # organization_id -> { feature_name: bool }
        self._org_flags: Dict[str, Dict[str, bool]] = {}

    def is_feature_enabled(self, organization_id: str, feature_key: str) -> bool:
        """
        Determines whether a capability or feature is active for the given organization.
        Never checks customer name or ID directly in application logic.
        """
        org_settings = self._org_flags.get(organization_id, {})
        if feature_key in org_settings:
            return org_settings[feature_key]
        return DEFAULT_FEATURES.get(feature_key, False)

    def set_feature(self, organization_id: str, feature_key: str, enabled: bool) -> None:
        if organization_id not in self._org_flags:
            self._org_flags[organization_id] = dict(DEFAULT_FEATURES)
        self._org_flags[organization_id][feature_key] = enabled
