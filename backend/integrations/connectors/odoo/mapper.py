"""
MachineCare ERP Integration Platform - Odoo Field Mappings
Standard default field mappings translating Odoo JSON-2 structures to MachineCare.
"""

from typing import Dict, List, Any

def get_odoo_default_mappings() -> Dict[str, List[Dict[str, Any]]]:
    """Returns canonical default field mappings for Odoo entities."""
    return {
        "asset": [
            {"source_field": "id", "target_field": "id", "transform_type": "direct", "is_required": True},
            {"source_field": "name", "target_field": "name", "transform_type": "direct", "is_required": True},
            {"source_field": "serial_no", "target_field": "serial_number", "transform_type": "direct"},
            {"source_field": "model", "target_field": "model", "transform_type": "direct"},
            {"source_field": "location", "target_field": "location", "transform_type": "direct"},
            {"source_field": "partner_ref", "target_field": "manufacturer", "transform_type": "direct"},
            {
                "source_field": "effective_date",
                "target_field": "commission_date",
                "transform_type": "direct"
            },
            {
                "source_field": "category_id",
                "target_field": "asset_type",
                "transform_type": "custom",
                "transform_config": {"template": "{val}"},
                "default_value": "equipment"
            }
        ],
        "part": [
            {"source_field": "id", "target_field": "id", "transform_type": "direct", "is_required": True},
            {"source_field": "default_code", "target_field": "part_number", "transform_type": "direct", "is_required": True},
            {"source_field": "name", "target_field": "name", "transform_type": "direct", "is_required": True},
            {"source_field": "description", "target_field": "description", "transform_type": "direct"},
            {"source_field": "uom_name", "target_field": "unit", "transform_type": "direct", "default_value": "PCS"},
            {"source_field": "qty_available", "target_field": "available_quantity", "transform_type": "direct", "default_value": 0.0},
            {"source_field": "standard_price", "target_field": "unit_cost", "transform_type": "direct", "default_value": 0.0},
            {"source_field": "barcode", "target_field": "barcode", "transform_type": "direct"}
        ],
        "inventory": [
            {"source_field": "id", "target_field": "id", "transform_type": "direct", "is_required": True},
            {"source_field": "product_id", "target_field": "part_id", "transform_type": "direct", "is_required": True},
            {"source_field": "location_id", "target_field": "warehouse_id", "transform_type": "direct", "is_required": True},
            {"source_field": "quantity", "target_field": "available_quantity", "transform_type": "direct", "default_value": 0.0},
            {"source_field": "reserved_quantity", "target_field": "reserved_quantity", "transform_type": "direct", "default_value": 0.0}
        ],
        "customer": [
            {"source_field": "id", "target_field": "id", "transform_type": "direct", "is_required": True},
            {"source_field": "name", "target_field": "name", "transform_type": "direct", "is_required": True},
            {"source_field": "email", "target_field": "email", "transform_type": "direct"},
            {"source_field": "phone", "target_field": "phone", "transform_type": "direct"},
            {"source_field": "vat", "target_field": "tax_identifier", "transform_type": "direct"}
        ],
        "production_order": [
            {"source_field": "id", "target_field": "id", "transform_type": "direct", "is_required": True},
            {"source_field": "name", "target_field": "order_number", "transform_type": "direct", "is_required": True},
            {"source_field": "product_qty", "target_field": "target_quantity", "transform_type": "direct", "default_value": 0.0},
            {"source_field": "qty_produced", "target_field": "actual_quantity", "transform_type": "direct", "default_value": 0.0},
            {
                "source_field": "state",
                "target_field": "status",
                "transform_type": "enum_map",
                "transform_config": {
                    "mapping": {
                        "draft": "planned",
                        "confirmed": "planned",
                        "progress": "running",
                        "to_close": "running",
                        "done": "completed",
                        "cancel": "cancelled"
                    },
                    "fallback": "planned"
                }
            }
        ],
        "purchase_order": [
            {"source_field": "id", "target_field": "id", "transform_type": "direct", "is_required": True},
            {"source_field": "name", "target_field": "order_number", "transform_type": "direct", "is_required": True},
            {"source_field": "amount_total", "target_field": "total_amount", "transform_type": "direct", "default_value": 0.0},
            {
                "source_field": "state",
                "target_field": "status",
                "transform_type": "enum_map",
                "transform_config": {
                    "mapping": {
                        "draft": "draft",
                        "sent": "draft",
                        "purchase": "ordered",
                        "done": "received",
                        "cancel": "cancelled"
                    }
                }
            }
        ]
    }
