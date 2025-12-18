"""API routers for GameVerse recommendation module."""

from app.routers.games import router as games_router
from app.routers.users import router as users_router
from app.routers.ratings import router as ratings_router
from app.routers.recommendations import router as recommendations_router
from app.routers.similarity import router as similarity_router

__all__ = [
    "games_router",
    "users_router",
    "ratings_router",
    "recommendations_router",
    "similarity_router",
]
