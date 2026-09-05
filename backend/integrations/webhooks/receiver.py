"""
MachineCare ERP Integration Platform - Inbound Webhook Receiver
Validates incoming signatures from ERPs and queues inbound synchronization.
"""

from typing import Any, Dict, Optional, Tuple
import time
from backend.integrations.webhooks.signer import WebhookSigner
from backend.integrations.core.exceptions import AuthenticationError

class WebhookReceiver:
    """Processes incoming webhooks from external ERP systems."""

    def __init__(self, replay_tolerance_seconds: int = 300):
        self.replay_tolerance_seconds = replay_tolerance_seconds
        self._processed_idempotency_keys: set = set()

    def process_inbound(
        self,
        payload: Dict[str, Any],
        secret: str,
        signature_header: str,
        timestamp_header: str,
        idempotency_key: Optional[str] = None,
    ) -> Tuple[bool, str]:
        """
        Validates signature, timestamp staleness, and duplicate idempotency.
        """
        if idempotency_key and idempotency_key in self._processed_idempotency_keys:
            return True, "Duplicate event ignored (idempotent)"

        # Check timestamp replay
        try:
            ts = int(timestamp_header)
            current_ts = int(time.time())
            if abs(current_ts - ts) > self.replay_tolerance_seconds:
                return False, "Timestamp expired or out of tolerance window"
        except (ValueError, TypeError):
            return False, "Invalid timestamp header"

        # Verify cryptographic signature
        is_valid = WebhookSigner.verify_signature(
            payload=payload,
            secret=secret,
            timestamp=timestamp_header,
            signature_header=signature_header,
        )
        if not is_valid:
            raise AuthenticationError("Invalid webhook signature header", connector="inbound_webhook")

        if idempotency_key:
            self._processed_idempotency_keys.add(idempotency_key)

        return True, "Webhook accepted for synchronization"
