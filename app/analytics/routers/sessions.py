from typing import List, Optional, Dict, Any
from datetime import datetime
from fastapi import APIRouter, HTTPException, Query

from ..models.session import Session, SessionCreate, SessionUpdate
from ..services.session_service import SessionService

router = APIRouter(prefix="/sessions", tags=["Sessions"])


@router.post("/", response_model=Session)
async def start_session(session_data: SessionCreate):
    """Start a new session."""
    return SessionService.start_session(session_data)


@router.post("/{session_id}/end", response_model=Session)
async def end_session(session_id: str):
    """End an active session."""
    session = SessionService.end_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session


@router.get("/", response_model=List[Session])
async def get_sessions(
    player_id: Optional[str] = None,
    start_time: Optional[datetime] = None,
    end_time: Optional[datetime] = None,
    is_active: Optional[bool] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
):
    """Get sessions with optional filters."""
    return SessionService.get_sessions(
        player_id=player_id,
        start_time=start_time,
        end_time=end_time,
        is_active=is_active,
        skip=skip,
        limit=limit,
    )


@router.get("/active", response_model=List[Session])
async def get_active_sessions():
    """Get all currently active sessions."""
    return SessionService.get_active_sessions()


@router.get("/stats", response_model=Dict[str, Any])
async def get_session_stats(
    start_time: Optional[datetime] = None,
    end_time: Optional[datetime] = None,
):
    """Get session statistics."""
    return SessionService.get_session_stats(start_time=start_time, end_time=end_time)


@router.get("/{session_id}", response_model=Session)
async def get_session(session_id: str):
    """Get a specific session."""
    session = SessionService.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session


@router.patch("/{session_id}", response_model=Session)
async def update_session(session_id: str, updates: SessionUpdate):
    """Update a session."""
    session = SessionService.update_session(session_id, updates)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session


@router.post("/{session_id}/screen-view", response_model=Session)
async def add_screen_view(session_id: str, screen_name: str = Query(...)):
    """Record a screen view in a session."""
    session = SessionService.add_screen_view(session_id, screen_name)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session


@router.post("/{session_id}/feature-use", response_model=Session)
async def add_feature_use(session_id: str, feature_name: str = Query(...)):
    """Record a feature use in a session."""
    session = SessionService.add_feature_use(session_id, feature_name)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session
