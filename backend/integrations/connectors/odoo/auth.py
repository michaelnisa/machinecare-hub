"""
MachineCare ERP Integration Platform - Odoo JSON-2 Authentication
Handles Bearer API-Key authorization and header generation for Odoo 19+.
"""

from typing import Dict, Any
from backend.integrations.core.exceptions import AuthenticationError

class OdooAuth:
    """Manages Odoo JSON-2 Bearer API key authentication."""

    def __init__(self, database: str, api_key: str, username: str = "bot"):
        if not api_key:
            raise AuthenticationError("Odoo API Key is required", connector="odoo")
        if not database:
            raise AuthenticationError("Odoo Database name is required", connector="odoo")

        self.database = database
        self.api_key = api_key
        self.username = username

    def get_headers(self) -> Dict[str, str]:
        """Generates HTTP headers for Odoo JSON-2 endpoints."""
        return {
            "Authorization": f"Bearer {self.api_key}",
            "X-Odoo-Database": self.database,
            "Content-Type": "application/json",
            "Accept": "application/json",
            "User-Agent": "MachineCare-ERP-SyncEngine/2.0",
        }
