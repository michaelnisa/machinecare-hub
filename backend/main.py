"""
MachineCare ERP Integration Platform - FastAPI Application Entrypoint
Hosts the REST API service and provides background job execution.
"""

import os
from fastapi import FastAPI, HTTPException, Header, Depends
from fastapi.middleware.cors import CORSMiddleware
from typing import Dict, Any, Optional

from backend.integrations.api.routes import IntegrationAPIService
from backend.integrations.core.exceptions import IntegrationError

app = FastAPI(
    title="MachineCare ERP Integration Engine",
    version="2.0.0",
    description="Operational intelligence bridge connecting enterprise ERPs (Odoo, SAP, Dynamics 365) to physical machines and assets.",
)

# Enable CORS for MachineCare frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

service = IntegrationAPIService()

@app.get("/health")
def health_check():
    return {
        "status": "HEALTHY",
        "service": "machinecare-erp-engine",
        "version": "2.0.0",
        "vault": "AES-256-GCM active",
    }

@app.get("/api/v1/integrations/marketplace")
def list_marketplace():
    return service.list_marketplace()

@app.get("/api/v1/integrations")
def list_integrations(x_organisation_id: str = Header(..., alias="X-Organisation-ID")):
    return service.list_integrations(organization_id=x_organisation_id)

@app.post("/api/v1/integrations")
def create_integration(payload: Dict[str, Any], x_organisation_id: str = Header(..., alias="X-Organisation-ID")):
    try:
        return service.create_integration(organization_id=x_organisation_id, payload=payload)
    except IntegrationError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/v1/integrations/{integration_id}/test")
async def test_integration(integration_id: str):
    try:
        return await service.test_integration(integration_id)
    except IntegrationError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/v1/integrations/{integration_id}/sync")
async def trigger_sync(integration_id: str, payload: Dict[str, Any]):
    entity_type = payload.get("entity_type", "parts")
    limit = payload.get("limit", 100)
    try:
        return await service.trigger_sync(integration_id=integration_id, entity_type=entity_type, limit=limit)
    except IntegrationError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/api/v1/integrations/{integration_id}/sync-history")
def get_sync_history(integration_id: str):
    return service.get_sync_history(integration_id)

@app.get("/api/v1/integrations/{integration_id}/mappings")
def get_mappings(integration_id: str):
    return service.get_mappings(integration_id)

@app.put("/api/v1/integrations/{integration_id}/mappings")
def update_mappings(integration_id: str, payload: Dict[str, Any]):
    entity_type = payload.get("entity_type", "part")
    rules = payload.get("rules", [])
    return service.update_mappings(integration_id, entity_type, rules)

@app.post("/api/v1/integrations/test-mapping")
def test_mapping(payload: Dict[str, Any]):
    source = payload.get("source", {})
    rules = payload.get("rules", [])
    return service.test_mapping(source, rules)

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("backend.main:app", host="0.0.0.0", port=port, reload=True)
