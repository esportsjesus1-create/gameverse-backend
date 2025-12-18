from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from .dev_portal.database import init_db
from .dev_portal.routers import auth, api_keys, rate_limiting, webhooks, sandbox, analytics, sdks, documentation


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(
    title="GameVerse Developer Portal API",
    description="N1.47 Developer Portal - API documentation, SDK management, API key generation, rate limiting, webhooks, sandbox environments, and developer analytics",
    version="1.47.0",
    lifespan=lifespan
)

# Disable CORS. Do not remove this for full-stack development.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)

app.include_router(auth.router, prefix="/api/v1/dev-portal")
app.include_router(api_keys.router, prefix="/api/v1/dev-portal")
app.include_router(rate_limiting.router, prefix="/api/v1/dev-portal")
app.include_router(webhooks.router, prefix="/api/v1/dev-portal")
app.include_router(sandbox.router, prefix="/api/v1/dev-portal")
app.include_router(analytics.router, prefix="/api/v1/dev-portal")
app.include_router(sdks.router, prefix="/api/v1/dev-portal")
app.include_router(documentation.router, prefix="/api/v1/dev-portal")


@app.get("/healthz")
async def healthz():
    return {"status": "ok"}


@app.get("/")
async def root():
    return {
        "name": "GameVerse Developer Portal",
        "version": "N1.47",
        "description": "Developer portal for GameVerse API",
        "documentation": "/docs",
        "endpoints": {
            "auth": "/api/v1/dev-portal/auth",
            "api_keys": "/api/v1/dev-portal/api-keys",
            "rate_limiting": "/api/v1/dev-portal/rate-limiting",
            "webhooks": "/api/v1/dev-portal/webhooks",
            "sandbox": "/api/v1/dev-portal/sandbox",
            "analytics": "/api/v1/dev-portal/analytics",
            "sdks": "/api/v1/dev-portal/sdks",
            "documentation": "/api/v1/dev-portal/documentation"
        }
    }
