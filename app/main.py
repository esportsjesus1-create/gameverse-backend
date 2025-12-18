from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import (
    resources_router,
    budgets_router,
    costs_router,
    forecasts_router,
    anomalies_router,
    recommendations_router,
    dashboard_router,
)

app = FastAPI(
    title="GameVerse Cost-Guard Module",
    description="N1.49 Cost monitoring and optimization system for cloud resources",
    version="1.49.0",
)

# Disable CORS. Do not remove this for full-stack development.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)

app.include_router(resources_router)
app.include_router(budgets_router)
app.include_router(costs_router)
app.include_router(forecasts_router)
app.include_router(anomalies_router)
app.include_router(recommendations_router)
app.include_router(dashboard_router)


@app.get("/healthz")
async def healthz():
    return {"status": "ok"}
