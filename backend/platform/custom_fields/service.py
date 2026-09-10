"""
MachineCare Platform - Custom Fields Service
"""

from typing import Dict, List, Optional, Any
from .models import CustomFieldDefinition, CustomFieldValue

class CustomFieldsService:
    def __init__(self):
        self._definitions: Dict[str, CustomFieldDefinition] = {}
        self._values: Dict[str, CustomFieldValue] = {}

    def register_field(self, definition: CustomFieldDefinition) -> CustomFieldDefinition:
        self._definitions[definition.id] = definition
        return definition

    def get_fields_for_entity(self, organization_id: str, entity_type: str) -> List[CustomFieldDefinition]:
        return [
            defn for defn in self._definitions.values()
            if defn.organization_id == organization_id and defn.entity_type == entity_type
        ]

    def set_value(self, value: CustomFieldValue) -> CustomFieldValue:
        self._values[value.id] = value
        return value

    def get_values_for_entity(self, organization_id: str, entity_id: str) -> Dict[str, Any]:
        result = {}
        for val in self._values.values():
            if val.organization_id == organization_id and val.entity_id == entity_id:
                defn = self._definitions.get(val.field_definition_id)
                if defn:
                    result[defn.field_key] = val.value
        return result
