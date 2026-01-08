"""Users API router for GameVerse recommendation module."""

from fastapi import APIRouter, HTTPException, Query

from app.database.memory_db import get_database
from app.models.schemas import User, UserCreate

router = APIRouter(prefix="/users", tags=["users"])


@router.get("", response_model=list[User])
async def list_users(
    limit: int = Query(50, ge=1, le=100, description="Maximum number of users to return"),
    offset: int = Query(0, ge=0, description="Number of users to skip"),
) -> list[User]:
    """List all users in the database."""
    db = get_database()
    users = db.get_all_users()
    return users[offset : offset + limit]


@router.get("/{user_id}", response_model=User)
async def get_user(user_id: int) -> User:
    """Get a specific user by ID."""
    db = get_database()
    user = db.get_user(user_id)

    if not user:
        raise HTTPException(status_code=404, detail=f"User with ID {user_id} not found")

    return user


@router.post("", response_model=User, status_code=201)
async def create_user(user_data: UserCreate) -> User:
    """Create a new user."""
    db = get_database()
    return db.create_user(user_data)


@router.get("/{user_id}/ratings")
async def get_user_ratings(user_id: int) -> dict:
    """Get all ratings by a specific user."""
    db = get_database()
    user = db.get_user(user_id)

    if not user:
        raise HTTPException(status_code=404, detail=f"User with ID {user_id} not found")

    ratings = db.get_ratings_by_user(user_id)

    enriched_ratings = []
    for rating in ratings:
        game = db.get_game(rating.game_id)
        enriched_ratings.append({
            "rating_id": rating.id,
            "game_id": rating.game_id,
            "game_title": game.title if game else "Unknown",
            "rating": rating.rating,
            "timestamp": rating.timestamp,
        })

    return {
        "user_id": user_id,
        "username": user.username,
        "total_ratings": len(ratings),
        "ratings": enriched_ratings,
    }
