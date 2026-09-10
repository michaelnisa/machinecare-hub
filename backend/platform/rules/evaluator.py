"""
MachineCare Platform - Configurable Business Rules Engine
Evaluates dynamic operational rules without hardcoded customer checks.
"""

from typing import Dict, Any, List

class BusinessRulesEngine:
    """Evaluates IF-THEN conditions across domain resources."""

    @staticmethod
    def evaluate_rule(condition: Dict[str, Any], context: Dict[str, Any]) -> bool:
        """
        Example condition:
        {"field": "downtime_minutes", "operator": ">=", "value": 60}
        """
        field_val = context.get(condition.get("field"))
        if field_val is None:
            return False

        op = condition.get("operator")
        val = condition.get("value")

        if op == ">=":
            return field_val >= val
        elif op == ">":
            return field_val > val
        elif op == "<=":
            return field_val <= val
        elif op == "<":
            return field_val < val
        elif op == "==":
            return field_val == val
        return False
