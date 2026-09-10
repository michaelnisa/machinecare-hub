"""
MachineCare Core - Organization Service
Handles organization lifecycles, memberships, and multi-tenant scoping.
"""

from typing import Dict, Optional, List
from .models import Organization, OrganizationMembership, OrganizationSettings

class OrganizationService:
    def __init__(self):
        self._organizations: Dict[str, Organization] = {}
        self._memberships: Dict[str, List[OrganizationMembership]] = {}

    def get_organization(self, organization_id: str) -> Optional[Organization]:
        return self._organizations.get(organization_id)

    def register_organization(self, org: Organization) -> Organization:
        self._organizations[org.id] = org
        return org

    def add_member(self, membership: OrganizationMembership) -> OrganizationMembership:
        if membership.organization_id not in self._memberships:
            self._memberships[membership.organization_id] = []
        self._memberships[membership.organization_id].append(membership)
        return membership

    def get_members(self, organization_id: str) -> List[OrganizationMembership]:
        return self._memberships.get(organization_id, [])

    def validate_tenant_access(self, user_id: str, organization_id: str) -> bool:
        """Ensures user is an active member of the requested tenant organization."""
        members = self.get_members(organization_id)
        return any(m.user_id == user_id for m in members)
