"""
MachineCare Workshop / Garage Module - Models & Domain Entities
"""

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Optional, List, Dict

@dataclass
class JobEntity:
    id: str
    organization_id: str
    job_number: str
    customer_name: str
    vehicle_plate: str
    description: str
    status: str = "received"  # received, diagnosed, in_progress, completed, invoiced
    assigned_mechanic: Optional[str] = None
    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

@dataclass
class InvoiceEntity:
    id: str
    organization_id: str
    invoice_number: str
    job_id: str
    subtotal: float
    tax_percent: float = 18.0
    total: float = 0.0
    is_paid: bool = False

class WorkshopService:
    def __init__(self):
        self._jobs: Dict[str, JobEntity] = {}
        self._invoices: Dict[str, InvoiceEntity] = {}

    def create_job(self, job: JobEntity) -> JobEntity:
        self._jobs[job.id] = job
        return job

    def generate_invoice(self, job_id: str, subtotal: float, tax_percent: float = 18.0) -> InvoiceEntity:
        if job_id not in self._jobs:
            raise ValueError("Job not found")
        total = subtotal * (1 + (tax_percent / 100))
        inv = InvoiceEntity(
            id=f"inv_{job_id}",
            organization_id=self._jobs[job_id].organization_id,
            invoice_number=f"INV-{job_id[-6:]}",
            job_id=job_id,
            subtotal=subtotal,
            tax_percent=tax_percent,
            total=round(total, 2),
        )
        self._invoices[inv.id] = inv
        self._jobs[job_id].status = "invoiced"
        return inv
