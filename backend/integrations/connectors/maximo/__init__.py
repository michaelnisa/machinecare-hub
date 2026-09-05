"""
MachineCare ERP Integration Platform - IBM Maximo EAM Connector
"""

from backend.integrations.connectors.maximo.connector import MaximoConnector
from backend.integrations.connectors.maximo.capabilities import get_maximo_capabilities
from backend.integrations.connectors.maximo.mapper import get_maximo_default_mappings

__all__ = ["MaximoConnector", "get_maximo_capabilities", "get_maximo_default_mappings"]
