"""
MachineCare ERP Integration Platform - SAP Business One Service Layer Client
Interacts with SAP B1 Service Layer HTTP/OData REST API.
"""

import json
import time
from typing import Any, Dict, List, Optional
import requests

from backend.integrations.connectors.sap_business_one.auth import SapB1Auth
from backend.integrations.core.exceptions import AuthenticationError, ConnectionError

class SapB1Client:
    """HTTP Client for SAP Business One Service Layer."""

    def __init__(self, base_url: str, auth: SapB1Auth, timeout: int = 20, session: Optional[requests.Session] = None):
        self.base_url = base_url.rstrip("/")
        # Service Layer typically has /b1s/v1 suffix
        if not self.base_url.endswith("/b1s/v1"):
            self.api_url = f"{self.base_url}/b1s/v1"
        else:
            self.api_url = self.base_url
        self.auth = auth
        self.timeout = timeout
        self.session = session or requests.Session()

    def ensure_login(self) -> None:
        """Logs into Service Layer if session is expired or not yet initialized."""
        if self.auth.is_session_valid():
            return

        login_url = f"{self.api_url}/Login"
        payload = self.auth.get_login_payload()

        try:
            res = self.session.post(
                login_url,
                json=payload,
                headers={"Content-Type": "application/json"},
                timeout=self.timeout,
                verify=False,  # Many SAP B1 on-prem installations use self-signed certs
            )
            if res.status_code != 200:
                raise AuthenticationError(
                    f"SAP B1 Login failed ({res.status_code}): {res.text}",
                    connector="sap_business_one"
                )

            data = res.json()
            session_id = data.get("SessionId")
            timeout_min = data.get("SessionTimeout", 30)

            # Extract ROUTEID cookie if present
            route_id = res.cookies.get("ROUTEID")
            self.auth.set_session(session_id, route_id=route_id, timeout_minutes=timeout_min)

        except requests.exceptions.RequestException as e:
            raise ConnectionError(f"Cannot reach SAP Business One Service Layer at {self.api_url}: {str(e)}", connector="sap_business_one")

    def get(self, entity_set: str, params: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        """Queries an OData entity set (e.g. Items, BusinessPartners)."""
        self.ensure_login()
        url = f"{self.api_url}/{entity_set}"
        headers = self.auth.get_headers()

        try:
            res = self.session.get(url, headers=headers, params=params, timeout=self.timeout, verify=False)
            if res.status_code in (401, 403):
                # Session might have been dropped by server, retry once
                self.auth.session_id = None
                self.ensure_login()
                res = self.session.get(url, headers=self.auth.get_headers(), params=params, timeout=self.timeout, verify=False)

            if res.status_code != 200:
                raise ConnectionError(f"SAP query to {entity_set} failed ({res.status_code}): {res.text}", connector="sap_business_one")

            data = res.json()
            return data.get("value", [])

        except requests.exceptions.RequestException as e:
            raise ConnectionError(f"SAP B1 request error: {str(e)}", connector="sap_business_one")

    def post(self, entity_set: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Creates a business object in SAP B1 Service Layer."""
        self.ensure_login()
        url = f"{self.api_url}/{entity_set}"
        headers = self.auth.get_headers()

        try:
            res = self.session.post(url, headers=headers, json=payload, timeout=self.timeout, verify=False)
            if res.status_code not in (200, 201):
                raise ConnectionError(f"SAP creation in {entity_set} failed ({res.status_code}): {res.text}", connector="sap_business_one")
            return res.json() if res.content else {"status": "created"}
        except requests.exceptions.RequestException as e:
            raise ConnectionError(f"SAP B1 POST error: {str(e)}", connector="sap_business_one")
