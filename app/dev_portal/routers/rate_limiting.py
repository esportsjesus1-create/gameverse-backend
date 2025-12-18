from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List
from datetime import datetime, timedelta

from ..database import get_db
from ..models.developer import Developer, APIKey, RateLimitLog
from ..schemas.developer import RateLimitLogResponse, RateLimitDashboard
from ..utils.security import get_current_developer

router = APIRouter(prefix="/rate-limiting", tags=["Rate Limiting"])


@router.get("/dashboard", response_model=List[RateLimitDashboard])
def get_rate_limit_dashboard(
    current_developer: Developer = Depends(get_current_developer),
    db: Session = Depends(get_db)
):
    api_keys = db.query(APIKey).filter(
        APIKey.developer_id == current_developer.id,
        APIKey.is_active == True
    ).all()
    
    dashboard_data = []
    now = datetime.utcnow()
    minute_ago = now - timedelta(minutes=1)
    day_ago = now - timedelta(days=1)
    
    for api_key in api_keys:
        minute_logs = db.query(RateLimitLog).filter(
            RateLimitLog.api_key_id == api_key.id,
            RateLimitLog.window_start >= minute_ago
        ).all()
        
        day_logs = db.query(RateLimitLog).filter(
            RateLimitLog.api_key_id == api_key.id,
            RateLimitLog.window_start >= day_ago
        ).all()
        
        current_minute_usage = sum(log.requests_count for log in minute_logs)
        current_day_usage = sum(log.requests_count for log in day_logs)
        
        exceeded_count = db.query(RateLimitLog).filter(
            RateLimitLog.api_key_id == api_key.id,
            RateLimitLog.limit_exceeded == True,
            RateLimitLog.window_start >= day_ago
        ).count()
        
        top_endpoints_query = db.query(
            RateLimitLog.endpoint,
            func.sum(RateLimitLog.requests_count).label('total')
        ).filter(
            RateLimitLog.api_key_id == api_key.id,
            RateLimitLog.window_start >= day_ago
        ).group_by(RateLimitLog.endpoint).order_by(
            func.sum(RateLimitLog.requests_count).desc()
        ).limit(5).all()
        
        top_endpoints = [
            {"endpoint": ep, "requests": total}
            for ep, total in top_endpoints_query
        ]
        
        minute_percent = (current_minute_usage / api_key.requests_per_minute * 100) if api_key.requests_per_minute > 0 else 0
        day_percent = (current_day_usage / api_key.requests_per_day * 100) if api_key.requests_per_day > 0 else 0
        
        dashboard_data.append(RateLimitDashboard(
            api_key_id=api_key.id,
            api_key_name=api_key.name,
            current_minute_usage=current_minute_usage,
            current_day_usage=current_day_usage,
            minute_limit=api_key.requests_per_minute,
            day_limit=api_key.requests_per_day,
            minute_usage_percent=round(minute_percent, 2),
            day_usage_percent=round(day_percent, 2),
            recent_limit_exceeded_count=exceeded_count,
            top_endpoints=top_endpoints
        ))
    
    return dashboard_data


@router.get("/logs/{api_key_id}", response_model=List[RateLimitLogResponse])
def get_rate_limit_logs(
    api_key_id: int,
    limit: int = 100,
    current_developer: Developer = Depends(get_current_developer),
    db: Session = Depends(get_db)
):
    api_key = db.query(APIKey).filter(
        APIKey.id == api_key_id,
        APIKey.developer_id == current_developer.id
    ).first()
    
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="API key not found"
        )
    
    logs = db.query(RateLimitLog).filter(
        RateLimitLog.api_key_id == api_key_id
    ).order_by(RateLimitLog.created_at.desc()).limit(limit).all()
    
    return logs


@router.post("/simulate")
def simulate_rate_limit_usage(
    api_key_id: int,
    endpoint: str,
    requests_count: int = 1,
    current_developer: Developer = Depends(get_current_developer),
    db: Session = Depends(get_db)
):
    api_key = db.query(APIKey).filter(
        APIKey.id == api_key_id,
        APIKey.developer_id == current_developer.id
    ).first()
    
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="API key not found"
        )
    
    now = datetime.utcnow()
    window_start = now.replace(second=0, microsecond=0)
    window_end = window_start + timedelta(minutes=1)
    
    existing_log = db.query(RateLimitLog).filter(
        RateLimitLog.api_key_id == api_key_id,
        RateLimitLog.endpoint == endpoint,
        RateLimitLog.window_start == window_start
    ).first()
    
    if existing_log:
        existing_log.requests_count += requests_count
        if existing_log.requests_count > api_key.requests_per_minute:
            existing_log.limit_exceeded = True
    else:
        limit_exceeded = requests_count > api_key.requests_per_minute
        new_log = RateLimitLog(
            api_key_id=api_key_id,
            endpoint=endpoint,
            requests_count=requests_count,
            window_start=window_start,
            window_end=window_end,
            limit_exceeded=limit_exceeded
        )
        db.add(new_log)
    
    api_key.last_used_at = now
    db.commit()
    
    return {
        "message": "Rate limit usage simulated",
        "api_key_id": api_key_id,
        "endpoint": endpoint,
        "requests_added": requests_count
    }


@router.get("/exceeded/{api_key_id}", response_model=List[RateLimitLogResponse])
def get_exceeded_limits(
    api_key_id: int,
    days: int = 7,
    current_developer: Developer = Depends(get_current_developer),
    db: Session = Depends(get_db)
):
    api_key = db.query(APIKey).filter(
        APIKey.id == api_key_id,
        APIKey.developer_id == current_developer.id
    ).first()
    
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="API key not found"
        )
    
    since = datetime.utcnow() - timedelta(days=days)
    
    logs = db.query(RateLimitLog).filter(
        RateLimitLog.api_key_id == api_key_id,
        RateLimitLog.limit_exceeded == True,
        RateLimitLog.created_at >= since
    ).order_by(RateLimitLog.created_at.desc()).all()
    
    return logs
