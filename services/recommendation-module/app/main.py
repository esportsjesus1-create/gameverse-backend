"""
GameVerse N1.43 Recommendation Module

ML-powered recommendation engine with:
- Collaborative filtering (user-based, item-based, SVD)
- Content-based recommendations (TF-IDF, categorical features)
- Hybrid algorithms (weighted, switching, cascade)
- Real-time personalization
- Item similarity scoring
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import (
    games_router,
    users_router,
    ratings_router,
    recommendations_router,
    similarity_router,
)

app = FastAPI(
    title="GameVerse N1.43 Recommendation Module",
    description="ML-powered game recommendation engine with collaborative filtering, content-based recommendations, hybrid algorithms, real-time personalization, and item similarity scoring.",
    version="1.43.0",
)

# Disable CORS. Do not remove this for full-stack development.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)

# Include routers
app.include_router(games_router)
app.include_router(users_router)
app.include_router(ratings_router)
app.include_router(recommendations_router)
app.include_router(similarity_router)


@app.get("/healthz")
async def healthz():
    """Health check endpoint."""
    return {"status": "ok"}


@app.get("/")
async def root():
    """Root endpoint with API information."""
    return {
        "name": "GameVerse N1.43 Recommendation Module",
        "version": "1.43.0",
        "description": "ML-powered game recommendation engine",
        "features": [
            "Collaborative Filtering (user-based, item-based, SVD)",
            "Content-Based Recommendations (TF-IDF, categorical)",
            "Hybrid Algorithms (weighted, switching, cascade)",
            "Real-Time Personalization",
            "Item Similarity Scoring",
        ],
        "endpoints": {
            "games": "/games",
            "users": "/users",
            "ratings": "/ratings",
            "recommendations": "/recommendations",
            "similarity": "/similarity",
            "docs": "/docs",
        },
    }
