"""
MachineCare ERP Integration Platform - Dynamics 365 OAuth 2.0 Auth
Handles Azure AD client credentials grant and token refreshing.
"""

from typing import Dict, Any, Optional
import time
import requests
from backend.integrations.core.exceptions import AuthenticationError

class Dynamics365OAuth:
    """Manages Azure Active Directory OAuth2 tokens for Business Central."""

    def __init__(self, tenant_id: str, client_id: str, client_secret: str, session: Optional[requests.Session] = None):
        if not tenant_id or not client_id or not client_secret:
            raise AuthenticationError("tenant_id, client_id, and client_secret are required for Dynamics 365", connector="dynamics_365")

        self.tenant_id = tenant_id
        self.client_id = client_id
        self.client_secret = client_secret
        self.token_url = f"https://login.microsoftonline.com/{tenant_id}/oauth2/v2.0/token"
        self.access_token: Optional[str] = None
        self.token_expiry: float = 0.0
        self.session = session or requests.Session()

    def is_token_valid(self) -> bool:
        return self.access_token is not None and time.time() < self.token_expiry

    def refresh_token(self) -> str:
        """Requests a fresh OAuth2 bearer access token from Microsoft Identity Platform."""
        data = {
            "grant_type": "client_credentials",
            "client_id": self.client_id,
            "client_secret": self.client_secret,
            "scope": "https://api.businesscentral.dynamics.com/.default",
        }
        try:
            res = self.session.post(self.token_url, data=data, timeout=15)
            if res.status_code != 200:
                raise AuthenticationError(
                    f"Azure AD authentication failed ({res.status_code}): {res.text}",
                    connector="dynamics_365"
                )
            token_data = res.json()
            self.access_token = token_data["access_token"]
            expires_in = token_data.get("expires_in", 3600)
            self.token_expiry = time.time() + expires_in - 120  # Expire 2 mins early
            return self.access_token
        except requests.exceptions.RequestException as e:
            raise AuthenticationError(f"OAuth network error connecting to Azure AD: {str(e)}", connector="dynamics_365")

    def get_headers(self) -> Dict[str, str]:
        if not self.is_token_valid():
            self.refresh_token()
        return {
            "Authorization": f"Bearer {self.access_token}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        }
