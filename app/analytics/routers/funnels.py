from typing import List, Optional, Dict, Any
from datetime import datetime
from fastapi import APIRouter, HTTPException, Query

from ..models.funnel import Funnel, FunnelCreate, FunnelAnalysis
from ..services.funnel_service import FunnelService

router = APIRouter(prefix="/funnels", tags=["Funnel Analysis"])


@router.post("/", response_model=Funnel)
async def create_funnel(funnel_data: FunnelCreate):
    """Create a new funnel."""
    return FunnelService.create_funnel(funnel_data)


@router.get("/", response_model=List[Funnel])
async def get_funnels():
    """Get all funnels."""
    return FunnelService.get_all_funnels()


@router.get("/compare", response_model=List[Dict[str, Any]])
async def compare_funnels(
    funnel_ids: str = Query(..., description="Comma-separated funnel IDs"),
    start_time: Optional[datetime] = None,
    end_time: Optional[datetime] = None,
):
    """Compare multiple funnels."""
    ids = [fid.strip() for fid in funnel_ids.split(",")]
    return FunnelService.compare_funnels(ids, start_time, end_time)


@router.get("/{funnel_id}", response_model=Funnel)
async def get_funnel(funnel_id: str):
    """Get a specific funnel."""
    funnel = FunnelService.get_funnel(funnel_id)
    if not funnel:
        raise HTTPException(status_code=404, detail="Funnel not found")
    return funnel


@router.delete("/{funnel_id}")
async def delete_funnel(funnel_id: str):
    """Delete a funnel."""
    if not FunnelService.delete_funnel(funnel_id):
        raise HTTPException(status_code=404, detail="Funnel not found")
    return {"message": "Funnel deleted successfully"}


@router.get("/{funnel_id}/analyze", response_model=FunnelAnalysis)
async def analyze_funnel(
    funnel_id: str,
    start_time: Optional[datetime] = None,
    end_time: Optional[datetime] = None,
):
    """Analyze a funnel."""
    analysis = FunnelService.analyze_funnel(funnel_id, start_time, end_time)
    if not analysis:
        raise HTTPException(status_code=404, detail="Funnel not found or has no steps")
    return analysis


@router.get("/{funnel_id}/drop-off", response_model=Dict[str, Any])
async def get_funnel_drop_off(
    funnel_id: str,
    start_time: Optional[datetime] = None,
    end_time: Optional[datetime] = None,
):
    """Get detailed drop-off analysis for a funnel."""
    analysis = FunnelService.get_funnel_drop_off_analysis(funnel_id, start_time, end_time)
    if not analysis:
        raise HTTPException(status_code=404, detail="Funnel not found")
    return analysis
