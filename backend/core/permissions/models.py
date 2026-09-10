"""
MachineCare Core - Granular Permissions Model (resource:action)
"""

from typing import Set, Dict, List

# Role to granular permission mapping
DEFAULT_ROLE_PERMISSIONS: Dict[str, Set[str]] = {
    "owner": {
        # Wildcard full administrative control
        "*:*",
    },
    "manager": {
        "assets:*",
        "maintenance:*",
        "production:*",
        "inventory:*",
        "fleet:*",
        "safety:*",
        "workshop:*",
        "connected_data:*",
        "reports:*",
        "integrations:read",
        "integrations:test",
        "integrations:sync",
        "users:read",
    },
    "engineer": {
        "assets:read",
        "assets:update",
        "maintenance:read",
        "maintenance:create",
        "maintenance:update",
        "maintenance:author_templates",
        "production:read",
        "inventory:read",
        "fleet:read",
        "safety:read",
        "safety:create",
        "safety:update",
        "workshop:read",
        "connected_data:*",
        "reports:read",
    },
    "technician": {
        "assets:read",
        "maintenance:read",
        "maintenance:create",
        "maintenance:update",
        "inventory:read",
        "inventory:request",
        "fleet:read",
        "fleet:create_log",
        "safety:read",
        "safety:report_incident",
        "workshop:read",
        "workshop:update_job",
        "connected_data:read",
    },
    "viewer": {
        "assets:read",
        "maintenance:read",
        "production:read",
        "inventory:read",
        "fleet:read",
        "safety:read",
        "workshop:read",
        "connected_data:read",
        "reports:read",
    },
}
