"""Pydantic schemas for GameVerse recommendation module."""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class GameCreate(BaseModel):
    """Schema for creating a new game."""
    title: str = Field(..., min_length=1, max_length=200)
    genre: str = Field(..., min_length=1, max_length=100)
    tags: list[str] = Field(default_factory=list)
    developer: str = Field(..., min_length=1, max_length=200)
    publisher: Optional[str] = None
    release_year: Optional[int] = Field(None, ge=1970, le=2030)
    description: Optional[str] = None
    platform: list[str] = Field(default_factory=list)


class Game(GameCreate):
    """Schema for a game with ID."""
    id: int
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        from_attributes = True


class UserCreate(BaseModel):
    """Schema for creating a new user."""
    username: str = Field(..., min_length=1, max_length=100)
    preferences: dict[str, float] = Field(default_factory=dict)


class User(UserCreate):
    """Schema for a user with ID."""
    id: int
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        from_attributes = True


class RatingCreate(BaseModel):
    """Schema for creating a new rating."""
    user_id: int
    game_id: int
    rating: float = Field(..., ge=0.0, le=5.0)


class Rating(BaseModel):
    """Schema for a rating with ID."""
    id: int
    user_id: int
    game_id: int
    rating: float = Field(..., ge=0.0, le=5.0)
    timestamp: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        from_attributes = True


class Recommendation(BaseModel):
    """Schema for a single recommendation."""
    game_id: int
    game_title: str
    score: float = Field(..., ge=0.0, le=1.0)
    reason: str
    algorithm: str


class RecommendationResponse(BaseModel):
    """Schema for recommendation response."""
    user_id: int
    recommendations: list[Recommendation]
    algorithm_type: str
    generated_at: datetime = Field(default_factory=datetime.utcnow)


class SimilarityScore(BaseModel):
    """Schema for item similarity score."""
    game_id: int
    game_title: str
    similarity_score: float = Field(..., ge=0.0, le=1.0)
    similarity_type: str


class SimilarityResponse(BaseModel):
    """Schema for similarity response."""
    source_game_id: int
    source_game_title: str
    similar_games: list[SimilarityScore]
    generated_at: datetime = Field(default_factory=datetime.utcnow)


class PersonalizationContext(BaseModel):
    """Schema for real-time personalization context."""
    user_id: int
    session_id: Optional[str] = None
    device_type: Optional[str] = None
    time_of_day: Optional[str] = None
    recent_interactions: list[int] = Field(default_factory=list)
    current_mood: Optional[str] = None
