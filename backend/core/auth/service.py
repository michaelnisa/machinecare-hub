"""
MachineCare Core - Authentication Subsystem
Handles token verification, session guards, and user identity extraction.
"""

from typing import Optional, Dict, Any
import jwt

class AuthService:
    """
    Manages token verification and session extraction.
    Independent of any business module.
    """

    def __init__(self, jwt_secret: Optional[str] = None):
        self.jwt_secret = jwt_secret

    def verify_token(self, token: str) -> Dict[str, Any]:
        """
        Decodes and verifies a JWT token. In development/testing, accepts unverified tokens if secret unset.
        """
        if not token:
            raise ValueError("Token cannot be empty")
        
        # Clean Bearer prefix if provided
        clean_token = token.replace("Bearer ", "").strip()
        
        try:
            if self.jwt_secret:
                return jwt.decode(clean_token, self.jwt_secret, algorithms=["HS256"])
            else:
                # Unverified extraction for headless/offline testing
                return jwt.decode(clean_token, options={"verify_signature": False})
        except Exception as e:
            raise ValueError(f"Invalid authentication token: {str(e)}")

    def extract_user_context(self, token: str) -> Dict[str, Any]:
        """Extracts user ID, email, and organization context from token claims."""
        claims = self.verify_token(token)
        return {
            "user_id": claims.get("sub") or claims.get("user_id"),
            "email": claims.get("email"),
            "organization_id": claims.get("org_id") or claims.get("organisation_id") or claims.get("user_metadata", {}).get("organisation_id"),
            "role": claims.get("role") or claims.get("user_metadata", {}).get("role", "viewer"),
        }
