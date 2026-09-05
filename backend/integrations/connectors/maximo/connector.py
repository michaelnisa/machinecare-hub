"""
MachineCare ERP Integration Platform - IBM Maximo Connector
EAM integration adapter supporting OSLC NextGen REST APIs.
"""

import time
from typing import Any, Dict, List, Optional
from backend.integrations.core.base import ERPConnector, ConnectorCapabilities, ConnectionTestResult
from backend.integrations.connectors.maximo.auth import MaximoAuth
from backend.integrations.connectors.maximo.client import MaximoOSLCClient
from backend.integrations.connectors.maximo.models import MaximoObjectStructures
from backend.integrations.connectors.maximo.capabilities import get_maximo_capabilities

class MaximoConnector(ERPConnector):
    """Full implementation of ERPConnector for IBM Maximo EAM."""

    def __init__(self, config: Dict[str, Any], credentials: Dict[str, Any], client: Optional[MaximoOSLCClient] = None):
        super().__init__(config, credentials)
        self.site_id = config.get("company_identifier") or config.get("site_id") or "BEDFORD"
        self.org_id = config.get("org_id") or "EAGLE_MINING"
        self.auth = MaximoAuth(
            api_key=credentials.get("api_key"),
            username=credentials.get("username"),
            password=credentials.get("password"),
            site_id=self.site_id,
            org_id=self.org_id,
        )
        self.client = client or MaximoOSLCClient(self.base_url, self.auth, site_id=self.site_id)

    def get_capabilities(self) -> ConnectorCapabilities:
        return get_maximo_capabilities()

    async def test_connection(self) -> ConnectionTestResult:
        """Pings Maximo OSLC endpoint and queries MXASSET with pageSize=1."""
        start_time = time.time()
        try:
            if not self.auth.validate():
                return ConnectionTestResult(
                    success=False,
                    status_code=401,
                    message="Maximo authentication failed: Missing API Key or Username/Password",
                    latency_ms=0,
                )

            records = self.client.query(
                MaximoObjectStructures.MXASSET,
                select=["assetnum", "description", "siteid"],
                page_size=1,
            )
            latency = (time.time() - start_time) * 1000

            return ConnectionTestResult(
                success=True,
                status_code=200,
                message="Successfully authenticated to IBM Maximo OSLC REST API",
                latency_ms=round(latency, 2),
                company_name=f"Maximo Site: {self.site_id} ({self.org_id})",
                server_version="IBM Maximo Manage / Application Suite 8.11+ OSLC",
                details={"site_id": self.site_id, "auth_mode": "api_key" if self.auth.api_key else "maxauth"},
            )
        except Exception as e:
            latency = (time.time() - start_time) * 1000
            return ConnectionTestResult(
                success=False,
                status_code=400,
                message=f"Maximo connection failed: {str(e)}",
                latency_ms=round(latency, 2),
            )

    async def get_company_info(self) -> Dict[str, Any]:
        return {
            "name": f"IBM Maximo - Site {self.site_id}",
            "site_id": self.site_id,
            "org_id": self.org_id,
            "system_type": "EAM",
        }

    # Inbound Read Operations
    async def fetch_assets(self, cursor: Optional[str] = None, limit: int = 100) -> List[Dict[str, Any]]:
        return self.client.query(
            MaximoObjectStructures.MXASSET,
            select=["assetnum", "description", "siteid", "orgid", "serialnum", "status", "location", "vendor", "installdate", "totdowntime", "parent"],
            page_size=limit,
        )

    async def fetch_parts(self, cursor: Optional[str] = None, limit: int = 100) -> List[Dict[str, Any]]:
        return self.client.query(
            MaximoObjectStructures.MXITEM,
            select=["itemnum", "description", "itemsetid", "status", "orderunit", "issueunit", "curbaltotal", "lastcost"],
            page_size=limit,
        )

    async def fetch_inventory(self, warehouse_id: Optional[str] = None, limit: int = 100) -> List[Dict[str, Any]]:
        where = f'location="{warehouse_id}"' if warehouse_id else None
        return self.client.query(
            MaximoObjectStructures.MXINVENTORY,
            where=where,
            select=["itemnum", "location", "siteid", "curbal", "binnum", "lotnum", "avgcost"],
            page_size=limit,
        )

    async def fetch_work_orders(self, cursor: Optional[str] = None, limit: int = 100) -> List[Dict[str, Any]]:
        return self.client.query(
            MaximoObjectStructures.MXWO,
            select=["wonum", "description", "siteid", "status", "worktype", "assetnum", "location", "wopriority", "schedstart", "schedfinish", "actlabcost", "actmatcost", "acttotalcost", "pmnum", "jpnum"],
            page_size=limit,
        )

    # Outbound Write Operations
    async def post_meter_reading(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Sends continuous run-hours, vibration, or temperature to Maximo MXMETERDATA."""
        return self.client.create_record(MaximoObjectStructures.MXMETERDATA, payload)

    async def create_service_request(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Creates an emergency service request in Maximo (MXSR) when MachineCare detects anomalies."""
        return self.client.create_record(MaximoObjectStructures.MXSR, payload)

    async def update_work_order_actuals(self, wonum: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Updates Maximo work order with technician actual labor hours, material cost, and completion status."""
        return self.client.create_record(MaximoObjectStructures.MXWO, payload)
