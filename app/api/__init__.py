from .resources import router as resources_router
from .budgets import router as budgets_router
from .costs import router as costs_router
from .forecasts import router as forecasts_router
from .anomalies import router as anomalies_router
from .recommendations import router as recommendations_router
from .dashboard import router as dashboard_router

__all__ = [
    "resources_router",
    "budgets_router",
    "costs_router",
    "forecasts_router",
    "anomalies_router",
    "recommendations_router",
    "dashboard_router",
]
