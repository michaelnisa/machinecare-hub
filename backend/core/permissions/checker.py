"""
MachineCare Core - Server-Side Permission Checker
Enforces resource:action RBAC checks.
"""

from typing import Set, Optional
from .models import DEFAULT_ROLE_PERMISSIONS

class PermissionChecker:
    @staticmethod
    def has_permission(user_role: str, resource_action: str) -> bool:
        """
        Evaluates whether a role grants access to `resource:action`.
        Supports wildcards: '*:*', 'resource:*'.
        """
        perms: Set[str] = DEFAULT_ROLE_PERMISSIONS.get(user_role, set())
        
        # Check wildcard superuser
        if "*:*" in perms:
            return True

        # Check exact match
        if resource_action in perms:
            return True

        # Check resource wildcard (e.g. assets:* matching assets:read)
        if ":" in resource_action:
            resource, _ = resource_action.split(":", 1)
            if f"{resource}:*" in perms:
                return True

        return False

    @classmethod
    def require_permission(cls, user_role: str, resource_action: str) -> None:
        """Raises PermissionError if role lacks permission."""
        if not cls.has_permission(user_role, resource_action):
            raise PermissionError(
                f"Role '{user_role}' is not authorized to perform '{resource_action}'"
            )
