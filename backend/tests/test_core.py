"""
Unit Tests for MachineCare Backend Core Layer
"""

import unittest
from backend.core.auth import AuthService
from backend.core.organizations import Organization, OrganizationService, OrganizationMembership
from backend.core.users import User, UserService
from backend.core.permissions import PermissionChecker
from backend.core.configuration import ConfigurationService

class TestCoreLayer(unittest.TestCase):
    def test_auth_service(self):
        auth = AuthService()
        # Test empty token validation
        with self.assertRaises(ValueError):
            auth.verify_token("")

    def test_organization_service(self):
        svc = OrganizationService()
        org = Organization(id="org_123", name="Test Org")
        svc.register_organization(org)
        self.assertEqual(svc.get_organization("org_123").name, "Test Org")

        member = OrganizationMembership(id="mem_1", organization_id="org_123", user_id="user_1", role="manager")
        svc.add_member(member)
        self.assertTrue(svc.validate_tenant_access("user_1", "org_123"))
        self.assertFalse(svc.validate_tenant_access("user_999", "org_123"))

    def test_permission_checker(self):
        # Owner has wildcard
        self.assertTrue(PermissionChecker.has_permission("owner", "anything:action"))
        # Manager has assets:*
        self.assertTrue(PermissionChecker.has_permission("manager", "assets:read"))
        self.assertTrue(PermissionChecker.has_permission("manager", "assets:delete"))
        # Viewer cannot create assets
        self.assertFalse(PermissionChecker.has_permission("viewer", "assets:create"))
        self.assertTrue(PermissionChecker.has_permission("viewer", "assets:read"))

    def test_configuration_service(self):
        cfg_svc = ConfigurationService()
        cfg = cfg_svc.get_tenant_config("org_abc")
        self.assertTrue(cfg_svc.is_module_enabled("org_abc", "maintenance"))
        self.assertEqual(cfg.numbering.work_order_prefix, "WO-")

if __name__ == "__main__":
    unittest.main()
