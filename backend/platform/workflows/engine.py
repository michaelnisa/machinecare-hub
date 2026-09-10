"""
MachineCare Platform - Generic Workflow Architecture
Trigger -> Condition -> Approval -> Action -> Notification
"""

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Dict, Any, Optional, List, Callable

@dataclass
class WorkflowTrigger:
    event_type: str  # e.g. 'work_order.created', 'inventory.low_stock'
    payload: Dict[str, Any]

@dataclass
class WorkflowRule:
    id: str
    organization_id: str
    name: str
    trigger_event: str
    condition_field: str
    condition_operator: str  # 'gt', 'lt', 'eq', 'contains'
    threshold_value: Any
    action_type: str         # 'require_approval', 'notify_role', 'create_po'
    target_role: Optional[str] = None
    is_active: bool = True

class WorkflowEngine:
    def __init__(self):
        self._rules: Dict[str, List[WorkflowRule]] = {}

    def register_rule(self, rule: WorkflowRule) -> None:
        if rule.organization_id not in self._rules:
            self._rules[rule.organization_id] = []
        self._rules[rule.organization_id].append(rule)

    def evaluate_trigger(self, organization_id: str, trigger: WorkflowTrigger) -> List[Dict[str, Any]]:
        actions = []
        rules = self._rules.get(organization_id, [])
        for rule in rules:
            if not rule.is_active or rule.trigger_event != trigger.event_type:
                continue

            field_val = trigger.payload.get(rule.condition_field)
            if field_val is None:
                continue

            matched = False
            if rule.condition_operator == "gt" and field_val > rule.threshold_value:
                matched = True
            elif rule.condition_operator == "lt" and field_val < rule.threshold_value:
                matched = True
            elif rule.condition_operator == "eq" and field_val == rule.threshold_value:
                matched = True

            if matched:
                actions.append({
                    "rule_id": rule.id,
                    "rule_name": rule.name,
                    "action_type": rule.action_type,
                    "target_role": rule.target_role,
                })
        return actions
