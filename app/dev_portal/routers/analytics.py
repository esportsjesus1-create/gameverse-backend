from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List
from datetime import datetime, timedelta
import random

from ..database import get_db
from ..models.developer import Developer, DeveloperAnalytics, APIKey, RateLimitLog
from ..schemas.developer import AnalyticsResponse, AnalyticsSummary
from ..utils.security import get_current_developer

router = APIRouter(prefix="/analytics", tags=["Developer Analytics"])


@router.get("/summary", response_model=AnalyticsSummary)
def get_analytics_summary(
    days: int = Query(default=30, ge=1, le=365),
    current_developer: Developer = Depends(get_current_developer),
    db: Session = Depends(get_db)
):
    end_date = datetime.utcnow()
    start_date = end_date - timedelta(days=days)
    
    analytics = db.query(DeveloperAnalytics).filter(
        DeveloperAnalytics.developer_id == current_developer.id,
        DeveloperAnalytics.date >= start_date,
        DeveloperAnalytics.date <= end_date
    ).order_by(DeveloperAnalytics.date.asc()).all()
    
    if not analytics:
        return AnalyticsSummary(
            period_start=start_date,
            period_end=end_date,
            total_requests=0,
            successful_requests=0,
            failed_requests=0,
            avg_response_time_ms=0.0,
            total_bandwidth_mb=0.0,
            avg_error_rate=0.0,
            daily_breakdown=[]
        )
    
    total_requests = sum(a.total_requests for a in analytics)
    successful_requests = sum(a.successful_requests for a in analytics)
    failed_requests = sum(a.failed_requests for a in analytics)
    total_bandwidth = sum(a.bandwidth_used_mb for a in analytics)
    
    avg_response_time = sum(a.avg_response_time_ms for a in analytics) / len(analytics) if analytics else 0
    avg_error_rate = sum(a.error_rate for a in analytics) / len(analytics) if analytics else 0
    
    return AnalyticsSummary(
        period_start=start_date,
        period_end=end_date,
        total_requests=total_requests,
        successful_requests=successful_requests,
        failed_requests=failed_requests,
        avg_response_time_ms=round(avg_response_time, 2),
        total_bandwidth_mb=round(total_bandwidth, 2),
        avg_error_rate=round(avg_error_rate, 4),
        daily_breakdown=analytics
    )


@router.get("/daily", response_model=List[AnalyticsResponse])
def get_daily_analytics(
    days: int = Query(default=7, ge=1, le=90),
    current_developer: Developer = Depends(get_current_developer),
    db: Session = Depends(get_db)
):
    end_date = datetime.utcnow()
    start_date = end_date - timedelta(days=days)
    
    analytics = db.query(DeveloperAnalytics).filter(
        DeveloperAnalytics.developer_id == current_developer.id,
        DeveloperAnalytics.date >= start_date,
        DeveloperAnalytics.date <= end_date
    ).order_by(DeveloperAnalytics.date.desc()).all()
    
    return analytics


@router.post("/generate-sample-data")
def generate_sample_analytics(
    days: int = Query(default=30, ge=1, le=90),
    current_developer: Developer = Depends(get_current_developer),
    db: Session = Depends(get_db)
):
    db.query(DeveloperAnalytics).filter(
        DeveloperAnalytics.developer_id == current_developer.id
    ).delete()
    
    end_date = datetime.utcnow()
    
    for i in range(days):
        date = end_date - timedelta(days=i)
        
        total_requests = random.randint(100, 10000)
        error_rate = random.uniform(0.001, 0.05)
        failed_requests = int(total_requests * error_rate)
        successful_requests = total_requests - failed_requests
        
        analytics = DeveloperAnalytics(
            developer_id=current_developer.id,
            date=date.replace(hour=0, minute=0, second=0, microsecond=0),
            total_requests=total_requests,
            successful_requests=successful_requests,
            failed_requests=failed_requests,
            avg_response_time_ms=round(random.uniform(50, 500), 2),
            bandwidth_used_mb=round(random.uniform(10, 500), 2),
            unique_endpoints=random.randint(5, 50),
            error_rate=round(error_rate, 4)
        )
        db.add(analytics)
    
    db.commit()
    
    return {
        "message": f"Generated {days} days of sample analytics data",
        "developer_id": current_developer.id
    }


@router.get("/endpoints")
def get_endpoint_analytics(
    days: int = Query(default=7, ge=1, le=30),
    current_developer: Developer = Depends(get_current_developer),
    db: Session = Depends(get_db)
):
    api_keys = db.query(APIKey).filter(
        APIKey.developer_id == current_developer.id
    ).all()
    
    if not api_keys:
        return {"endpoints": []}
    
    api_key_ids = [key.id for key in api_keys]
    start_date = datetime.utcnow() - timedelta(days=days)
    
    endpoint_stats = db.query(
        RateLimitLog.endpoint,
        func.sum(RateLimitLog.requests_count).label('total_requests'),
        func.count(RateLimitLog.id).label('log_count')
    ).filter(
        RateLimitLog.api_key_id.in_(api_key_ids),
        RateLimitLog.created_at >= start_date
    ).group_by(RateLimitLog.endpoint).order_by(
        func.sum(RateLimitLog.requests_count).desc()
    ).limit(20).all()
    
    return {
        "endpoints": [
            {
                "endpoint": stat.endpoint,
                "total_requests": stat.total_requests,
                "log_entries": stat.log_count
            }
            for stat in endpoint_stats
        ]
    }


@router.get("/api-keys")
def get_api_key_analytics(
    current_developer: Developer = Depends(get_current_developer),
    db: Session = Depends(get_db)
):
    api_keys = db.query(APIKey).filter(
        APIKey.developer_id == current_developer.id
    ).all()
    
    analytics = []
    day_ago = datetime.utcnow() - timedelta(days=1)
    
    for key in api_keys:
        day_requests = db.query(func.sum(RateLimitLog.requests_count)).filter(
            RateLimitLog.api_key_id == key.id,
            RateLimitLog.created_at >= day_ago
        ).scalar() or 0
        
        exceeded_count = db.query(RateLimitLog).filter(
            RateLimitLog.api_key_id == key.id,
            RateLimitLog.limit_exceeded == True,
            RateLimitLog.created_at >= day_ago
        ).count()
        
        analytics.append({
            "api_key_id": key.id,
            "api_key_name": key.name,
            "environment": key.environment,
            "is_active": key.is_active,
            "requests_last_24h": day_requests,
            "rate_limit_exceeded_count": exceeded_count,
            "last_used_at": key.last_used_at.isoformat() if key.last_used_at else None
        })
    
    return {"api_keys": analytics}


@router.get("/usage-trends")
def get_usage_trends(
    days: int = Query(default=30, ge=7, le=90),
    current_developer: Developer = Depends(get_current_developer),
    db: Session = Depends(get_db)
):
    end_date = datetime.utcnow()
    start_date = end_date - timedelta(days=days)
    
    analytics = db.query(DeveloperAnalytics).filter(
        DeveloperAnalytics.developer_id == current_developer.id,
        DeveloperAnalytics.date >= start_date,
        DeveloperAnalytics.date <= end_date
    ).order_by(DeveloperAnalytics.date.asc()).all()
    
    if len(analytics) < 2:
        return {
            "trend": "insufficient_data",
            "message": "Not enough data to calculate trends"
        }
    
    mid_point = len(analytics) // 2
    first_half = analytics[:mid_point]
    second_half = analytics[mid_point:]
    
    first_half_avg = sum(a.total_requests for a in first_half) / len(first_half)
    second_half_avg = sum(a.total_requests for a in second_half) / len(second_half)
    
    if first_half_avg > 0:
        growth_rate = ((second_half_avg - first_half_avg) / first_half_avg) * 100
    else:
        growth_rate = 0
    
    if growth_rate > 10:
        trend = "growing"
    elif growth_rate < -10:
        trend = "declining"
    else:
        trend = "stable"
    
    return {
        "trend": trend,
        "growth_rate_percent": round(growth_rate, 2),
        "first_period_avg_requests": round(first_half_avg, 2),
        "second_period_avg_requests": round(second_half_avg, 2),
        "period_days": days
    }
