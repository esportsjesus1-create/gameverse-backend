from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.analytics.routers import (
    players_router,
    events_router,
    sessions_router,
    engagement_router,
    retention_router,
    funnels_router,
    experiments_router,
    predictive_router,
    visualization_router,
)

app = FastAPI(
    title="GameVerse N1.42 Analytics Module",
    description="Advanced analytics engine for player behavior analysis, engagement metrics, retention tracking, funnel analysis, A/B testing, predictive modeling, and data visualization.",
    version="1.42.0",
)

# Disable CORS. Do not remove this for full-stack development.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)

# Include analytics routers
app.include_router(players_router, prefix="/api/v1/analytics")
app.include_router(events_router, prefix="/api/v1/analytics")
app.include_router(sessions_router, prefix="/api/v1/analytics")
app.include_router(engagement_router, prefix="/api/v1/analytics")
app.include_router(retention_router, prefix="/api/v1/analytics")
app.include_router(funnels_router, prefix="/api/v1/analytics")
app.include_router(experiments_router, prefix="/api/v1/analytics")
app.include_router(predictive_router, prefix="/api/v1/analytics")
app.include_router(visualization_router, prefix="/api/v1/analytics")


@app.get("/healthz")
async def healthz():
    return {"status": "ok"}


@app.get("/")
async def root():
    return {
        "name": "GameVerse N1.42 Analytics Module",
        "version": "1.42.0",
        "status": "operational",
        "features": [
            "Player Behavior Analysis",
            "Engagement Metrics",
            "Retention Tracking",
            "Funnel Analysis",
            "A/B Testing Support",
            "Predictive Modeling",
            "Data Visualization",
        ],
    }
