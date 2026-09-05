"""
MachineCare ERP Integration Platform - IBM Maximo OSLC Object Structures & DTOs
Defines Maximo Integration Framework (MIF) OSLC Object Structure schema representations.
"""

from typing import Dict, Any, List, Optional
from dataclasses import dataclass

class MaximoObjectStructures:
    """Standard Maximo OSLC Object Structures."""
    MXASSET = "mxasset"
    MXWO = "mxwo"
    MXMETERDATA = "mxmeterdata"
    MXITEM = "mxitem"
    MXINVENTORY = "mxinventory"
    MXLOCATION = "mxlocation"
    MXSR = "mxsr"
    MXPM = "mxpm"
    MXJOBPLAN = "mxjobplan"

@dataclass
class MaximoAssetDTO:
    assetnum: str
    description: str
    siteid: str
    orgid: Optional[str] = None
    serialnum: Optional[str] = None
    status: str = "OPERATING"  # OPERATING, NOT READY, DECOMMISSIONED
    location: Optional[str] = None
    parent: Optional[str] = None
    vendor: Optional[str] = None
    installdate: Optional[str] = None
    totdowntime: float = 0.0

@dataclass
class MaximoWorkOrderDTO:
    wonum: str
    description: str
    siteid: str
    status: str = "WAPPR"  # WAPPR, APPR, INPRG, COMP, CLOSE, CAN
    worktype: str = "CM"   # PM, CM, EM, EV
    assetnum: Optional[str] = None
    location: Optional[str] = None
    wopriority: Optional[int] = 3
    schedstart: Optional[str] = None
    schedfinish: Optional[str] = None
    actlabcost: float = 0.0
    actmatcost: float = 0.0
    actservcost: float = 0.0
    acttotalcost: float = 0.0
    pmnum: Optional[str] = None
    jpnum: Optional[str] = None

@dataclass
class MaximoMeterReadingDTO:
    assetnum: str
    metername: str
    newreading: float
    newreadingdate: str
    siteid: str
    orgid: Optional[str] = None
    inspector: Optional[str] = "MACHINECARE_IOT"
    remarks: Optional[str] = None
    doroll: bool = True
