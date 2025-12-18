"""Similarity API router for GameVerse recommendation module."""

from fastapi import APIRouter, HTTPException, Query

from app.database.memory_db import get_database
from app.models.schemas import SimilarityResponse
from app.services.similarity import SimilarityEngine

router = APIRouter(prefix="/similarity", tags=["similarity"])


@router.get("/{game_id}", response_model=SimilarityResponse)
async def get_similar_games(
    game_id: int,
    similarity_type: str = Query(
        "combined",
        description="Similarity type: feature, behavioral, or combined",
    ),
    top_n: int = Query(10, ge=1, le=50, description="Number of similar games"),
) -> SimilarityResponse:
    """
    Get games similar to a given game.
    
    Similarity types:
    - feature: Based on game content (genre, tags, description)
    - behavioral: Based on user behavior (users who liked X also liked Y)
    - combined: Weighted combination of both approaches
    """
    db = get_database()

    game = db.get_game(game_id)
    if not game:
        raise HTTPException(status_code=404, detail=f"Game with ID {game_id} not found")

    engine = SimilarityEngine(db)
    return engine.get_similarity_response(
        game_id, similarity_type=similarity_type, top_n=top_n
    )


@router.get("/{game_id}/feature", response_model=SimilarityResponse)
async def get_feature_similar_games(
    game_id: int,
    top_n: int = Query(10, ge=1, le=50, description="Number of similar games"),
) -> SimilarityResponse:
    """
    Get games similar based on content features.
    
    Uses TF-IDF vectorization and categorical features to find similar games.
    """
    db = get_database()

    game = db.get_game(game_id)
    if not game:
        raise HTTPException(status_code=404, detail=f"Game with ID {game_id} not found")

    engine = SimilarityEngine(db)
    return engine.get_similarity_response(game_id, similarity_type="feature", top_n=top_n)


@router.get("/{game_id}/behavioral", response_model=SimilarityResponse)
async def get_behavioral_similar_games(
    game_id: int,
    top_n: int = Query(10, ge=1, le=50, description="Number of similar games"),
) -> SimilarityResponse:
    """
    Get games similar based on user behavior.
    
    Finds games that users who liked this game also liked.
    """
    db = get_database()

    game = db.get_game(game_id)
    if not game:
        raise HTTPException(status_code=404, detail=f"Game with ID {game_id} not found")

    engine = SimilarityEngine(db)
    return engine.get_similarity_response(
        game_id, similarity_type="behavioral", top_n=top_n
    )


@router.get("/bridge/{game_id_a}/{game_id_b}")
async def get_bridge_games(
    game_id_a: int,
    game_id_b: int,
    top_n: int = Query(5, ge=1, le=20, description="Number of bridge games"),
) -> dict:
    """
    Find games that bridge two different games.
    
    Useful for discovering games that share characteristics with both inputs.
    """
    db = get_database()

    game_a = db.get_game(game_id_a)
    if not game_a:
        raise HTTPException(
            status_code=404, detail=f"Game with ID {game_id_a} not found"
        )

    game_b = db.get_game(game_id_b)
    if not game_b:
        raise HTTPException(
            status_code=404, detail=f"Game with ID {game_id_b} not found"
        )

    engine = SimilarityEngine(db)
    bridge_games = engine.find_bridge_games(game_id_a, game_id_b, top_n=top_n)

    return {
        "game_a": {"id": game_id_a, "title": game_a.title},
        "game_b": {"id": game_id_b, "title": game_b.title},
        "bridge_games": [
            {
                "game_id": bg.game_id,
                "game_title": bg.game_title,
                "similarity_score": bg.similarity_score,
            }
            for bg in bridge_games
        ],
    }


@router.post("/matrix")
async def get_similarity_matrix(
    game_ids: list[int],
    similarity_type: str = Query(
        "combined",
        description="Similarity type: feature, behavioral, or combined",
    ),
) -> dict:
    """
    Get pairwise similarity matrix for a list of games.
    
    Returns similarity scores between all pairs of specified games.
    """
    db = get_database()

    for game_id in game_ids:
        game = db.get_game(game_id)
        if not game:
            raise HTTPException(
                status_code=404, detail=f"Game with ID {game_id} not found"
            )

    engine = SimilarityEngine(db)
    matrix = engine.get_similarity_matrix(game_ids, similarity_type=similarity_type)

    formatted_matrix = {}
    for game_id, similarities in matrix.items():
        game = db.get_game(game_id)
        formatted_matrix[game_id] = {
            "game_title": game.title if game else "Unknown",
            "similarities": similarities,
        }

    return {
        "similarity_type": similarity_type,
        "game_count": len(game_ids),
        "matrix": formatted_matrix,
    }
