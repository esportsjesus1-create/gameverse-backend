from datetime import datetime
from typing import Optional
from fastapi import APIRouter, HTTPException
from app.models import (
    CostCenter,
    CostCenterCreate,
    CostAllocation,
    CostAllocationCreate,
    CostReport,
)
from app.services import CostService

router = APIRouter(prefix="/api/v1/costs", tags=["Costs"])
service = CostService()


@router.post("/centers", response_model=CostCenter, status_code=201)
async def create_cost_center(cost_center: CostCenterCreate):
    return service.create_cost_center(cost_center)


@router.get("/centers", response_model=list[CostCenter])
async def list_cost_centers(
    parent_id: Optional[str] = None,
    is_active: Optional[bool] = None,
):
    return service.get_cost_centers(
        parent_id=parent_id,
        is_active=is_active,
    )


@router.get("/centers/{cost_center_id}", response_model=CostCenter)
async def get_cost_center(cost_center_id: str):
    cost_center = service.get_cost_center(cost_center_id)
    if not cost_center:
        raise HTTPException(status_code=404, detail="Cost center not found")
    return cost_center


@router.patch("/centers/{cost_center_id}", response_model=CostCenter)
async def update_cost_center(cost_center_id: str, updates: dict):
    cost_center = service.update_cost_center(cost_center_id, updates)
    if not cost_center:
        raise HTTPException(status_code=404, detail="Cost center not found")
    return cost_center


@router.delete("/centers/{cost_center_id}", status_code=204)
async def delete_cost_center(cost_center_id: str):
    if not service.delete_cost_center(cost_center_id):
        raise HTTPException(status_code=404, detail="Cost center not found")


@router.post("/allocations", response_model=CostAllocation, status_code=201)
async def create_allocation(allocation: CostAllocationCreate):
    return service.create_allocation(allocation)


@router.get("/allocations", response_model=list[CostAllocation])
async def list_allocations(
    resource_id: Optional[str] = None,
    cost_center_id: Optional[str] = None,
    project_id: Optional[str] = None,
    team_id: Optional[str] = None,
):
    return service.get_allocations(
        resource_id=resource_id,
        cost_center_id=cost_center_id,
        project_id=project_id,
        team_id=team_id,
    )


@router.get("/allocations/{allocation_id}", response_model=CostAllocation)
async def get_allocation(allocation_id: str):
    allocation = service.get_allocation(allocation_id)
    if not allocation:
        raise HTTPException(status_code=404, detail="Allocation not found")
    return allocation


@router.delete("/allocations/{allocation_id}", status_code=204)
async def delete_allocation(allocation_id: str):
    if not service.delete_allocation(allocation_id):
        raise HTTPException(status_code=404, detail="Allocation not found")


@router.get("/report", response_model=CostReport)
async def generate_cost_report(
    start_date: datetime,
    end_date: datetime,
    project_id: Optional[str] = None,
    team_id: Optional[str] = None,
):
    return service.generate_cost_report(
        start_date=start_date,
        end_date=end_date,
        project_id=project_id,
        team_id=team_id,
    )


@router.post("/by-tags")
async def get_cost_by_tags(
    tags: dict[str, str],
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
):
    return service.get_cost_by_tags(
        tags=tags,
        start_date=start_date,
        end_date=end_date,
    )
