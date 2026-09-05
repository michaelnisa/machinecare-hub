"""
MachineCare ERP Integration Platform - Core Exception Taxonomy
"""

class IntegrationError(Exception):
    """Base exception for all integration errors."""
    def __init__(self, message: str, connector: str | None = None, code: str = "INTEGRATION_ERROR", details: dict | None = None):
        super().__init__(message)
        self.message = message
        self.connector = connector
        self.code = code
        self.details = details or {}

class AuthenticationError(IntegrationError):
    """Raised when authentication against external ERP fails."""
    def __init__(self, message: str, connector: str | None = None, details: dict | None = None):
        super().__init__(message, connector=connector, code="AUTHENTICATION_FAILED", details=details)

class ConnectionError(IntegrationError):
    """Raised when network connectivity or endpoint resolution fails."""
    def __init__(self, message: str, connector: str | None = None, details: dict | None = None):
        super().__init__(message, connector=connector, code="CONNECTION_FAILED", details=details)

class MappingError(IntegrationError):
    """Raised when field transformation or schema mapping fails."""
    def __init__(self, message: str, entity_type: str | None = None, field: str | None = None, details: dict | None = None):
        super().__init__(message, code="MAPPING_FAILED", details={**(details or {}), "entity_type": entity_type, "field": field})

class ValidationError(IntegrationError):
    """Raised when data fails canonical schema validation."""
    def __init__(self, message: str, entity_type: str | None = None, errors: list | None = None):
        super().__init__(message, code="VALIDATION_FAILED", details={"entity_type": entity_type, "errors": errors or []})

class ConflictError(IntegrationError):
    """Raised when bidirectional or concurrent updates conflict and require resolution."""
    def __init__(self, message: str, entity_type: str, canonical_id: str, external_id: str, diff: dict | None = None):
        super().__init__(message, code="DATA_CONFLICT", details={
            "entity_type": entity_type,
            "canonical_id": canonical_id,
            "external_id": external_id,
            "diff": diff or {}
        })

class RateLimitError(IntegrationError):
    """Raised when external ERP returns 429 Too Many Requests."""
    def __init__(self, message: str, connector: str | None = None, retry_after_seconds: int = 60):
        super().__init__(message, connector=connector, code="RATE_LIMIT_EXCEEDED", details={"retry_after_seconds": retry_after_seconds})

class DeadLetterError(IntegrationError):
    """Raised when maximum retry attempts have been exhausted."""
    def __init__(self, message: str, error_id: str, attempts: int):
        super().__init__(message, code="DEAD_LETTER_EXHAUSTED", details={"error_id": error_id, "attempts": attempts})
