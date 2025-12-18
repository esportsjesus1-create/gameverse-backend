import pytest
from datetime import datetime, timedelta
from app.services import ForecastService, ResourceService
from app.models import (
    ForecastRequest,
    ForecastHorizon,
    ResourceCreate,
    ResourceUsageCreate,
    ResourceType,
    CloudProvider,
)


class TestForecastService:
    @pytest.fixture
    def service(self):
        return ForecastService()

    @pytest.fixture
    def resource_service(self):
        return ResourceService()

    @pytest.fixture
    def resource_with_usage(self, resource_service):
        resource = resource_service.create_resource(
            ResourceCreate(
                name="test-server",
                resource_type=ResourceType.COMPUTE,
                provider=CloudProvider.AWS,
                region="us-east-1",
                project_id="project-1",
                unit_cost=0.10,
            )
        )

        base_time = datetime.utcnow() - timedelta(days=30)
        for i in range(30):
            resource_service.record_usage(
                ResourceUsageCreate(
                    resource_id=resource.id,
                    usage_value=10.0 + i * 0.5,
                    timestamp=base_time + timedelta(days=i),
                )
            )

        return resource

    def test_generate_forecast_empty(self, service):
        request = ForecastRequest(
            resource_id="nonexistent",
            horizon=ForecastHorizon.MONTHLY,
            periods=3,
        )
        forecast = service.generate_forecast(request)
        assert forecast.id is not None
        assert len(forecast.predictions) == 0
        assert forecast.total_predicted_cost == 0.0
        assert forecast.confidence_score == 0.0

    def test_generate_forecast_with_data(self, service, resource_with_usage):
        request = ForecastRequest(
            resource_id=resource_with_usage.id,
            horizon=ForecastHorizon.MONTHLY,
            periods=3,
        )
        forecast = service.generate_forecast(request)
        assert forecast.id is not None
        assert len(forecast.predictions) == 3
        assert forecast.total_predicted_cost > 0
        assert forecast.confidence_score > 0

    def test_generate_forecast_by_project(self, service, resource_with_usage):
        request = ForecastRequest(
            project_id="project-1",
            horizon=ForecastHorizon.MONTHLY,
            periods=3,
        )
        forecast = service.generate_forecast(request)
        assert forecast.id is not None
        assert forecast.project_id == "project-1"

    def test_generate_forecast_different_horizons(self, service, resource_with_usage):
        for horizon in ForecastHorizon:
            request = ForecastRequest(
                resource_id=resource_with_usage.id,
                horizon=horizon,
                periods=2,
            )
            forecast = service.generate_forecast(request)
            assert forecast.horizon == horizon

    def test_analyze_trend_empty(self, service):
        trend = service.analyze_trend(resource_id="nonexistent", days=30)
        assert trend.id is not None
        assert trend.trend_direction == "stable"
        assert trend.trend_percentage == 0.0
        assert trend.average_daily_cost == 0.0

    def test_analyze_trend_with_data(self, service, resource_with_usage):
        trend = service.analyze_trend(resource_id=resource_with_usage.id, days=30)
        assert trend.id is not None
        assert trend.trend_direction in ["increasing", "decreasing", "stable"]
        assert trend.average_daily_cost > 0

    def test_analyze_trend_by_project(self, service, resource_with_usage):
        trend = service.analyze_trend(project_id="project-1", days=30)
        assert trend.id is not None
        assert trend.project_id == "project-1"

    def test_get_forecasts(self, service, resource_with_usage):
        request = ForecastRequest(
            resource_id=resource_with_usage.id,
            horizon=ForecastHorizon.MONTHLY,
            periods=3,
        )
        service.generate_forecast(request)

        forecasts = service.get_forecasts(resource_id=resource_with_usage.id)
        assert len(forecasts) >= 1

    def test_get_forecasts_by_project(self, service, resource_with_usage):
        request = ForecastRequest(
            project_id="project-1",
            horizon=ForecastHorizon.MONTHLY,
            periods=3,
        )
        service.generate_forecast(request)

        forecasts = service.get_forecasts(project_id="project-1")
        assert len(forecasts) >= 1

    def test_horizon_days_mapping(self, service):
        assert service._get_horizon_days(ForecastHorizon.DAILY) == 1
        assert service._get_horizon_days(ForecastHorizon.WEEKLY) == 7
        assert service._get_horizon_days(ForecastHorizon.MONTHLY) == 30
        assert service._get_horizon_days(ForecastHorizon.QUARTERLY) == 90
