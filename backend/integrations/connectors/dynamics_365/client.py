"""
MachineCare ERP Integration Platform - Microsoft Dynamics 365 Business Central Client
Interacts with Microsoft Dynamics 365 Business Central standard API v2.0 endpoints.
"""

from typing import Any, Dict, List, Optional
import requests
from backend.integrations.connectors.dynamics_365.auth import Dynamics365OAuth
from backend.integrations.core.exceptions import ConnectionError, AuthenticationError

class Dynamics365Client:
    """REST Client for Business Central API v2.0."""

    def __init__(
        self,
        base_url: str,
        environment: str,
        company_id: str,
        auth: Dynamics365OAuth,
        timeout: int = 20,
        session: Optional[requests.Session] = None,
    ):
        self.base_url = base_url.rstrip("/") if base_url else "https://api.businesscentral.dynamics.com"
        self.environment = environment or "production"
        self.company_id = company_id
        self.auth = auth
        self.timeout = timeout
        self.session = session or requests.Session()

    def _company_api_root(self) -> str:
        # Standard cloud Business Central API pattern
        if "api.businesscentral.dynamics.com" in self.base_url:
            return f"{self.base_url}/v2.0/{self.environment}/api/v2.0/companies({self.company_id})"
        # Custom / On-Prem
        return f"{self.base_url}/api/v2.0/companies({self.company_id})"

    def get_companies(self) -> List[Dict[str, Any]]:
        """Queries list of companies accessible in the tenant/environment."""
        if "api.businesscentral.dynamics.com" in self.base_url:
            url = f"{self.base_url}/v2.0/{self.environment}/api/v2.0/companies"
        else:
            url = f"{self.base_url}/api/v2.0/companies"

        headers = self.auth.get_headers()
        try:
            res = self.session.get(url, headers=headers, timeout=self.timeout)
            if res.status_code != 200:
                raise ConnectionError(f"Failed to fetch Dynamics companies: {res.text}", connector="dynamics_365")
            data = res.json()
            return data.get("value", [])
        except requests.exceptions.RequestException as e:
            raise ConnectionError(f"Dynamics API error: {str(e)}", connector="dynamics_365")

    def get(self, entity_set: str, params: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        """Queries a collection in Business Central."""
        url = f"{self._company_api_root()}/{entity_set}"
        headers = self.auth.get_headers()
        try:
            res = self.session.get(url, headers=headers, params=params, timeout=self.timeout)
            if res.status_code != 200:
                raise ConnectionError(f"Dynamics 365 query to {entity_set} failed ({res.status_code}): {res.text}", connector="dynamics_365")
            data = res.json()
            return data.get("value", [])
        except requests.exceptions.RequestException as e:
            raise ConnectionError(f"Dynamics request error: {str(e)}", connector="dynamics_365")

    def post(self, entity_set: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Creates an object in Business Central."""
        url = f"{self._company_api_root()}/{entity_set}"
        headers = self.auth.get_headers()
        try:
            res = self.session.post(url, headers=headers, json=payload, timeout=self.timeout)
            if res.status_code not in (200, 201):
                raise ConnectionError(f"Dynamics 365 create in {entity_set} failed: {res.text}", connector="dynamics_365")
            return res.json()
        except requests.exceptions.RequestException as e:
            raise ConnectionError(f"Dynamics POST error: {str(e)}", connector="dynamics_365")
