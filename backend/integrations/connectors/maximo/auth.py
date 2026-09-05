"""
MachineCare ERP Integration Platform - IBM Maximo Authentication
Handles Maximo API Key (apikey header), MaxAuth / Basic authentication, and MAS OAuth2.
"""

import base64
from typing import Dict, Optional

class MaximoAuth:
    """Manages credentials and HTTP headers for IBM Maximo OSLC REST APIs."""

    def __init__(
        self,
        api_key: Optional[str] = None,
        username: Optional[str] = None,
        password: Optional[str] = None,
        auth_type: str = "api_key",
        site_id: Optional[str] = None,
        org_id: Optional[str] = None,
    ):
        self.api_key = api_key
        self.username = username
        self.password = password
        self.auth_type = auth_type
        self.site_id = site_id
        self.org_id = org_id

    def get_headers(self) -> Dict[str, str]:
        headers = {
            "Accept": "application/json",
            "Content-Type": "application/json",
            "x-method-override": "PATCH",
        }

        if self.api_key:
            headers["apikey"] = self.api_key
        elif self.username and self.password:
            credentials = f"{self.username}:{self.password}"
            encoded = base64.b64encode(credentials.encode("utf-8")).decode("utf-8")
            headers["maxauth"] = encoded
            headers["Authorization"] = f"Basic {encoded}"

        return headers

    def validate(self) -> bool:
        if self.api_key:
            return bool(self.api_key.strip())
        if self.username and self.password:
            return bool(self.username.strip() and self.password.strip())
        return False
