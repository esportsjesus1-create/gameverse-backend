"""Data models for GameVerse recommendation module."""

from app.models.schemas import (
    Game,
    GameCreate,
    User,
    UserCreate,
    Rating,
    RatingCreate,
    Recommendation,
    RecommendationResponse,
    SimilarityScore,
    SimilarityResponse,
    PersonalizationContext,
)

__all__ = [
    "Game",
    "GameCreate",
    "User",
    "UserCreate",
    "Rating",
    "RatingCreate",
    "Recommendation",
    "RecommendationResponse",
    "SimilarityScore",
    "SimilarityResponse",
    "PersonalizationContext",
]
