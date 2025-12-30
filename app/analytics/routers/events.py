from typing import List, Optional, Dict, Any
from datetime import datetime
from fastapi import APIRouter, Query

from ..models.event import Event, EventCreate
from ..services.event_service import EventService

router = APIRouter(prefix="/events", tags=["Events"])


@router.post("/", response_model=Event)
async def track_event(event_data: EventCreate):
    """Track a single event."""
    return EventService.track_event(event_data)


@router.post("/batch", response_model=List[Event])
async def batch_track_events(events_data: List[EventCreate]):
    """Track multiple events in batch."""
    return EventService.batch_track_events(events_data)


@router.get("/", response_model=List[Event])
async def get_events(
    player_id: Optional[str] = None,
    event_type: Optional[str] = None,
    event_name: Optional[str] = None,
    session_id: Optional[str] = None,
    start_time: Optional[datetime] = None,
    end_time: Optional[datetime] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
):
    """Get events with optional filters."""
    return EventService.get_events(
        player_id=player_id,
        event_type=event_type,
        event_name=event_name,
        session_id=session_id,
        start_time=start_time,
        end_time=end_time,
        skip=skip,
        limit=limit,
    )


@router.get("/counts", response_model=Dict[str, int])
async def get_event_counts(
    start_time: Optional[datetime] = None,
    end_time: Optional[datetime] = None,
):
    """Get event counts by type."""
    return EventService.get_event_counts_by_type(
        start_time=start_time, end_time=end_time
    )


@router.get("/timeline", response_model=List[Dict[str, Any]])
async def get_event_timeline(
    player_id: Optional[str] = None,
    start_time: Optional[datetime] = None,
    end_time: Optional[datetime] = None,
    granularity: str = Query("hour", regex="^(hour|day|week|month)$"),
):
    """Get event timeline with specified granularity."""
    return EventService.get_event_timeline(
        player_id=player_id,
        start_time=start_time,
        end_time=end_time,
        granularity=granularity,
    )


@router.get("/popular", response_model=List[Dict[str, Any]])
async def get_popular_events(
    start_time: Optional[datetime] = None,
    end_time: Optional[datetime] = None,
    limit: int = Query(10, ge=1, le=100),
):
    """Get most popular events."""
    return EventService.get_popular_events(
        start_time=start_time, end_time=end_time, limit=limit
    )
