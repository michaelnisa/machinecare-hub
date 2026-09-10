"""
MachineCare Core - Configuration Service
"""

from typing import Dict, Optional
from .models import TenantConfig

class ConfigurationService:
    def __init__(self):
        self._configs: Dict[str, TenantConfig] = {}

    def get_tenant_config(self, organization_id: str) -> TenantConfig:
        if organization_id not in self._configs:
            self._configs[organization_id] = TenantConfig(organization_id=organization_id)
        return self._configs[organization_id]

    def update_tenant_config(self, config: TenantConfig) -> TenantConfig:
        self._configs[config.organization_id] = config
        return config

    def is_module_enabled(self, organization_id: str, module_name: str) -> bool:
        config = self.get_tenant_config(organization_id)
        return module_name in config.enabled_modules
