"""
MachineCare ERP Integration Platform - Base Connector Interface
Defines the standard abstract contract that every ERP connector must implement.
"""

from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional
from dataclasses import dataclass, field

@dataclass
class ConnectorCapabilities:
    read: List[str] = field(default_factory=list)
    write: List[str] = field(default_factory=list)
    supports_webhooks: bool = False
    supports_delta_sync: bool = True
    supports_batching: bool = True
    rate_limit_per_minute: int = 120

    def to_dict(self) -> Dict[str, Any]:
        return {
            "read": self.read,
            "write": self.write,
            "supports_webhooks": self.supports_webhooks,
            "supports_delta_sync": self.supports_delta_sync,
            "supports_batching": self.supports_batching,
            "rate_limit_per_minute": self.rate_limit_per_minute,
        }

@dataclass
class ConnectionTestResult:
    success: bool
    status_code: int = 200
    message: str = "Connection successful"
    latency_ms: float = 0.0
    company_name: Optional[str] = None
    server_version: Optional[str] = None
    details: Dict[str, Any] = field(default_factory=dict)

class ERPConnector(ABC):
    """
    Abstract base class for all ERP adapters.
    Connectors translate between ERP-specific APIs and MachineCare canonical representations.
    """

    def __init__(self, config: Dict[str, Any], credentials: Dict[str, Any]):
        self.config = config
        self.credentials = credentials
        self.base_url = config.get("base_url", "").rstrip("/")
        self.company_identifier = config.get("company_identifier", "")

    @abstractmethod
    def get_capabilities(self) -> ConnectorCapabilities:
        """Returns declared capability matrix for this connector."""
        pass

    @abstractmethod
    async def test_connection(self) -> ConnectionTestResult:
        """Pings external system and validates authentication."""
        pass

    @abstractmethod
    async def get_company_info(self) -> Dict[str, Any]:
        """Retrieves tenant/company metadata from the ERP."""
        pass

    # Inbound Read Methods
    async def fetch_customers(self, cursor: Optional[str] = None, limit: int = 100) -> List[Dict[str, Any]]:
        raise NotImplementedError("fetch_customers not supported by this connector")

    async def fetch_suppliers(self, cursor: Optional[str] = None, limit: int = 100) -> List[Dict[str, Any]]:
        raise NotImplementedError("fetch_suppliers not supported by this connector")

    async def fetch_assets(self, cursor: Optional[str] = None, limit: int = 100) -> List[Dict[str, Any]]:
        raise NotImplementedError("fetch_assets not supported by this connector")

    async def fetch_parts(self, cursor: Optional[str] = None, limit: int = 100) -> List[Dict[str, Any]]:
        raise NotImplementedError("fetch_parts not supported by this connector")

    async def fetch_inventory(self, warehouse_id: Optional[str] = None, limit: int = 100) -> List[Dict[str, Any]]:
        raise NotImplementedError("fetch_inventory not supported by this connector")

    async def fetch_purchase_orders(self, cursor: Optional[str] = None, limit: int = 100) -> List[Dict[str, Any]]:
        raise NotImplementedError("fetch_purchase_orders not supported by this connector")

    async def fetch_production_orders(self, cursor: Optional[str] = None, limit: int = 100) -> List[Dict[str, Any]]:
        raise NotImplementedError("fetch_production_orders not supported by this connector")

    # Outbound Write Methods
    async def create_purchase_request(self, canonical_data: Dict[str, Any]) -> Dict[str, Any]:
        raise NotImplementedError("create_purchase_request not supported by this connector")

    async def send_maintenance_cost(self, canonical_data: Dict[str, Any]) -> Dict[str, Any]:
        raise NotImplementedError("send_maintenance_cost not supported by this connector")

    async def push_production_result(self, canonical_data: Dict[str, Any]) -> Dict[str, Any]:
        raise NotImplementedError("push_production_result not supported by this connector")

    async def create_webhook(self, target_url: str, subscribed_events: List[str]) -> Dict[str, Any]:
        raise NotImplementedError("create_webhook not supported by this connector")
