"""
Unit Tests for MachineCare Platform Layer & Extension Registry
"""

import unittest
from backend.platform.custom_fields import CustomFieldDefinition, CustomFieldValue, CustomFieldsService
from backend.platform.feature_flags import FeatureFlagService
from backend.platform.workflows import WorkflowTrigger, WorkflowRule, WorkflowEngine
from backend.platform.rules import BusinessRulesEngine
from backend.platform.audit import AuditLogEntry, AuditService
from backend.platform.extensions import ExtensionRegistry
from backend.extensions.xyz_mining import xyz_mining_extension

class TestPlatformLayer(unittest.TestCase):
    def test_custom_fields(self):
        svc = CustomFieldsService()
        defn = CustomFieldDefinition(
            id="cf_1",
            organization_id="org_mining",
            entity_type="asset",
            field_key="pit_number",
            field_label="Pit Number",
            field_type="text",
        )
        svc.register_field(defn)

        svc.set_value(CustomFieldValue(
            id="val_1",
            organization_id="org_mining",
            field_definition_id="cf_1",
            entity_id="asset_drill_01",
            value="Pit-4B",
        ))

        values = svc.get_values_for_entity("org_mining", "asset_drill_01")
        self.assertEqual(values.get("pit_number"), "Pit-4B")

        # Confirm isolation: other org sees no values
        other_values = svc.get_values_for_entity("org_standard", "asset_drill_01")
        self.assertEqual(len(other_values), 0)

    def test_feature_flags(self):
        ff = FeatureFlagService()
        # Enable mining capability for org_1 only
        ff.set_feature("org_1", "mining_operations", True)
        self.assertTrue(ff.is_feature_enabled("org_1", "mining_operations"))
        self.assertFalse(ff.is_feature_enabled("org_2", "mining_operations"))

    def test_workflow_engine(self):
        engine = WorkflowEngine()
        rule = WorkflowRule(
            id="wf_1",
            organization_id="org_1",
            name="High Value Work Order Approval",
            trigger_event="work_order.created",
            condition_field="cost",
            condition_operator="gt",
            threshold_value=5000000,
            action_type="require_approval",
            target_role="manager",
        )
        engine.register_rule(rule)

        # Trigger with low cost: no action
        low_actions = engine.evaluate_trigger("org_1", WorkflowTrigger(
            event_type="work_order.created",
            payload={"cost": 1000000}
        ))
        self.assertEqual(len(low_actions), 0)

        # Trigger with high cost: requires approval
        high_actions = engine.evaluate_trigger("org_1", WorkflowTrigger(
            event_type="work_order.created",
            payload={"cost": 7500000}
        ))
        self.assertEqual(len(high_actions), 1)
        self.assertEqual(high_actions[0]["action_type"], "require_approval")

    def test_business_rules_engine(self):
        condition = {"field": "downtime_minutes", "operator": ">=", "value": 60}
        self.assertTrue(BusinessRulesEngine.evaluate_rule(condition, {"downtime_minutes": 75}))
        self.assertFalse(BusinessRulesEngine.evaluate_rule(condition, {"downtime_minutes": 30}))

    def test_audit_logging_isolation(self):
        audit = AuditService()
        audit.log(AuditLogEntry(
            id="log_1", organization_id="org_alpha", user_id="usr_1", action="create",
            resource="work_order", resource_id="wo_100"
        ))
        audit.log(AuditLogEntry(
            id="log_2", organization_id="org_beta", user_id="usr_2", action="delete",
            resource="asset", resource_id="ast_200"
        ))

        alpha_logs = audit.get_audit_trail("org_alpha")
        self.assertEqual(len(alpha_logs), 1)
        self.assertEqual(alpha_logs[0].resource_id, "wo_100")

    def test_extension_registry_runtime_scoping(self):
        registry = ExtensionRegistry()
        registry.register_package(xyz_mining_extension)

        # Enable for org_mining only
        registry.enable_for_organization("org_mining", "xyz_mining")

        self.assertTrue(registry.is_enabled("org_mining", "xyz_mining"))
        self.assertFalse(registry.is_enabled("org_standard", "xyz_mining"))

        # Test hook execution
        result = registry.execute_hook("org_mining", "xyz_mining", "on_haul_cycle", tonnage=120.0, haul_time_minutes=30.0)
        self.assertEqual(result, 240.0)

        # Standard customer execution returns None
        unauthorized_result = registry.execute_hook("org_standard", "xyz_mining", "on_haul_cycle", tonnage=120.0, haul_time_minutes=30.0)
        self.assertIsNone(unauthorized_result)

if __name__ == "__main__":
    unittest.main()
