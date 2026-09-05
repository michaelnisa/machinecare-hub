"""
MachineCare ERP Integration Platform - Field Mapping Engine
Applies declarative field mapping rules and generates data previews.
"""

from typing import Any, Dict, List, Optional
from backend.integrations.mappings.transformer import ValueTransformer
from backend.integrations.core.exceptions import MappingError

class MappingEngine:
    """Orchestrates entity-level field mappings between ERP schemas and MachineCare."""

    @staticmethod
    def _get_nested(obj: Dict[str, Any], path: str) -> Any:
        """Retrieves value from nested dictionary or dot-notated path."""
        parts = path.split(".")
        cur = obj
        for part in parts:
            if isinstance(cur, dict):
                cur = cur.get(part)
            else:
                return None
        return cur

    @staticmethod
    def _set_nested(obj: Dict[str, Any], path: str, val: Any) -> None:
        """Sets value into dictionary with dot-notated path."""
        parts = path.split(".")
        cur = obj
        for part in parts[:-1]:
            if part not in cur or not isinstance(cur[part], dict):
                cur[part] = {}
            cur = cur[part]
        cur[parts[-1]] = val

    def map_record(
        self,
        source_record: Dict[str, Any],
        mapping_rules: List[Dict[str, Any]],
        reverse: bool = False,
    ) -> Dict[str, Any]:
        """
        Transforms a record using declared mapping rules.
        Each rule contains:
            source_field: str (dot-notated)
            target_field: str (dot-notated)
            transform_type: str ('direct', 'rename', 'constant', 'enum_map', 'unit_convert', 'formula', 'lookup')
            transform_config: Optional[dict]
            default_value: Optional[any]
            is_required: bool
        """
        output: Dict[str, Any] = {}

        for rule in mapping_rules:
            src_key = rule["target_field"] if reverse else rule["source_field"]
            tgt_key = rule["source_field"] if reverse else rule["target_field"]
            t_type = rule.get("transform_type", "direct")
            t_cfg = rule.get("transform_config", {})
            default_val = rule.get("default_value")
            is_required = rule.get("is_required", False)

            # In reverse mode, enum maps invert their lookup
            if reverse and t_type == "enum_map":
                orig_mapping = t_cfg.get("mapping", {})
                inv_mapping = {v: k for k, v in orig_mapping.items()}
                t_cfg = {**t_cfg, "mapping": inv_mapping}

            raw_val = self._get_nested(source_record, src_key)
            if raw_val is None and is_required and default_val is None:
                raise MappingError(
                    f"Required field '{src_key}' missing from source payload",
                    field=src_key,
                )

            transformed_val = ValueTransformer.transform(
                raw_val,
                transform_type=t_type,
                config=t_cfg,
                default_value=default_val,
            )

            self._set_nested(output, tgt_key, transformed_val)

        return output

    def preview_mapping(
        self,
        source_sample: Dict[str, Any],
        mapping_rules: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        """Generates a side-by-side preview showing source, rules, and resulting target."""
        target_result = self.map_record(source_sample, mapping_rules)
        return {
            "source": source_sample,
            "target": target_result,
            "rules_applied_count": len(mapping_rules),
        }
