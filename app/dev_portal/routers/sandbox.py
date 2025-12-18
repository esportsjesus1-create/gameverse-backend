from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime, timedelta
import json
import uuid

from ..database import get_db
from ..models.developer import Developer, SandboxEnvironment, SandboxRequestLog
from ..schemas.developer import (
    SandboxCreate, SandboxResponse, SandboxUpdate, SandboxRequestLogResponse
)
from ..utils.security import get_current_developer

router = APIRouter(prefix="/sandbox", tags=["Sandbox Environment"])


@router.post("/", response_model=SandboxResponse, status_code=status.HTTP_201_CREATED)
def create_sandbox(
    sandbox_data: SandboxCreate,
    current_developer: Developer = Depends(get_current_developer),
    db: Session = Depends(get_db)
):
    existing_sandboxes_count = db.query(SandboxEnvironment).filter(
        SandboxEnvironment.developer_id == current_developer.id,
        SandboxEnvironment.is_active == True
    ).count()
    
    max_sandboxes = {
        "free": 1,
        "basic": 3,
        "pro": 10,
        "enterprise": 50
    }
    
    tier_limit = max_sandboxes.get(current_developer.tier.value, 1)
    if existing_sandboxes_count >= tier_limit:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Maximum sandbox environments limit ({tier_limit}) reached for your tier"
        )
    
    sandbox_id = str(uuid.uuid4())[:8]
    base_url = f"https://sandbox-{sandbox_id}.gameverse.dev/api/v1"
    
    expires_at = None
    if sandbox_data.expires_in_days:
        expires_at = datetime.utcnow() + timedelta(days=sandbox_data.expires_in_days)
    
    db_sandbox = SandboxEnvironment(
        developer_id=current_developer.id,
        name=sandbox_data.name,
        description=sandbox_data.description,
        base_url=base_url,
        mock_data_enabled=sandbox_data.mock_data_enabled,
        rate_limit_disabled=sandbox_data.rate_limit_disabled,
        log_all_requests=sandbox_data.log_all_requests,
        expires_at=expires_at
    )
    db.add(db_sandbox)
    db.commit()
    db.refresh(db_sandbox)
    
    return db_sandbox


@router.get("/", response_model=List[SandboxResponse])
def list_sandboxes(
    current_developer: Developer = Depends(get_current_developer),
    db: Session = Depends(get_db)
):
    sandboxes = db.query(SandboxEnvironment).filter(
        SandboxEnvironment.developer_id == current_developer.id
    ).order_by(SandboxEnvironment.created_at.desc()).all()
    
    return sandboxes


@router.get("/{sandbox_id}", response_model=SandboxResponse)
def get_sandbox(
    sandbox_id: int,
    current_developer: Developer = Depends(get_current_developer),
    db: Session = Depends(get_db)
):
    sandbox = db.query(SandboxEnvironment).filter(
        SandboxEnvironment.id == sandbox_id,
        SandboxEnvironment.developer_id == current_developer.id
    ).first()
    
    if not sandbox:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Sandbox environment not found"
        )
    
    return sandbox


@router.put("/{sandbox_id}", response_model=SandboxResponse)
def update_sandbox(
    sandbox_id: int,
    sandbox_update: SandboxUpdate,
    current_developer: Developer = Depends(get_current_developer),
    db: Session = Depends(get_db)
):
    sandbox = db.query(SandboxEnvironment).filter(
        SandboxEnvironment.id == sandbox_id,
        SandboxEnvironment.developer_id == current_developer.id
    ).first()
    
    if not sandbox:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Sandbox environment not found"
        )
    
    update_data = sandbox_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(sandbox, field, value)
    
    db.commit()
    db.refresh(sandbox)
    return sandbox


@router.delete("/{sandbox_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_sandbox(
    sandbox_id: int,
    current_developer: Developer = Depends(get_current_developer),
    db: Session = Depends(get_db)
):
    sandbox = db.query(SandboxEnvironment).filter(
        SandboxEnvironment.id == sandbox_id,
        SandboxEnvironment.developer_id == current_developer.id
    ).first()
    
    if not sandbox:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Sandbox environment not found"
        )
    
    db.delete(sandbox)
    db.commit()
    return None


@router.post("/{sandbox_id}/reset", response_model=SandboxResponse)
def reset_sandbox(
    sandbox_id: int,
    current_developer: Developer = Depends(get_current_developer),
    db: Session = Depends(get_db)
):
    sandbox = db.query(SandboxEnvironment).filter(
        SandboxEnvironment.id == sandbox_id,
        SandboxEnvironment.developer_id == current_developer.id
    ).first()
    
    if not sandbox:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Sandbox environment not found"
        )
    
    db.query(SandboxRequestLog).filter(
        SandboxRequestLog.sandbox_id == sandbox_id
    ).delete()
    
    sandbox_uuid = str(uuid.uuid4())[:8]
    sandbox.base_url = f"https://sandbox-{sandbox_uuid}.gameverse.dev/api/v1"
    sandbox.updated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(sandbox)
    return sandbox


@router.get("/{sandbox_id}/logs", response_model=List[SandboxRequestLogResponse])
def get_sandbox_logs(
    sandbox_id: int,
    limit: int = 100,
    method: str = None,
    current_developer: Developer = Depends(get_current_developer),
    db: Session = Depends(get_db)
):
    sandbox = db.query(SandboxEnvironment).filter(
        SandboxEnvironment.id == sandbox_id,
        SandboxEnvironment.developer_id == current_developer.id
    ).first()
    
    if not sandbox:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Sandbox environment not found"
        )
    
    query = db.query(SandboxRequestLog).filter(
        SandboxRequestLog.sandbox_id == sandbox_id
    )
    
    if method:
        query = query.filter(SandboxRequestLog.method == method.upper())
    
    logs = query.order_by(SandboxRequestLog.created_at.desc()).limit(limit).all()
    return logs


@router.post("/{sandbox_id}/simulate")
def simulate_sandbox_request(
    sandbox_id: int,
    method: str,
    endpoint: str,
    request_body: dict = None,
    current_developer: Developer = Depends(get_current_developer),
    db: Session = Depends(get_db)
):
    sandbox = db.query(SandboxEnvironment).filter(
        SandboxEnvironment.id == sandbox_id,
        SandboxEnvironment.developer_id == current_developer.id
    ).first()
    
    if not sandbox:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Sandbox environment not found"
        )
    
    if not sandbox.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Sandbox environment is not active"
        )
    
    mock_responses = {
        "GET": {"status": 200, "body": {"data": [], "message": "Mock data retrieved"}},
        "POST": {"status": 201, "body": {"id": 1, "message": "Mock resource created"}},
        "PUT": {"status": 200, "body": {"message": "Mock resource updated"}},
        "DELETE": {"status": 204, "body": None},
        "PATCH": {"status": 200, "body": {"message": "Mock resource patched"}}
    }
    
    response = mock_responses.get(method.upper(), {"status": 200, "body": {}})
    
    if sandbox.log_all_requests:
        log = SandboxRequestLog(
            sandbox_id=sandbox_id,
            method=method.upper(),
            endpoint=endpoint,
            request_headers=json.dumps({"Content-Type": "application/json"}),
            request_body=json.dumps(request_body) if request_body else None,
            response_status=response["status"],
            response_body=json.dumps(response["body"]) if response["body"] else None,
            response_time_ms=50
        )
        db.add(log)
        db.commit()
    
    return {
        "sandbox_url": f"{sandbox.base_url}{endpoint}",
        "method": method.upper(),
        "response_status": response["status"],
        "response_body": response["body"],
        "mock_data_enabled": sandbox.mock_data_enabled
    }


@router.delete("/{sandbox_id}/logs", status_code=status.HTTP_204_NO_CONTENT)
def clear_sandbox_logs(
    sandbox_id: int,
    current_developer: Developer = Depends(get_current_developer),
    db: Session = Depends(get_db)
):
    sandbox = db.query(SandboxEnvironment).filter(
        SandboxEnvironment.id == sandbox_id,
        SandboxEnvironment.developer_id == current_developer.id
    ).first()
    
    if not sandbox:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Sandbox environment not found"
        )
    
    db.query(SandboxRequestLog).filter(
        SandboxRequestLog.sandbox_id == sandbox_id
    ).delete()
    db.commit()
    return None
