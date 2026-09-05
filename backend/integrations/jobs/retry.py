"""
MachineCare ERP Integration Platform - Retry & Dead-Letter Queue Manager
Handles automatic retries with exponential backoff and error classification.
"""

from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta, timezone
import math

class RetryPolicy:
    """Calculates backoff intervals and distinguishes transient vs permanent failures."""

    @staticmethod
    def is_retryable(error_message: str, error_code: str = "") -> bool:
        """Determines if failure is transient (network/rate limit/lock) vs permanent schema invalidity."""
        permanent_indicators = [
            "mapping_failed",
            "validation_failed",
            "unsupported",
            "not found",
            "duplicate key",
            "syntax error",
            "invalid field",
        ]
        lower_msg = f"{error_code} {error_message}".lower()
        if any(ind in lower_msg for ind in permanent_indicators):
            return False
        return True

    @staticmethod
    def calculate_next_retry(attempt: int, base_delay_seconds: int = 10, max_delay_seconds: int = 3600) -> str:
        """Calculates ISO timestamp for next attempt with exponential backoff and jitter."""
        delay = min(base_delay_seconds * (2 ** (attempt - 1)), max_delay_seconds)
        next_time = datetime.now(timezone.utc) + timedelta(seconds=delay)
        return next_time.isoformat()

class ErrorCenterManager:
    """Manages integration errors, retry state, and dead-letter queue."""

    def __init__(self):
        self._errors: Dict[str, Dict[str, Any]] = {}

    def record_error(
        self,
        error_id: str,
        organisation_id: str,
        integration_id: str,
        entity_type: str,
        external_id: str,
        error_message: str,
        error_code: str = "SYNC_FAILED",
        raw_payload: Optional[Dict[str, Any]] = None,
        max_retries: int = 3,
    ) -> Dict[str, Any]:
        retryable = RetryPolicy.is_retryable(error_message, error_code)
        error_entry = {
            "id": error_id,
            "organisation_id": organisation_id,
            "integration_id": integration_id,
            "entity_type": entity_type,
            "external_id": external_id,
            "error_code": error_code,
            "error_message": error_message,
            "raw_payload": raw_payload or {},
            "status": "open" if retryable else "permanent_failure",
            "retry_count": 0,
            "max_retries": max_retries,
            "is_retryable": retryable,
            "next_retry_at": RetryPolicy.calculate_next_retry(1) if retryable else None,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        self._errors[error_id] = error_entry
        return error_entry

    def retry_error(self, error_id: str) -> Dict[str, Any]:
        """Increments retry counter or transitions to dead-letter queue."""
        if error_id not in self._errors:
            raise KeyError(f"Error {error_id} not found")

        err = self._errors[error_id]
        err["retry_count"] += 1

        if err["retry_count"] >= err["max_retries"]:
            err["status"] = "dead_letter"
            err["next_retry_at"] = None
        else:
            err["status"] = "retrying"
            err["next_retry_at"] = RetryPolicy.calculate_next_retry(err["retry_count"] + 1)

        return err

    def resolve_error(self, error_id: str, notes: str = "Resolved manually") -> Dict[str, Any]:
        """Marks error resolved after mapping fix or manual intervention."""
        if error_id not in self._errors:
            raise KeyError(f"Error {error_id} not found")
        err = self._errors[error_id]
        err["status"] = "resolved"
        err["resolved_at"] = datetime.utcnow().isoformat() + "Z"
        err["resolution_notes"] = notes
        return err

    def list_errors(self, organisation_id: str, status: Optional[str] = None) -> List[Dict[str, Any]]:
        results = [e for e in self._errors.values() if e["organisation_id"] == organisation_id]
        if status:
            results = [e for e in results if e["status"] == status]
        return results
