"""
MachineCare Core - User Models
"""

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Optional

@dataclass
class User:
    id: str
    email: str
    full_name: Optional[str] = None
    department: Optional[str] = None
    phone: Optional[str] = None
    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    is_active: bool = True
