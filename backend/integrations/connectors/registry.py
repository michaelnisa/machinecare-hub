"""
MachineCare ERP Integration Platform - Connector Registry & Marketplace Catalog
Allows dynamic registration of ERP adapters without rewriting core platform code.
"""

from typing import Dict, Any, List, Type, Optional
from backend.integrations.core.base import ERPConnector
from backend.integrations.connectors.odoo.connector import OdooConnector
from backend.integrations.connectors.odoo.capabilities import get_odoo_capabilities
from backend.integrations.connectors.odoo.mapper import get_odoo_default_mappings

from backend.integrations.connectors.sap_business_one.connector import SapBusinessOneConnector
from backend.integrations.connectors.sap_business_one.capabilities import get_sap_capabilities
from backend.integrations.connectors.sap_business_one.mapper import get_sap_default_mappings

from backend.integrations.connectors.dynamics_365.connector import Dynamics365Connector
from backend.integrations.connectors.dynamics_365.capabilities import get_dynamics_capabilities
from backend.integrations.connectors.dynamics_365.mapper import get_dynamics_default_mappings

from backend.integrations.connectors.maximo.connector import MaximoConnector
from backend.integrations.connectors.maximo.capabilities import get_maximo_capabilities
from backend.integrations.connectors.maximo.mapper import get_maximo_default_mappings

class ConnectorRegistry:
    """Registry maintaining metadata, schemas, and classes for all supported ERPs and EAMs."""

    _connectors: Dict[str, Type[ERPConnector]] = {
        "odoo": OdooConnector,
        "sap_business_one": SapBusinessOneConnector,
        "dynamics_365": Dynamics365Connector,
        "maximo": MaximoConnector,
    }

    _catalog: Dict[str, Dict[str, Any]] = {
        "odoo": {
            "slug": "odoo",
            "name": "Odoo",
            "category": "ERP",
            "description": "All-in-one open-source ERP covering manufacturing, inventory, equipment maintenance, and purchasing.",
            "version": "19.0+ JSON-2",
            "status": "available",
            "logo": "odoo",
            "docs_url": "https://www.odoo.com/documentation/19.0/developer/reference/external_api.html",
            "config_fields": [
                {"key": "base_url", "label": "Odoo Server URL", "type": "text", "placeholder": "https://my-company.odoo.com", "required": True},
                {"key": "company_identifier", "label": "Database Name", "type": "text", "placeholder": "my_db_production", "required": True},
            ],
            "credential_fields": [
                {"key": "api_key", "label": "API Key / Bearer Token", "type": "password", "required": True},
                {"key": "username", "label": "Bot Username / Email", "type": "text", "placeholder": "integrations@company.com", "required": True},
            ],
            "capabilities": get_odoo_capabilities().to_dict(),
            "default_mappings": get_odoo_default_mappings(),
        },
        "sap_business_one": {
            "slug": "sap_business_one",
            "name": "SAP Business One",
            "category": "ERP",
            "description": "Comprehensive enterprise ERP for small and midsize manufacturing and distribution businesses via Service Layer OData.",
            "version": "10.0 FP2105+ Service Layer",
            "status": "available",
            "logo": "sap",
            "docs_url": "https://help.sap.com/doc/6b9c8e22c01648e8bc3049667e30c024/10.0/en-US/Service_Layer_API_Reference.html",
            "config_fields": [
                {"key": "base_url", "label": "Service Layer URL", "type": "text", "placeholder": "https://sap.mycompany.com:50000/b1s/v1", "required": True},
                {"key": "company_identifier", "label": "Company DB", "type": "text", "placeholder": "SBODEMOUS", "required": True},
            ],
            "credential_fields": [
                {"key": "username", "label": "Service Layer Username", "type": "text", "placeholder": "manager", "required": True},
                {"key": "password", "label": "Service Layer Password", "type": "password", "required": True},
            ],
            "capabilities": get_sap_capabilities().to_dict(),
            "default_mappings": get_sap_default_mappings(),
        },
        "dynamics_365": {
            "slug": "dynamics_365",
            "name": "Microsoft Dynamics 365 Business Central",
            "category": "ERP",
            "description": "Cloud business management solution connecting financials, operations, supply chain, and manufacturing via REST API v2.0.",
            "version": "v2.0 REST API (OAuth 2.0)",
            "status": "available",
            "logo": "dynamics",
            "docs_url": "https://learn.microsoft.com/en-us/dynamics365/business-central/dev-itpro/api-reference/v2.0/",
            "config_fields": [
                {"key": "base_url", "label": "Base API URL", "type": "text", "placeholder": "https://api.businesscentral.dynamics.com", "required": True},
                {"key": "environment", "label": "Environment", "type": "text", "placeholder": "production", "required": True},
                {"key": "company_identifier", "label": "Company ID / GUID", "type": "text", "placeholder": "00000000-0000-0000-0000-000000000000", "required": True},
            ],
            "credential_fields": [
                {"key": "tenant_id", "label": "Azure AD Tenant ID", "type": "text", "required": True},
                {"key": "client_id", "label": "OAuth Client ID", "type": "text", "required": True},
                {"key": "client_secret", "label": "OAuth Client Secret", "type": "password", "required": True},
            ],
            "capabilities": get_dynamics_capabilities().to_dict(),
            "default_mappings": get_dynamics_default_mappings(),
        },
        "maximo": {
            "slug": "maximo",
            "name": "IBM Maximo",
            "category": "EAM",
            "description": "Enterprise Asset Management system of record. Bidirectional sync for work orders, asset hierarchies, MRO inventory, and IoT sensor meter readings.",
            "version": "Manage / MAS 8.11+ OSLC REST",
            "status": "available",
            "logo": "maximo",
            "docs_url": "https://www.ibm.com/docs/en/mam/7.6.1?topic=framework-rest-api",
            "config_fields": [
                {"key": "base_url", "label": "Maximo Server Base URL", "type": "text", "placeholder": "https://maximo.enterprise.corp", "required": True},
                {"key": "company_identifier", "label": "Site ID", "type": "text", "placeholder": "BEDFORD / SITE_01", "required": True},
                {"key": "org_id", "label": "Organization ID", "type": "text", "placeholder": "EAGLE_MINING", "required": False},
            ],
            "credential_fields": [
                {"key": "api_key", "label": "Maximo API Key (Recommended)", "type": "password", "placeholder": "maximo_apikey_••••••••", "required": False},
                {"key": "username", "label": "MaxAuth Username", "type": "text", "placeholder": "wilson", "required": False},
                {"key": "password", "label": "MaxAuth Password", "type": "password", "placeholder": "••••••••", "required": False},
            ],
            "capabilities": get_maximo_capabilities().to_dict(),
            "default_mappings": get_maximo_default_mappings(),
        },
        "tally": {
            "slug": "tally",
            "name": "TallyPrime",
            "category": "Accounting",
            "description": "Leading business management and accounting software across East Africa and India.",
            "version": "Prime 4.0 XML/JSON Gateway",
            "status": "coming_soon",
            "logo": "tally",
            "docs_url": "https://tallysolutions.com",
            "config_fields": [],
            "credential_fields": [],
            "capabilities": {"read": ["parts", "inventory"], "write": ["purchase_requests"]},
        },
        "netsuite": {
            "slug": "netsuite",
            "name": "Oracle NetSuite",
            "category": "ERP",
            "description": "Unified cloud business management suite including ERP, financials, CRM and ecommerce via SuiteTalk REST.",
            "version": "SuiteTalk 2026.1 REST",
            "status": "coming_soon",
            "logo": "netsuite",
            "docs_url": "https://docs.oracle.com/en/cloud/saas/netsuite/",
            "config_fields": [],
            "credential_fields": [],
            "capabilities": {"read": ["assets", "parts", "inventory", "production_orders"], "write": ["purchase_requests"]},
        },
        "zoho": {
            "slug": "zoho",
            "name": "Zoho Books & Inventory",
            "category": "Inventory",
            "description": "Smart inventory and order management system for growing physical asset enterprises.",
            "version": "v3 REST",
            "status": "coming_soon",
            "logo": "zoho",
            "docs_url": "https://www.zoho.com/inventory/api/v1/",
            "config_fields": [],
            "credential_fields": [],
            "capabilities": {"read": ["parts", "inventory"], "write": ["purchase_requests"]},
        },
    }

    @classmethod
    def get_catalog(cls) -> List[Dict[str, Any]]:
        """Returns all integrations available in the marketplace."""
        return list(cls._catalog.values())

    @classmethod
    def get_connector_info(cls, slug: str) -> Optional[Dict[str, Any]]:
        return cls._catalog.get(slug)

    @classmethod
    def get_connector_class(cls, slug: str) -> Optional[Type[ERPConnector]]:
        return cls._connectors.get(slug)

    @classmethod
    def register_connector(cls, slug: str, connector_cls: Type[ERPConnector], metadata: Dict[str, Any]) -> None:
        """Enables pluggable additions of new connectors (e.g. Sage, custom ERP)."""
        cls._connectors[slug] = connector_cls
        cls._catalog[slug] = metadata
