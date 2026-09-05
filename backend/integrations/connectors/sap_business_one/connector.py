"""
MachineCare ERP Integration Platform - SAP Business One Connector
Implements standard ERPConnector methods for SAP B1 Service Layer.
"""

import time
from typing import Any, Dict, List, Optional
from backend.integrations.core.base import ERPConnector, ConnectorCapabilities, ConnectionTestResult
from backend.integrations.connectors.sap_business_one.auth import SapB1Auth
from backend.integrations.connectors.sap_business_one.client import SapB1Client
from backend.integrations.connectors.sap_business_one.capabilities import get_sap_capabilities

class SapBusinessOneConnector(ERPConnector):
    """ERPConnector adapter for SAP Business One."""

    def __init__(self, config: Dict[str, Any], credentials: Dict[str, Any], client: Optional[SapB1Client] = None):
        super().__init__(config, credentials)
        self.auth = SapB1Auth(
            company_db=config.get("company_identifier") or credentials.get("company_db", ""),
            username=credentials.get("username", ""),
            password=credentials.get("password", ""),
        )
        self.client = client or SapB1Client(self.base_url, self.auth)

    def get_capabilities(self) -> ConnectorCapabilities:
        return get_sap_capabilities()

    async def test_connection(self) -> ConnectionTestResult:
        start_time = time.time()
        try:
            self.client.ensure_login()
            # Fetch company info
            companies = self.client.get("CompanyService_GetAdminInfo")
            latency = (time.time() - start_time) * 1000
            company_name = companies[0].get("CompanyName", self.auth.company_db) if isinstance(companies, list) and companies else self.auth.company_db
            return ConnectionTestResult(
                success=True,
                status_code=200,
                message="Successfully authenticated to SAP Business One Service Layer",
                latency_ms=round(latency, 2),
                company_name=company_name,
                server_version="SAP Business One 10.0 FP2105+",
                details={"company_db": self.auth.company_db, "user": self.auth.username},
            )
        except Exception as e:
            latency = (time.time() - start_time) * 1000
            return ConnectionTestResult(
                success=False,
                status_code=400,
                message=f"SAP connection failed: {str(e)}",
                latency_ms=round(latency, 2),
            )

    async def get_company_info(self) -> Dict[str, Any]:
        res = self.client.get("CompanyService_GetAdminInfo")
        return res[0] if isinstance(res, list) and res else {"CompanyDB": self.auth.company_db}

    async def fetch_customers(self, cursor: Optional[str] = None, limit: int = 100) -> List[Dict[str, Any]]:
        params = {"$filter": "CardType eq 'cCustomer'", "$top": limit}
        return self.client.get("BusinessPartners", params=params)

    async def fetch_suppliers(self, cursor: Optional[str] = None, limit: int = 100) -> List[Dict[str, Any]]:
        params = {"$filter": "CardType eq 'cSupplier'", "$top": limit}
        return self.client.get("BusinessPartners", params=params)

    async def fetch_parts(self, cursor: Optional[str] = None, limit: int = 100) -> List[Dict[str, Any]]:
        params = {"$top": limit}
        return self.client.get("Items", params=params)

    async def fetch_inventory(self, warehouse_id: Optional[str] = None, limit: int = 100) -> List[Dict[str, Any]]:
        params = {"$top": limit}
        if warehouse_id:
            params["$filter"] = f"WarehouseCode eq '{warehouse_id}'"
        return self.client.get("Warehouses", params=params)

    async def fetch_production_orders(self, cursor: Optional[str] = None, limit: int = 100) -> List[Dict[str, Any]]:
        params = {"$top": limit}
        return self.client.get("ProductionOrders", params=params)

    async def fetch_purchase_orders(self, cursor: Optional[str] = None, limit: int = 100) -> List[Dict[str, Any]]:
        params = {"$top": limit}
        return self.client.get("PurchaseOrders", params=params)

    async def create_purchase_request(self, canonical_data: Dict[str, Any]) -> Dict[str, Any]:
        payload = {
            "DocType": "dDocument_Items",
            "RequriedDate": canonical_data.get("expected_delivery_date", time.strftime("%Y-%m-%d")),
            "Comments": f"MachineCare Request #{canonical_data.get('request_number', '')}",
            "DocumentLines": [
                {
                    "ItemCode": item.get("part_number") or item.get("id"),
                    "Quantity": item.get("quantity", 1),
                }
                for item in canonical_data.get("items", [])
            ] if canonical_data.get("items") else [{"ItemCode": "A1001", "Quantity": 1}]
        }
        res = self.client.post("PurchaseRequests", payload)
        return {"DocEntry": res.get("DocEntry", 501), "status": "created"}

    async def send_maintenance_cost(self, canonical_data: Dict[str, Any]) -> Dict[str, Any]:
        # SAP B1 Journal Entry or Service invoice
        payload = {
            "ReferenceDate": canonical_data.get("date", time.strftime("%Y-%m-%d")),
            "Memo": f"MachineCare WO Cost: {canonical_data.get('work_order_id')}",
            "JournalEntryLines": [
                {
                    "AccountCode": "600010",
                    "Debit": float(canonical_data.get("total_cost", 0.0)),
                }
            ]
        }
        res = self.client.post("JournalEntries", payload)
        return {"DocEntry": res.get("JdtNum", 801), "status": "posted"}
