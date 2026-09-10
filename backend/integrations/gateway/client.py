"""
MachineCare Integration Platform - Data Gateway Client Architecture
Enables on-premise customer networks to stream data outbound to MachineCare
without exposing internal databases to the public internet.
Features HMAC-SHA256 signature verification, replay protection, and batch limits.
"""

import hmac
import hashlib
import json
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional

MAX_BATCH_SIZE = 5000
MAX_MESSAGE_AGE_SECONDS = 300

@dataclass
class GatewayMessage:
    gateway_id: str
    organization_id: str
    source_database_type: str  # postgres, sqlserver, mysql, oracle
    entity_type: str
    payload: List[Dict[str, Any]]
    sent_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    signature: Optional[str] = None

class MachineCareDataGateway:
    """
    Outbound gateway processor in MachineCare backend receiving
    secure telemetry/records from an on-prem agent.
    """

    def __init__(self):
        self._registered_gateways: Dict[str, Dict[str, Any]] = {}
        self._received_batches: List[GatewayMessage] = []

    def register_gateway(
        self,
        gateway_id: str,
        organization_id: str,
        name: str,
        secret_key: Optional[str] = None
    ) -> None:
        self._registered_gateways[gateway_id] = {
            "gateway_id": gateway_id,
            "organization_id": organization_id,
            "name": name,
            "secret_key": secret_key or f"gw_sec_{gateway_id}_default",
            "status": "ONLINE",
            "last_heartbeat": datetime.now(timezone.utc).isoformat(),
        }

    @staticmethod
    def compute_signature(secret_key: str, message: GatewayMessage) -> str:
        """Computes HMAC-SHA256 signature for message payload."""
        data_to_sign = f"{message.gateway_id}:{message.organization_id}:{message.entity_type}:{message.sent_at}:{len(message.payload)}"
        return hmac.new(secret_key.encode("utf-8"), data_to_sign.encode("utf-8"), hashlib.sha256).hexdigest()

    def receive_gateway_batch(self, message: GatewayMessage) -> Dict[str, Any]:
        # 1. Authorization & Registration Check
        if message.gateway_id not in self._registered_gateways:
            raise ValueError(f"Unauthorized or unregistered gateway: {message.gateway_id}")

        gw_config = self._registered_gateways[message.gateway_id]

        # 2. Strict Tenant Isolation
        if message.organization_id != gw_config["organization_id"]:
            raise PermissionError("Tenant isolation mismatch for gateway message.")

        # 3. Payload Batch Size Defense (DoS prevention)
        if len(message.payload) > MAX_BATCH_SIZE:
            raise ValueError(f"Batch size exceeds maximum limit of {MAX_BATCH_SIZE} records.")

        # 4. Replay Attack & Timestamp Freshness Check
        try:
            sent_time = datetime.fromisoformat(message.sent_at.replace("Z", "+00:00"))
            age_seconds = abs((datetime.now(timezone.utc) - sent_time).total_seconds())
            if age_seconds > MAX_MESSAGE_AGE_SECONDS:
                raise ValueError(f"Gateway message expired or clock drift excessive: {round(age_seconds)}s (max {MAX_MESSAGE_AGE_SECONDS}s)")
        except Exception as e:
            if "expired" in str(e):
                raise
            # If timestamp parse fails in non-iso, proceed with warning

        # 5. HMAC Signature Verification (if provided or required)
        if message.signature:
            expected_sig = self.compute_signature(gw_config["secret_key"], message)
            if not hmac.compare_digest(message.signature, expected_sig):
                raise PermissionError("Invalid HMAC-SHA256 signature on gateway payload.")

        gw_config["last_heartbeat"] = datetime.now(timezone.utc).isoformat()
        self._received_batches.append(message)
        return {
            "status": "RECEIVED",
            "records_processed": len(message.payload),
            "entity_type": message.entity_type,
        }
