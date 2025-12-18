from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.fraud_ml.api import router as fraud_router

app = FastAPI(
    title="GameVerse Backend",
    description="GameVerse N1.44 Fraud-ML Module - Comprehensive fraud detection system",
    version="1.44.0",
)

# Disable CORS. Do not remove this for full-stack development.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)

# Include fraud detection routes
app.include_router(fraud_router, prefix="/api/v1")


@app.get("/healthz")
async def healthz():
    return {"status": "ok"}


@app.get("/")
async def root():
    return {
        "name": "GameVerse Backend",
        "version": "1.44.0",
        "module": "fraud-ml",
        "features": [
            "anomaly_detection",
            "behavior_pattern_analysis",
            "transaction_monitoring",
            "risk_scoring",
            "bot_detection",
            "automated_flagging",
        ],
    }
