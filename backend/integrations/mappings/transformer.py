"""
MachineCare ERP Integration Platform - Field Transformer Engine
Supports Direct, Rename, Constant, Lookup, Formula, Enum Mapping, and Unit Conversion.
"""

from typing import Any, Dict, Optional
from backend.integrations.core.exceptions import MappingError

class ValueTransformer:
    """Transforms values between ERP formats and MachineCare Canonical formats."""

    # Standard Unit Conversion Ratios to Base Units
    UNIT_FACTORS = {
        # Mass (base: KG)
        "KG": 1.0,
        "G": 0.001,
        "LBS": 0.453592,
        "TON": 1000.0,
        # Volume (base: LITER)
        "L": 1.0,
        "LITER": 1.0,
        "ML": 0.001,
        "GALLON": 3.78541,
        # Length (base: METER)
        "M": 1.0,
        "CM": 0.01,
        "MM": 0.001,
        "INCH": 0.0254,
        "FT": 0.3048,
        # Quantity
        "PCS": 1.0,
        "DOZEN": 12.0,
        "BOX": 1.0,
    }

    @classmethod
    def transform(
        cls,
        source_value: Any,
        transform_type: str,
        config: Optional[Dict[str, Any]] = None,
        default_value: Any = None,
    ) -> Any:
        config = config or {}

        if source_value is None:
            return default_value

        try:
            if transform_type in ("direct", "rename"):
                return source_value

            elif transform_type == "constant":
                return config.get("value", default_value)

            elif transform_type == "enum_map":
                # e.g. {"available": "active", "draft": "pending"}
                mapping_table = config.get("mapping", {})
                normalized_key = str(source_value).lower().strip()
                for k, v in mapping_table.items():
                    if str(k).lower().strip() == normalized_key:
                        return v
                return config.get("fallback", default_value if default_value is not None else source_value)

            elif transform_type == "unit_convert":
                # config: {"from_unit": "LBS", "to_unit": "KG"}
                from_u = str(config.get("from_unit", "")).upper()
                to_u = str(config.get("to_unit", "")).upper()
                val = float(source_value)
                if from_u in cls.UNIT_FACTORS and to_u in cls.UNIT_FACTORS:
                    base_val = val * cls.UNIT_FACTORS[from_u]
                    return round(base_val / cls.UNIT_FACTORS[to_u], 4)
                return source_value

            elif transform_type == "formula":
                # Simple math formula support (e.g., "val * 1.18" or "round(val, 2)")
                expr = config.get("expression", "")
                if not expr:
                    return source_value
                # Safe eval with restricted globals
                safe_dict = {
                    "val": float(source_value) if isinstance(source_value, (int, float, str)) and str(source_value).replace('.', '', 1).isdigit() else source_value,
                    "round": round,
                    "abs": abs,
                    "min": min,
                    "max": max,
                    "int": int,
                    "float": float,
                    "str": str,
                }
                return eval(expr, {"__builtins__": None}, safe_dict)

            elif transform_type == "lookup":
                table = config.get("lookup_table", {})
                return table.get(str(source_value), default_value)

            elif transform_type == "custom":
                # Prefix, suffix, or string template
                template = config.get("template", "{val}")
                return template.format(val=source_value)

            else:
                return source_value

        except Exception as err:
            raise MappingError(
                f"Failed to transform value '{source_value}' using '{transform_type}': {str(err)}",
                details={"config": config}
            )
