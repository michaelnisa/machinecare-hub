"""
MachineCare ERP Integration Platform - Odoo JSON-2 API Client
Interacts with Odoo 19+ via /json/2/<model>/<method> endpoints.
"""

import json
import time
from typing import Any, Dict, List, Optional
import requests

from backend.integrations.connectors.odoo.auth import OdooAuth
from backend.integrations.core.exceptions import AuthenticationError, ConnectionError, RateLimitError

class OdooJson2Client:
    """Client for Odoo 19 JSON-2 REST architecture."""

    def __init__(self, base_url: str, auth: OdooAuth, timeout: int = 20, session: Optional[requests.Session] = None):
        self.base_url = base_url.rstrip("/")
        self.auth = auth
        self.timeout = timeout
        self.session = session or requests.Session()

    def call_method(self, model: str, method: str, params: Optional[Dict[str, Any]] = None) -> Any:
        """
        Executes a remote RPC method call to /json/2/<model>/<method>.
        """
        endpoint = f"{self.base_url}/json/2/{model}/{method}"
        headers = self.auth.get_headers()
        body = params or {}

        try:
            start_time = time.time()
            response = self.session.post(
                endpoint,
                headers=headers,
                data=json.dumps(body),
                timeout=self.timeout,
            )
            latency = (time.time() - start_time) * 1000

            if response.status_code == 401 or response.status_code == 403:
                raise AuthenticationError(
                    f"Odoo authorization rejected: {response.text}",
                    connector="odoo",
                    details={"status_code": response.status_code}
                )
            elif response.status_code == 429:
                retry_after = int(response.headers.get("Retry-After", 60))
                raise RateLimitError("Odoo rate limit reached", connector="odoo", retry_after_seconds=retry_after)
            elif response.status_code >= 500:
                raise ConnectionError(f"Odoo server error {response.status_code}: {response.text}", connector="odoo")

            data = response.json() if response.content else {}
            if isinstance(data, dict) and data.get("error"):
                raise ConnectionError(f"Odoo RPC Error: {data['error']}", connector="odoo")

            return data

        except requests.exceptions.RequestException as req_err:
            raise ConnectionError(f"Failed connecting to Odoo at {self.base_url}: {str(req_err)}", connector="odoo")

    def search_read(
        self,
        model: str,
        domain: Optional[List[Any]] = None,
        fields: Optional[List[str]] = None,
        limit: int = 100,
        offset: int = 0,
        order: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """Executes search_read query on an Odoo model."""
        params = {
            "domain": domain or [],
            "fields": fields or [],
            "limit": limit,
            "offset": offset,
        }
        if order:
            params["order"] = order

        result = self.call_method(model, "search_read", params)
        if isinstance(result, list):
            return result
        elif isinstance(result, dict) and "records" in result:
            return result["records"]
        return result or []

    def create(self, model: str, values: Dict[str, Any]) -> Any:
        """Creates a record in Odoo."""
        return self.call_method(model, "create", {"vals_list": [values]})

    def write(self, model: str, ids: List[int], values: Dict[str, Any]) -> bool:
        """Updates records in Odoo."""
        return self.call_method(model, "write", {"ids": ids, "vals": values})
