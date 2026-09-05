"""
MachineCare ERP Integration Platform - Microsoft Dynamics 365 Field Mappings
Translates Business Central API v2.0 entities to MachineCare canonical models.
"""

from typing import Dict, List, Any

def get_dynamics_default_mappings() -> Dict[str, List[Dict[str, Any]]]:
    return {
        "part": [
            {"source_field": "id", "target_field": "id", "transform_type": "direct", "is_required": True},
            {"source_field": "number", "target_field": "part_number", "transform_type": "direct", "is_required": True},
            {"source_field": "displayName", "target_field": "name", "transform_type": "direct", "is_required": True},
            {"source_field": "baseUnitOfMeasureCode", "target_field": "unit", "transform_type": "direct", "default_value": "PCS"},
            {"source_field": "inventory", "target_field": "available_quantity", "transform_type": "direct", "default_value": 0.0},
            {"source_field": "unitCost", "target_field": "unit_cost", "transform_type": "direct", "default_value": 0.0},
            {"source_field": "gtin", "target_field": "barcode", "transform_type": "direct"}
        ],
        "customer": [
            {"source_field": "id", "target_field": "id", "transform_type": "direct", "is_required": True},
            {"source_field": "number", "target_field": "customer_code", "transform_type": "direct", "is_required": True},
            {"source_field": "displayName", "target_field": "name", "transform_type": "direct", "is_required": True},
            {"source_field": "email", "target_field": "email", "transform_type": "direct"},
            {"source_field": "phoneNumber", "target_field": "phone", "transform_type": "direct"},
            {"source_field": "taxRegistrationNumber", "target_field": "tax_identifier", "transform_type": "direct"}
        ],
        "supplier": [
            {"source_field": "id", "target_field": "id", "transform_type": "direct", "is_required": True},
            {"source_field": "number", "target_field": "supplier_code", "transform_type": "direct", "is_required": True},
            {"source_field": "displayName", "target_field": "name", "transform_type": "direct", "is_required": True},
            {"source_field": "email", "target_field": "email", "transform_type": "direct"},
            {"source_field": "phoneNumber", "target_field": "phone", "transform_type": "direct"}
        ],
        "purchase_order": [
            {"source_field": "id", "target_field": "id", "transform_type": "direct", "is_required": True},
            {"source_field": "number", "target_field": "order_number", "transform_type": "direct", "is_required": True},
            {"source_field": "vendorNumber", "target_field": "supplier_id", "transform_type": "direct"},
            {"source_field": "totalAmountIncludingTax", "target_field": "total_amount", "transform_type": "direct", "default_value": 0.0},
            {
                "source_field": "status",
                "target_field": "status",
                "transform_type": "enum_map",
                "transform_config": {
                    "mapping": {
                        "Draft": "draft",
                        "In Review": "draft",
                        "Open": "ordered",
                        "Released": "received"
                    }
                }
            }
        ]
    }
