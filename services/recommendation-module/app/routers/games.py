"""Games API router for GameVerse recommendation module."""

from fastapi import APIRouter, HTTPException, Query
from typing import Optional

from app.database.memory_db import get_database
from app.models.schemas import Game, GameCreate

router = APIRouter(prefix="/games", tags=["games"])


@router.get("", response_model=list[Game])
async def list_games(
    genre: Optional[str] = Query(None, description="Filter by genre"),
    limit: int = Query(50, ge=1, le=100, description="Maximum number of games to return"),
    offset: int = Query(0, ge=0, description="Number of games to skip"),
) -> list[Game]:
    """
    List all games in the database.
    
    Supports filtering by genre and pagination.
    """
    db = get_database()
    games = db.get_all_games()

    if genre:
        games = [g for g in games if g.genre.lower() == genre.lower()]

    return games[offset : offset + limit]


@router.get("/{game_id}", response_model=Game)
async def get_game(game_id: int) -> Game:
    """Get a specific game by ID."""
    db = get_database()
    game = db.get_game(game_id)

    if not game:
        raise HTTPException(status_code=404, detail=f"Game with ID {game_id} not found")

    return game


@router.post("", response_model=Game, status_code=201)
async def create_game(game_data: GameCreate) -> Game:
    """Create a new game."""
    db = get_database()
    return db.create_game(game_data)


@router.get("/search/by-tags", response_model=list[Game])
async def search_by_tags(
    tags: str = Query(..., description="Comma-separated list of tags"),
    match_all: bool = Query(False, description="Require all tags to match"),
    limit: int = Query(20, ge=1, le=50),
) -> list[Game]:
    """Search games by tags."""
    db = get_database()
    games = db.get_all_games()

    search_tags = {t.strip().lower() for t in tags.split(",")}

    matching_games = []
    for game in games:
        game_tags = {t.lower() for t in game.tags}

        if match_all:
            if search_tags.issubset(game_tags):
                matching_games.append(game)
        else:
            if search_tags & game_tags:
                matching_games.append(game)

    return matching_games[:limit]
