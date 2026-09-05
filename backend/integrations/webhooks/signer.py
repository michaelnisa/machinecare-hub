"""
MachineCare ERP Integration Platform - Webhook Cryptographic Signer
Signs outbound webhooks and validates incoming webhook HMAC-SHA256 signatures.
"""

import hmac
import hashlib
import json
from typing import Any, Dict

class WebhookSigner:
    """Provides HMAC-SHA256 signing and tamper verification for webhooks."""

    HEADER_SIGNATURE = "X-MachineCare-Signature"
    HEADER_TIMESTAMP = "X-MachineCare-Timestamp"
    HEADER_EVENT = "X-MachineCare-Event"

    @staticmethod
    def sign_payload(payload: Dict[str, Any], secret: str, timestamp: str) -> str:
        """
        Creates HMAC-SHA256 signature string: hex(hmac_sha256(secret, f"{timestamp}.{json_payload}"))
        """
        canonical_payload = json.dumps(payload, sort_keys=True, separators=(",", ":"))
        signing_content = f"{timestamp}.{canonical_payload}".encode("utf-8")
        signature = hmac.new(secret.encode("utf-8"), signing_content, hashlib.sha256).hexdigest()
        return f"v1={signature}"

    @classmethod
    def verify_signature(cls, payload: Dict[str, Any], secret: str, timestamp: str, signature_header: str) -> bool:
        """Verifies signature header against secret and payload."""
        if not signature_header or not secret:
            return False
        expected_sig = cls.sign_payload(payload, secret, timestamp)
        return hmac.compare_digest(expected_sig, signature_header)
