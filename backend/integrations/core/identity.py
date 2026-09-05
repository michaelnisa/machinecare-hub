"""
MachineCare ERP Integration Platform - External Identity & Idempotency System
Ensures that external ERP records always map deterministically to MachineCare canonical entities,
preventing duplicate records and supporting multiple ERP cross-references.
"""

import hashlib
import json
import uuid
from typing import Dict, Optional, Tuple

class ExternalIdentityManager:
    """
    Manages the correlation between external ERP keys and MachineCare canonical IDs.
    """

    def __init__(self, db_client=None):
        self.db = db_client
        # In-memory fast cache for identity resolution
        self._identity_cache: Dict[Tuple[str, str, str, str], str] = {}
        self._reverse_cache: Dict[Tuple[str, str, str, str], str] = {}

    @staticmethod
    def compute_record_hash(data: Dict) -> str:
        """Computes SHA-256 hash of payload to detect change deltas."""
        serialized = json.dumps(data, sort_keys=True, default=str)
        return hashlib.sha256(serialized.encode("utf-8")).hexdigest()

    @staticmethod
    def generate_canonical_id(entity_type: str) -> str:
        """Generates independent MachineCare canonical ID (e.g. mc_asset_123)."""
        short_uuid = uuid.uuid4().hex[:12]
        return f"mc_{entity_type}_{short_uuid}"

    def resolve_canonical_id(
        self,
        organization_id: str,
        source_system: str,
        external_entity_type: str,
        external_entity_id: str,
        canonical_entity_type: str,
    ) -> Tuple[str, bool]:
        """
        Resolves existing canonical ID for an external ERP record, or allocates a new canonical ID.
        Returns:
            (canonical_id, is_new)
        """
        cache_key = (organization_id, source_system, external_entity_type, str(external_entity_id))

        if cache_key in self._identity_cache:
            return self._identity_cache[cache_key], False

        # In real runtime with Supabase DB client:
        if self.db:
            res = self.db.table("external_identities").select("canonical_entity_id").eq(
                "organisation_id", organization_id
            ).eq("source_system", source_system).eq(
                "external_entity_type", external_entity_type
            ).eq("external_entity_id", str(external_entity_id)).maybe_single().execute()
            
            if res and getattr(res, "data", None):
                canonical_id = res.data["canonical_entity_id"]
                self._identity_cache[cache_key] = canonical_id
                return canonical_id, False

        # If not found, generate new canonical ID
        new_canonical_id = self.generate_canonical_id(canonical_entity_type)
        self._identity_cache[cache_key] = new_canonical_id
        rev_key = (organization_id, canonical_entity_type, new_canonical_id, source_system)
        self._reverse_cache[rev_key] = str(external_entity_id)

        return new_canonical_id, True

    def get_external_id(
        self,
        organization_id: str,
        canonical_entity_type: str,
        canonical_entity_id: str,
        target_system: str,
    ) -> Optional[str]:
        """Returns the external system ID associated with a MachineCare canonical entity."""
        rev_key = (organization_id, canonical_entity_type, canonical_entity_id, target_system)
        if rev_key in self._reverse_cache:
            return self._reverse_cache[rev_key]
        return None

    def record_mapping(
        self,
        organization_id: str,
        source_system: str,
        external_entity_type: str,
        external_entity_id: str,
        canonical_entity_type: str,
        canonical_entity_id: str,
        record_hash: Optional[str] = None
    ) -> None:
        """Stores or caches the verified mapping between external and canonical identities."""
        cache_key = (organization_id, source_system, external_entity_type, str(external_entity_id))
        rev_key = (organization_id, canonical_entity_type, canonical_entity_id, source_system)
        self._identity_cache[cache_key] = canonical_entity_id
        self._reverse_cache[rev_key] = str(external_entity_id)
