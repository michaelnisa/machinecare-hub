"""
MachineCare ERP Integration Platform - SAP Business One Default Field Mappings
Translates SAP Service Layer OData business objects to MachineCare canonical models.
"""

from typing import Dict, List, Any

def get_sap_default_mappings() -> Dict[str, List[Dict[str, Any]]]:
    return {
        "part": [
            {"source_field": "ItemCode", "target_field": "id", "transform_type": "direct", "is_required": True},
            {"source_field": "ItemCode", "target_field": "part_number", "transform_type": "direct", "is_required": True},
            {"source_field": "ItemName", "target_field": "name", "transform_type": "direct", "is_required": True},
            {"source_field": "InventoryUOM", "target_field": "unit", "transform_type": "direct", "default_value": "PCS"},
            {"source_field": "QuantityOnStock", "target_field": "available_quantity", "transform_type": "direct", "default_value": 0.0},
            {"source_field": "QuantityOrderedFromVendors", "target_field": "on_order_quantity", "transform_type": "direct", "default_value": 0.0},
            {"source_field": "AvgStdPrice", "target_field": "unit_cost", "transform_type": "direct", "default_value": 0.0},
            {"source_field": "BarCode", "target_field": "barcode", "transform_type": "direct"}
        ],
        "customer": [
            {"source_field": "CardCode", "target_field": "id", "transform_type": "direct", "is_required": True},
            {"source_field": "CardCode", "target_field": "customer_code", "transform_type": "direct", "is_required": True},
            {"source_field": "CardName", "target_field": "name", "transform_type": "direct", "is_required": True},
            {"source_field": "EmailAddress", "target_field": "email", "transform_type": "direct"},
            {"source_field": "Phone1", "target_field": "phone", "transform_type": "direct"},
            {"source_field": "FederalTaxID", "target_field": "tax_identifier", "transform_type": "direct"}
        ],
        "supplier": [
            {"source_field": "CardCode", "target_field": "id", "transform_type": "direct", "is_required": True},
            {"source_field": "CardCode", "target_field": "supplier_code", "transform_type": "direct", "is_required": True},
            {"source_field": "CardName", "target_field": "name", "transform_type": "direct", "is_required": True},
            {"source_field": "EmailAddress", "target_field": "email", "transform_type": "direct"},
            {"source_field": "Phone1", "target_field": "phone", "transform_type": "direct"}
        ],
        "production_order": [
            {"source_field": "AbsoluteEntry", "target_field": "id", "transform_type": "direct", "is_required": True},
            {"source_field": "DocumentNumber", "target_field": "order_number", "transform_type": "direct", "is_required": True},
            {"source_field": "ItemNo", "target_field": "product_id", "transform_type": "direct"},
            {"source_field": "PlannedQuantity", "target_field": "target_quantity", "transform_type": "direct", "default_value": 0.0},
            {"source_field": "CompletedQuantity", "target_field": "actual_quantity", "transform_type": "direct", "default_value": 0.0},
            {"source_field": "RejectedQuantity", "target_field": "scrap_quantity", "transform_type": "direct", "default_value": 0.0},
            {
                "source_field": "ProductionOrderStatus",
                "target_field": "status",
                "transform_type": "enum_map",
                "transform_config": {
                    "mapping": {
                        "boposPlanned": "planned",
                        "boposReleased": "running",
                        "boposClosed": "completed",
                        "boposCancelled": "cancelled"
                    },
                    "fallback": "planned"
                }
            }
        ],
        "purchase_order": [
            {"source_field": "DocEntry", "target_field": "id", "transform_type": "direct", "is_required": True},
            {"source_field": "DocNum", "target_field": "order_number", "transform_type": "direct", "is_required": True},
            {"source_field": "CardCode", "target_field": "supplier_id", "transform_type": "direct"},
            {"source_field": "DocTotal", "target_field": "total_amount", "transform_type": "direct", "default_value": 0.0},
            {"source_field": "DocCurrency", "target_field": "currency", "transform_type": "direct", "default_value": "TZS"}
        ]
    }
