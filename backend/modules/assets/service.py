"""
MachineCare Assets Module - Public Service Interface
"""

from typing import Dict, Optional, List
from .models import AssetEntity, MeterReading

class AssetService:
    def __init__(self):
        self._assets: Dict[str, AssetEntity] = {}
        self._meter_readings: Dict[str, List[MeterReading]] = {}

    def get_asset(self, organization_id: str, asset_id: str) -> Optional[AssetEntity]:
        asset = self._assets.get(asset_id)
        if asset and asset.organization_id == organization_id:
            return asset
        return None

    def save_asset(self, asset: AssetEntity) -> AssetEntity:
        self._assets[asset.id] = asset
        return asset

    def record_reading(self, reading: MeterReading) -> MeterReading:
        if reading.asset_id not in self._meter_readings:
            self._meter_readings[reading.asset_id] = []
        self._meter_readings[reading.asset_id].append(reading)
        
        # Automatically update asset operating hours if reading is hours
        if reading.reading_type == "hours" and reading.asset_id in self._assets:
            self._assets[reading.asset_id].operating_hours = reading.reading_value
        return reading
