from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime

from ..database import get_db
from ..models.developer import Developer, APIKey
from ..schemas.developer import (
    APIKeyCreate, APIKeyResponse, APIKeyUpdate, APIKeyCreatedResponse
)
from ..utils.security import get_current_developer, generate_api_key

router = APIRouter(prefix="/api-keys", tags=["API Keys"])


@router.post("/", response_model=APIKeyCreatedResponse, status_code=status.HTTP_201_CREATED)
def create_api_key(
    api_key_data: APIKeyCreate,
    current_developer: Developer = Depends(get_current_developer),
    db: Session = Depends(get_db)
):
    existing_keys_count = db.query(APIKey).filter(
        APIKey.developer_id == current_developer.id,
        APIKey.is_active == True
    ).count()
    
    max_keys = {
        "free": 2,
        "basic": 5,
        "pro": 20,
        "enterprise": 100
    }
    
    tier_limit = max_keys.get(current_developer.tier.value, 2)
    if existing_keys_count >= tier_limit:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Maximum API keys limit ({tier_limit}) reached for your tier"
        )
    
    key, prefix, key_hash = generate_api_key()
    
    rate_limits = {
        "free": (60, 1000),
        "basic": (120, 10000),
        "pro": (300, 100000),
        "enterprise": (1000, 1000000)
    }
    rpm, rpd = rate_limits.get(current_developer.tier.value, (60, 1000))
    
    db_api_key = APIKey(
        developer_id=current_developer.id,
        key_hash=key_hash,
        key_prefix=prefix,
        name=api_key_data.name,
        description=api_key_data.description,
        environment=api_key_data.environment,
        rate_limit_tier=current_developer.tier.value,
        requests_per_minute=rpm,
        requests_per_day=rpd,
        expires_at=api_key_data.expires_at
    )
    db.add(db_api_key)
    db.commit()
    db.refresh(db_api_key)
    
    response = APIKeyCreatedResponse(
        id=db_api_key.id,
        name=db_api_key.name,
        description=db_api_key.description,
        environment=db_api_key.environment,
        key_prefix=db_api_key.key_prefix,
        is_active=db_api_key.is_active,
        rate_limit_tier=db_api_key.rate_limit_tier,
        requests_per_minute=db_api_key.requests_per_minute,
        requests_per_day=db_api_key.requests_per_day,
        last_used_at=db_api_key.last_used_at,
        expires_at=db_api_key.expires_at,
        created_at=db_api_key.created_at,
        api_key=f"gv_{key}"
    )
    return response


@router.get("/", response_model=List[APIKeyResponse])
def list_api_keys(
    current_developer: Developer = Depends(get_current_developer),
    db: Session = Depends(get_db)
):
    api_keys = db.query(APIKey).filter(
        APIKey.developer_id == current_developer.id
    ).order_by(APIKey.created_at.desc()).all()
    return api_keys


@router.get("/{key_id}", response_model=APIKeyResponse)
def get_api_key(
    key_id: int,
    current_developer: Developer = Depends(get_current_developer),
    db: Session = Depends(get_db)
):
    api_key = db.query(APIKey).filter(
        APIKey.id == key_id,
        APIKey.developer_id == current_developer.id
    ).first()
    
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="API key not found"
        )
    return api_key


@router.put("/{key_id}", response_model=APIKeyResponse)
def update_api_key(
    key_id: int,
    api_key_update: APIKeyUpdate,
    current_developer: Developer = Depends(get_current_developer),
    db: Session = Depends(get_db)
):
    api_key = db.query(APIKey).filter(
        APIKey.id == key_id,
        APIKey.developer_id == current_developer.id
    ).first()
    
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="API key not found"
        )
    
    update_data = api_key_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(api_key, field, value)
    
    db.commit()
    db.refresh(api_key)
    return api_key


@router.delete("/{key_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_api_key(
    key_id: int,
    current_developer: Developer = Depends(get_current_developer),
    db: Session = Depends(get_db)
):
    api_key = db.query(APIKey).filter(
        APIKey.id == key_id,
        APIKey.developer_id == current_developer.id
    ).first()
    
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="API key not found"
        )
    
    db.delete(api_key)
    db.commit()
    return None


@router.post("/{key_id}/regenerate", response_model=APIKeyCreatedResponse)
def regenerate_api_key(
    key_id: int,
    current_developer: Developer = Depends(get_current_developer),
    db: Session = Depends(get_db)
):
    api_key = db.query(APIKey).filter(
        APIKey.id == key_id,
        APIKey.developer_id == current_developer.id
    ).first()
    
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="API key not found"
        )
    
    key, prefix, key_hash = generate_api_key()
    api_key.key_hash = key_hash
    api_key.key_prefix = prefix
    api_key.last_used_at = None
    
    db.commit()
    db.refresh(api_key)
    
    response = APIKeyCreatedResponse(
        id=api_key.id,
        name=api_key.name,
        description=api_key.description,
        environment=api_key.environment,
        key_prefix=api_key.key_prefix,
        is_active=api_key.is_active,
        rate_limit_tier=api_key.rate_limit_tier,
        requests_per_minute=api_key.requests_per_minute,
        requests_per_day=api_key.requests_per_day,
        last_used_at=api_key.last_used_at,
        expires_at=api_key.expires_at,
        created_at=api_key.created_at,
        api_key=f"gv_{key}"
    )
    return response
