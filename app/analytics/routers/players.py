from typing import List, Optional, Dict, Any
from datetime import datetime
from fastapi import APIRouter, HTTPException, Query

from ..models.player import Player, PlayerCreate, PlayerUpdate
from ..services.player_service import PlayerService

router = APIRouter(prefix="/players", tags=["Players"])


@router.post("/", response_model=Player)
async def create_player(player_data: PlayerCreate):
    """Create a new player."""
    return PlayerService.create_player(player_data)


@router.get("/", response_model=List[Player])
async def get_players(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
):
    """Get all players with pagination."""
    return PlayerService.get_all_players(skip=skip, limit=limit)


@router.get("/segments", response_model=Dict[str, List[str]])
async def get_player_segments():
    """Get players segmented by behavior."""
    return PlayerService.segment_players()


@router.get("/cohort", response_model=List[Player])
async def get_cohort_players(
    start_date: datetime = Query(...),
    end_date: datetime = Query(...),
):
    """Get players from a specific cohort (signup date range)."""
    return PlayerService.get_players_by_cohort(start_date, end_date)


@router.get("/action-frequency", response_model=Dict[str, int])
async def get_action_frequency(
    player_id: Optional[str] = None,
    start_time: Optional[datetime] = None,
    end_time: Optional[datetime] = None,
):
    """Get action frequency analysis."""
    return PlayerService.get_action_frequency(
        player_id=player_id, start_time=start_time, end_time=end_time
    )


@router.get("/{player_id}", response_model=Player)
async def get_player(player_id: str):
    """Get a specific player by ID."""
    player = PlayerService.get_player(player_id)
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")
    return player


@router.patch("/{player_id}", response_model=Player)
async def update_player(player_id: str, updates: PlayerUpdate):
    """Update a player."""
    player = PlayerService.update_player(player_id, updates)
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")
    return player


@router.delete("/{player_id}")
async def delete_player(player_id: str):
    """Delete a player."""
    if not PlayerService.delete_player(player_id):
        raise HTTPException(status_code=404, detail="Player not found")
    return {"message": "Player deleted successfully"}


@router.get("/{player_id}/behavior", response_model=Dict[str, Any])
async def get_player_behavior(player_id: str):
    """Get player behavior summary."""
    behavior = PlayerService.get_player_behavior_summary(player_id)
    if not behavior:
        raise HTTPException(status_code=404, detail="Player not found")
    return behavior


@router.get("/{player_id}/journey", response_model=List[Dict[str, Any]])
async def get_player_journey(player_id: str):
    """Get player journey (event timeline)."""
    return PlayerService.get_player_journey(player_id)
