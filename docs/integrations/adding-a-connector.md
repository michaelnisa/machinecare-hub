# Adding a New ERP Connector to MachineCare

The MachineCare Integration Platform is designed as an open plugin architecture. Adding a 4th, 5th, or 20th ERP connector (e.g. TallyPrime, NetSuite, Sage, or a custom Tanzanian ERP) requires **zero modifications to MachineCare core operational code**.

## Step 1: Subclass `ERPConnector`

Create `backend/integrations/connectors/{your_erp}/connector.py`:

```python
from backend.integrations.core.base import ERPConnector, ConnectorCapabilities, ConnectionTestResult

class MyCustomConnector(ERPConnector):
    def get_capabilities(self) -> ConnectorCapabilities:
        return ConnectorCapabilities(
            read=["parts", "inventory", "assets"],
            write=["purchase_requests"],
            supports_webhooks=True,
        )

    async def test_connection(self) -> ConnectionTestResult:
        # Implement ping/auth validation
        ...

    async def fetch_parts(self, cursor=None, limit=100):
        # Return list of raw dicts
        ...
```

## Step 2: Register in `ConnectorRegistry`

Register metadata in `backend/integrations/connectors/registry.py`:

```python
ConnectorRegistry.register_connector(
    slug="my_erp",
    connector_cls=MyCustomConnector,
    metadata={
        "name": "Custom ERP",
        "category": "ERP",
        "description": "Integration with in-house ERP system.",
        "version": "1.0",
        "status": "available",
        "config_fields": [...],
        "credential_fields": [...],
    }
)
```

## Step 3: Define Default Field Mappings

Specify canonical mappings translating your ERP's payload keys to standard MachineCare entity fields.

The new connector will automatically appear in the Marketplace, Wizard, and Sync Engine!
