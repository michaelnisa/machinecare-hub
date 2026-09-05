"""
MachineCare ERP Integration Platform - Outbound Webhook Dispatcher
Dispatches operational events to external subscriber URLs with exponential backoff.
"""

import json
import time
from typing import Any, Dict, Optional, List
import requests

from backend.integrations.webhooks.signer import WebhookSigner

class WebhookDeliveryResult:
    def __init__(self, webhook_id: str, event_name: str, target_url: str):
        self.webhook_id = webhook_id
        self.event_name = event_name
        self.target_url = target_url
        self.status = "pending"
        self.http_status: Optional[int] = None
        self.duration_ms: float = 0.0
        self.retry_count: int = 0
        self.error_message: Optional[str] = None
        self.delivered_at: Optional[str] = None

class WebhookDispatcher:
    """Dispatches webhooks with signatures, timestamps, and delivery logging."""

    SUPPORTED_EVENTS = [
        "asset.updated",
        "part.updated",
        "inventory.changed",
        "purchase_request.created",
        "maintenance.completed",
        "production.completed",
    ]

    def __init__(self, session: Optional[requests.Session] = None):
        self.session = session or requests.Session()
        self.delivery_history: List[WebhookDeliveryResult] = []

    def dispatch(
        self,
        webhook_id: str,
        target_url: str,
        secret: str,
        event_name: str,
        payload: Dict[str, Any],
        max_retries: int = 3,
    ) -> WebhookDeliveryResult:
        result = WebhookDeliveryResult(webhook_id, event_name, target_url)
        timestamp = str(int(time.time()))
        signature = WebhookSigner.sign_payload(payload, secret, timestamp)

        headers = {
            "Content-Type": "application/json",
            "User-Agent": "MachineCare-Webhook-Dispatcher/2.0",
            WebhookSigner.HEADER_SIGNATURE: signature,
            WebhookSigner.HEADER_TIMESTAMP: timestamp,
            WebhookSigner.HEADER_EVENT: event_name,
        }

        attempt = 0
        while attempt < max_retries:
            attempt += 1
            result.retry_count = attempt - 1
            start_time = time.time()
            try:
                res = self.session.post(
                    target_url,
                    data=json.dumps(payload),
                    headers=headers,
                    timeout=10,
                )
                result.duration_ms = round((time.time() - start_time) * 1000, 2)
                result.http_status = res.status_code

                if 200 <= res.status_code < 300:
                    result.status = "delivered"
                    result.delivered_at = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
                    self.delivery_history.append(result)
                    return result
                else:
                    result.status = "failed"
                    result.error_message = f"HTTP {res.status_code}: {res.text[:200]}"

            except requests.exceptions.RequestException as e:
                result.duration_ms = round((time.time() - start_time) * 1000, 2)
                result.status = "failed"
                result.error_message = str(e)

            # Exponential backoff between attempts: 1s, 2s, 4s...
            if attempt < max_retries:
                time.sleep(min(0.5 * (2 ** (attempt - 1)), 2.0))

        self.delivery_history.append(result)
        return result
