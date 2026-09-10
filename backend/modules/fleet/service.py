"""
MachineCare Fleet Module - Models & Domain Entities
"""

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Optional, Dict

@dataclass
class VehicleEntity:
    id: str
    organization_id: str
    plate_number: str
    make: str
    model: str
    current_odometer: float = 0.0
    status: str = "available"  # available, on_trip, maintenance

@dataclass
class TripEntity:
    id: str
    organization_id: str
    vehicle_id: str
    driver_name: str
    start_odometer: float
    end_odometer: Optional[float] = None
    status: str = "active"  # active, completed

class FleetService:
    def __init__(self):
        self._vehicles: Dict[str, VehicleEntity] = {}
        self._trips: Dict[str, TripEntity] = {}

    def save_vehicle(self, vehicle: VehicleEntity) -> VehicleEntity:
        self._vehicles[vehicle.id] = vehicle
        return vehicle

    def start_trip(self, trip: TripEntity) -> TripEntity:
        self._trips[trip.id] = trip
        if trip.vehicle_id in self._vehicles:
            self._vehicles[trip.vehicle_id].status = "on_trip"
        return trip

    def complete_trip(self, trip_id: str, end_odometer: float) -> TripEntity:
        if trip_id not in self._trips:
            raise ValueError("Trip not found")
        trip = self._trips[trip_id]
        trip.end_odometer = end_odometer
        trip.status = "completed"
        if trip.vehicle_id in self._vehicles:
            v = self._vehicles[trip.vehicle_id]
            v.current_odometer = end_odometer
            v.status = "available"
        return trip
