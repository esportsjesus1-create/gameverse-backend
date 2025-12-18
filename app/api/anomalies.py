from typing import Optional
from fastapi import APIRouter, HTTPException
from app.models import (
    Anomaly,
    AnomalyConfig,
    AnomalyConfigCreate,
    AnomalyType,
    AnomalySeverity,
)
from app.services import AnomalyService

router = APIRouter(prefix="/api/v1/anomalies", tags=["Anomalies"])
service = AnomalyService()


@router.post("/configs", response_model=AnomalyConfig, status_code=201)
async def create_config(config: AnomalyConfigCreate):
    return service.create_config(config)


@router.get("/configs", response_model=list[AnomalyConfig])
async def list_configs(
    resource_id: Optional[str] = None,
    project_id: Optional[str] = None,
    is_active: Optional[bool] = None,
):
    return service.get_configs(
        resource_id=resource_id,
        project_id=project_id,
        is_active=is_active,
    )


@router.get("/configs/{config_id}", response_model=AnomalyConfig)
async def get_config(config_id: str):
    config = service.get_config(config_id)
    if not config:
        raise HTTPException(status_code=404, detail="Config not found")
    return config


@router.patch("/configs/{config_id}", response_model=AnomalyConfig)
async def update_config(config_id: str, updates: dict):
    config = service.update_config(config_id, updates)
    if not config:
        raise HTTPException(status_code=404, detail="Config not found")
    return config


@router.delete("/configs/{config_id}", status_code=204)
async def delete_config(config_id: str):
    if not service.delete_config(config_id):
        raise HTTPException(status_code=404, detail="Config not found")


@router.post("/detect", response_model=list[Anomaly])
async def detect_anomalies(
    config_id: Optional[str] = None,
    resource_id: Optional[str] = None,
    project_id: Optional[str] = None,
):
    return service.detect_anomalies(
        config_id=config_id,
        resource_id=resource_id,
        project_id=project_id,
    )


@router.get("", response_model=list[Anomaly])
async def list_anomalies(
    resource_id: Optional[str] = None,
    project_id: Optional[str] = None,
    anomaly_type: Optional[AnomalyType] = None,
    severity: Optional[AnomalySeverity] = None,
    is_resolved: Optional[bool] = None,
):
    return service.get_anomalies(
        resource_id=resource_id,
        project_id=project_id,
        anomaly_type=anomaly_type,
        severity=severity,
        is_resolved=is_resolved,
    )


@router.post("/{anomaly_id}/resolve", response_model=Anomaly)
async def resolve_anomaly(
    anomaly_id: str,
    resolution_notes: Optional[str] = None,
):
    anomaly = service.resolve_anomaly(anomaly_id, resolution_notes)
    if not anomaly:
        raise HTTPException(status_code=404, detail="Anomaly not found")
    return anomaly


@router.get("/summary")
async def get_anomaly_summary(
    resource_id: Optional[str] = None,
    project_id: Optional[str] = None,
):
    return service.get_anomaly_summary(
        resource_id=resource_id,
        project_id=project_id,
    )
