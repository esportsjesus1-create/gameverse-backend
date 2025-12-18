"""Ratings API router for GameVerse recommendation module."""

from fastapi import APIRouter, HTTPException, Query

from app.database.memory_db import get_database
from app.models.schemas import Rating, RatingCreate

router = APIRouter(prefix="/ratings", tags=["ratings"])


@router.get("", response_model=list[Rating])
async def list_ratings(
    user_id: int | None = Query(None, description="Filter by user ID"),
    game_id: int | None = Query(None, description="Filter by game ID"),
    min_rating: float | None = Query(None, ge=0.0, le=5.0, description="Minimum rating"),
    limit: int = Query(100, ge=1, le=500, description="Maximum number of ratings to return"),
) -> list[Rating]:
    """
    List ratings with optional filters.
    
    Can filter by user_id, game_id, and minimum rating.
    """
    db = get_database()
    ratings = db.get_all_ratings()

    if user_id is not None:
        ratings = [r for r in ratings if r.user_id == user_id]

    if game_id is not None:
        ratings = [r for r in ratings if r.game_id == game_id]

    if min_rating is not None:
        ratings = [r for r in ratings if r.rating >= min_rating]

    return ratings[:limit]


@router.post("", response_model=Rating, status_code=201)
async def create_rating(rating_data: RatingCreate) -> Rating:
    """
    Create a new rating.
    
    Users can rate games on a scale of 0.0 to 5.0.
    """
    db = get_database()

    user = db.get_user(rating_data.user_id)
    if not user:
        raise HTTPException(
            status_code=404, detail=f"User with ID {rating_data.user_id} not found"
        )

    game = db.get_game(rating_data.game_id)
    if not game:
        raise HTTPException(
            status_code=404, detail=f"Game with ID {rating_data.game_id} not found"
        )

    return db.create_rating(rating_data)


@router.get("/stats")
async def get_rating_stats() -> dict:
    """Get overall rating statistics."""
    db = get_database()
    ratings = db.get_all_ratings()

    if not ratings:
        return {
            "total_ratings": 0,
            "average_rating": 0.0,
            "rating_distribution": {},
        }

    total = len(ratings)
    avg = sum(r.rating for r in ratings) / total

    distribution = {f"{i}-{i+1}": 0 for i in range(5)}
    for rating in ratings:
        bucket = min(int(rating.rating), 4)
        distribution[f"{bucket}-{bucket+1}"] += 1

    return {
        "total_ratings": total,
        "average_rating": round(avg, 2),
        "rating_distribution": distribution,
        "unique_users": len(set(r.user_id for r in ratings)),
        "unique_games": len(set(r.game_id for r in ratings)),
    }


@router.get("/game/{game_id}/stats")
async def get_game_rating_stats(game_id: int) -> dict:
    """Get rating statistics for a specific game."""
    db = get_database()

    game = db.get_game(game_id)
    if not game:
        raise HTTPException(status_code=404, detail=f"Game with ID {game_id} not found")

    ratings = db.get_ratings_by_game(game_id)

    if not ratings:
        return {
            "game_id": game_id,
            "game_title": game.title,
            "total_ratings": 0,
            "average_rating": 0.0,
        }

    total = len(ratings)
    avg = sum(r.rating for r in ratings) / total

    return {
        "game_id": game_id,
        "game_title": game.title,
        "total_ratings": total,
        "average_rating": round(avg, 2),
        "highest_rating": max(r.rating for r in ratings),
        "lowest_rating": min(r.rating for r in ratings),
    }
