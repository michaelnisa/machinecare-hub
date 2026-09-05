"""
MachineCare ERP Integration Platform - SAP Business One Service Layer Auth
Manages B1SESSION cookie lifecycles and HTTP headers.
"""

from typing import Dict, Any, Optional
import time
from backend.integrations.core.exceptions import AuthenticationError

class SapB1Auth:
    """Handles session login and B1SESSION cookie token management."""

    def __init__(self, company_db: str, username: str, password: str):
        if not company_db or not username or not password:
            raise AuthenticationError("CompanyDB, Username, and Password are required for SAP Business One", connector="sap_business_one")

        self.company_db = company_db
        self.username = username
        self.password = password
        self.session_id: Optional[str] = None
        self.route_id: Optional[str] = None
        self.session_expiry: float = 0.0

    def is_session_valid(self) -> bool:
        return self.session_id is not None and time.time() < self.session_expiry

    def set_session(self, session_id: str, route_id: Optional[str] = None, timeout_minutes: int = 30):
        self.session_id = session_id
        self.route_id = route_id
        # Expire 2 minutes early for safety
        self.session_expiry = time.time() + (timeout_minutes - 2) * 60

    def get_login_payload(self) -> Dict[str, str]:
        return {
            "CompanyDB": self.company_db,
            "UserName": self.username,
            "Password": self.password,
        }

    def get_headers(self) -> Dict[str, str]:
        headers = {
            "Content-Type": "application/json",
            "Accept": "application/json",
            "Prefer": "odata.maxpagesize=100",
        }
        if self.session_id:
            cookie_str = f"B1SESSION={self.session_id}"
            if self.route_id:
                cookie_str += f"; ROUTEID={self.route_id}"
            headers["Cookie"] = cookie_str
        return headers
