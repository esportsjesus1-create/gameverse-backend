from datetime import datetime
from typing import Optional
from fastapi import APIRouter, HTTPException
from app.models import (
    Resource,
    ResourceCreate,
    ResourceUsage,
    ResourceUsageCreate,
    ResourceType,
    CloudProvider,
)
from app.services import ResourceService

router = APIRouter(prefix="/api/v1/resources", tags=["Resources"])
service = ResourceService()


@router.post("", response_model=Resource, status_code=201)
async def create_resource(resource: ResourceCreate):
    return service.create_resource(resource)


@router.get("", response_model=list[Resource])
async def list_resources(
    provider: Optional[CloudProvider] = None,
    resource_type: Optional[ResourceType] = None,
    project_id: Optional[str] = None,
    team_id: Optional[str] = None,
    is_active: Optional[bool] = None,
):
    return service.get_resources(
        provider=provider,
        resource_type=resource_type,
        project_id=project_id,
        team_id=team_id,
        is_active=is_active,
    )


@router.get("/{resource_id}", response_model=Resource)
async def get_resource(resource_id: str):
    resource = service.get_resource(resource_id)
    if not resource:
        raise HTTPException(status_code=404, detail="Resource not found")
    return resource


@router.patch("/{resource_id}", response_model=Resource)
async def update_resource(resource_id: str, updates: dict):
    resource = service.update_resource(resource_id, updates)
    if not resource:
        raise HTTPException(status_code=404, detail="Resource not found")
    return resource


@router.delete("/{resource_id}", status_code=204)
async def delete_resource(resource_id: str):
    if not service.delete_resource(resource_id):
        raise HTTPException(status_code=404, detail="Resource not found")


@router.post("/usage", response_model=ResourceUsage, status_code=201)
async def record_usage(usage: ResourceUsageCreate):
    result = service.record_usage(usage)
    if not result:
        raise HTTPException(status_code=404, detail="Resource not found")
    return result


@router.get("/usage/list", response_model=list[ResourceUsage])
async def list_usage(
    resource_id: Optional[str] = None,
    start_time: Optional[datetime] = None,
    end_time: Optional[datetime] = None,
):
    return service.get_usage(
        resource_id=resource_id,
        start_time=start_time,
        end_time=end_time,
    )


@router.get("/usage/summary")
async def get_usage_summary(
    resource_id: Optional[str] = None,
    start_time: Optional[datetime] = None,
    end_time: Optional[datetime] = None,
):
    return service.get_usage_summary(
        resource_id=resource_id,
        start_time=start_time,
        end_time=end_time,
    )


@router.get("/cost/total")
async def get_total_cost(
    resource_id: Optional[str] = None,
    project_id: Optional[str] = None,
    team_id: Optional[str] = None,
    start_time: Optional[datetime] = None,
    end_time: Optional[datetime] = None,
):
    total = service.get_total_cost(
        resource_id=resource_id,
        project_id=project_id,
        team_id=team_id,
        start_time=start_time,
        end_time=end_time,
    )
    return {"total_cost": total}
