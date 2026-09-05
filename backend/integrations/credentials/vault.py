"""
MachineCare ERP Integration Platform - Security & Credential Vault
Implements AES-256-GCM encryption for all sensitive credentials at rest,
zero plaintext logging, and cryptographic masking for safe frontend display.
"""

import os
import json
import base64
import hashlib
from typing import Dict, Any, Tuple
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from backend.integrations.core.exceptions import AuthenticationError

class CredentialVault:
    """Enterprise credential encryption vault using AES-256-GCM."""

    DEFAULT_ENV_KEY_NAME = "MACHINECARE_INTEGRATION_MASTER_KEY"
    FALLBACK_SALT = b"machinecare_erp_vault_salt_v1"

    def __init__(self, master_key: str | bytes | None = None):
        if master_key is None:
            raw_key = os.getenv(self.DEFAULT_ENV_KEY_NAME, "default-dev-sec-key-mc-erp-2026-secure-32b")
            self._key = hashlib.sha256(raw_key.encode("utf-8") if isinstance(raw_key, str) else raw_key).digest()
        elif isinstance(master_key, str):
            self._key = hashlib.sha256(master_key.encode("utf-8")).digest()
        else:
            self._key = hashlib.sha256(master_key).digest()

        self._aesgcm = AESGCM(self._key)

    def encrypt(self, credentials: Dict[str, Any]) -> Tuple[str, str, str]:
        """
        Encrypts a credentials dictionary.
        Returns:
            (ciphertext_b64, iv_b64, auth_tag_b64)
        """
        try:
            payload_bytes = json.dumps(credentials, sort_keys=True).encode("utf-8")
            iv = os.urandom(12)  # Recommended 96-bit nonce for AES-GCM
            # AESGCM.encrypt appends 16-byte authentication tag to ciphertext
            encrypted_data = self._aesgcm.encrypt(iv, payload_bytes, None)
            ciphertext = encrypted_data[:-16]
            auth_tag = encrypted_data[-16:]

            return (
                base64.b64encode(ciphertext).decode("utf-8"),
                base64.b64encode(iv).decode("utf-8"),
                base64.b64encode(auth_tag).decode("utf-8"),
            )
        except Exception as e:
            raise AuthenticationError(f"Encryption failed in CredentialVault: {str(e)}")

    def decrypt(self, ciphertext_b64: str, iv_b64: str, auth_tag_b64: str) -> Dict[str, Any]:
        """
        Decrypts and validates the authentication tag.
        """
        try:
            ciphertext = base64.b64decode(ciphertext_b64.encode("utf-8"))
            iv = base64.b64decode(iv_b64.encode("utf-8"))
            auth_tag = base64.b64decode(auth_tag_b64.encode("utf-8"))

            combined = ciphertext + auth_tag
            decrypted_bytes = self._aesgcm.decrypt(iv, combined, None)
            return json.loads(decrypted_bytes.decode("utf-8"))
        except Exception as e:
            raise AuthenticationError(f"Credential decryption failed or tag tampering detected: {str(e)}")

    @staticmethod
    def mask_credentials(credentials: Dict[str, Any]) -> Dict[str, Any]:
        """
        Creates a sanitized dictionary safe for frontend display.
        Hides passwords, tokens, client secrets, and bearer keys.
        """
        sensitive_keys = {
            "api_key", "password", "client_secret", "access_token",
            "refresh_token", "secret", "private_key", "token"
        }
        masked = {}
        for k, v in credentials.items():
            if not isinstance(v, str) or not v:
                masked[k] = v
                continue

            lower_key = k.lower()
            if any(s in lower_key for s in sensitive_keys):
                if len(v) <= 6:
                    masked[k] = "••••••"
                else:
                    masked[k] = f"{v[:3]}••••••{v[-3:]}"
            else:
                masked[k] = v
        return masked
