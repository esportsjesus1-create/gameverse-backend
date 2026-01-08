"""Recommendations API router for GameVerse recommendation module."""

from fastapi import APIRouter, HTTPException, Query
from typing import Optional

from app.database.memory_db import get_database
from app.models.schemas import RecommendationResponse, PersonalizationContext
from app.services.collaborative_filtering import CollaborativeFilteringEngine
from app.services.content_based import ContentBasedEngine
from app.services.hybrid import HybridRecommendationEngine
from app.services.personalization import PersonalizationEngine

router = APIRouter(prefix="/recommendations", tags=["recommendations"])


@router.get("/collaborative/{user_id}", response_model=RecommendationResponse)
async def get_collaborative_recommendations(
    user_id: int,
    method: str = Query(
        "combined",
        description="CF method: user_based, item_based, svd, or combined",
    ),
    top_n: int = Query(10, ge=1, le=50, description="Number of recommendations"),
) -> RecommendationResponse:
    """
    Get collaborative filtering recommendations for a user.
    
    Methods:
    - user_based: Recommendations based on similar users
    - item_based: Recommendations based on similar items
    - svd: Matrix factorization based recommendations
    - combined: Weighted combination of all methods
    """
    db = get_database()

    user = db.get_user(user_id)
    if not user:
        raise HTTPException(status_code=404, detail=f"User with ID {user_id} not found")

    engine = CollaborativeFilteringEngine(db)
    return engine.get_recommendations(user_id, method=method, top_n=top_n)


@router.get("/content-based/{user_id}", response_model=RecommendationResponse)
async def get_content_based_recommendations(
    user_id: int,
    top_n: int = Query(10, ge=1, le=50, description="Number of recommendations"),
) -> RecommendationResponse:
    """
    Get content-based recommendations for a user.
    
    Uses TF-IDF vectorization and cosine similarity to find games
    similar to ones the user has enjoyed.
    """
    db = get_database()

    user = db.get_user(user_id)
    if not user:
        raise HTTPException(status_code=404, detail=f"User with ID {user_id} not found")

    engine = ContentBasedEngine(db)
    return engine.get_recommendations(user_id, top_n=top_n)


@router.get("/hybrid/{user_id}", response_model=RecommendationResponse)
async def get_hybrid_recommendations(
    user_id: int,
    method: str = Query(
        "auto",
        description="Hybrid method: weighted, switching, cascade, or auto",
    ),
    top_n: int = Query(10, ge=1, le=50, description="Number of recommendations"),
) -> RecommendationResponse:
    """
    Get hybrid recommendations combining multiple algorithms.
    
    Methods:
    - weighted: Weighted combination of CF and content-based
    - switching: Switches between algorithms based on data availability
    - cascade: Uses content-based to generate candidates, CF to re-rank
    - auto: Automatically selects best method based on user data
    """
    db = get_database()

    user = db.get_user(user_id)
    if not user:
        raise HTTPException(status_code=404, detail=f"User with ID {user_id} not found")

    engine = HybridRecommendationEngine(db)
    return engine.get_recommendations(user_id, method=method, top_n=top_n)


@router.post("/personalized", response_model=RecommendationResponse)
async def get_personalized_recommendations(
    context: PersonalizationContext,
    top_n: int = Query(10, ge=1, le=50, description="Number of recommendations"),
    apply_diversity: bool = Query(True, description="Apply diversity re-ranking"),
) -> RecommendationResponse:
    """
    Get real-time personalized recommendations.
    
    Takes into account:
    - Time of day preferences
    - Device type preferences
    - Current mood
    - Recent session interactions
    - Diversity in recommendations
    """
    db = get_database()

    user = db.get_user(context.user_id)
    if not user:
        raise HTTPException(
            status_code=404, detail=f"User with ID {context.user_id} not found"
        )

    engine = PersonalizationEngine(db)
    return engine.get_personalized_recommendations(
        context, top_n=top_n, apply_diversity=apply_diversity
    )


@router.get("/personalized/{user_id}", response_model=RecommendationResponse)
async def get_personalized_recommendations_simple(
    user_id: int,
    time_of_day: Optional[str] = Query(
        None, description="Time of day: morning, afternoon, evening, night"
    ),
    device_type: Optional[str] = Query(
        None, description="Device type: mobile, console, pc"
    ),
    mood: Optional[str] = Query(
        None, description="Current mood: relaxed, competitive, adventurous, focused"
    ),
    top_n: int = Query(10, ge=1, le=50, description="Number of recommendations"),
) -> RecommendationResponse:
    """
    Get real-time personalized recommendations (simplified endpoint).
    
    Provides personalized recommendations based on context parameters.
    """
    db = get_database()

    user = db.get_user(user_id)
    if not user:
        raise HTTPException(status_code=404, detail=f"User with ID {user_id} not found")

    context = PersonalizationContext(
        user_id=user_id,
        time_of_day=time_of_day,
        device_type=device_type,
        current_mood=mood,
    )

    engine = PersonalizationEngine(db)
    return engine.get_personalized_recommendations(context, top_n=top_n)


@router.post("/session/{session_id}/interaction")
async def record_session_interaction(
    session_id: str,
    game_id: int = Query(..., description="Game ID that was interacted with"),
) -> dict:
    """Record a user interaction for session-based recommendations."""
    db = get_database()

    game = db.get_game(game_id)
    if not game:
        raise HTTPException(status_code=404, detail=f"Game with ID {game_id} not found")

    engine = PersonalizationEngine(db)
    engine.record_interaction(session_id, game_id)

    return {
        "status": "recorded",
        "session_id": session_id,
        "game_id": game_id,
        "game_title": game.title,
    }


@router.get("/session/{session_id}/interactions")
async def get_session_interactions(session_id: str) -> dict:
    """Get recent interactions for a session."""
    db = get_database()
    engine = PersonalizationEngine(db)

    interactions = engine.get_session_interactions(session_id)

    enriched_interactions = []
    for game_id in interactions:
        game = db.get_game(game_id)
        if game:
            enriched_interactions.append({
                "game_id": game_id,
                "game_title": game.title,
            })

    return {
        "session_id": session_id,
        "interaction_count": len(interactions),
        "interactions": enriched_interactions,
    }


@router.delete("/session/{session_id}")
async def clear_session(session_id: str) -> dict:
    """Clear session interaction history."""
    db = get_database()
    engine = PersonalizationEngine(db)
    engine.clear_session(session_id)

    return {
        "status": "cleared",
        "session_id": session_id,
    }
