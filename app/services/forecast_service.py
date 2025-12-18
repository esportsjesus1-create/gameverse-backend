import uuid
from datetime import datetime, timedelta
from typing import Optional
import numpy as np
from sklearn.linear_model import LinearRegression
from app.database import get_database
from app.models import (
    UsageForecast,
    ForecastRequest,
    ForecastHorizon,
    TrendAnalysis,
)
from app.models.forecast import ForecastDataPoint
from app.services.resource_service import ResourceService


class ForecastService:
    def __init__(self):
        self.db = get_database()
        self.resource_service = ResourceService()

    def _get_horizon_days(self, horizon: ForecastHorizon) -> int:
        horizon_map = {
            ForecastHorizon.DAILY: 1,
            ForecastHorizon.WEEKLY: 7,
            ForecastHorizon.MONTHLY: 30,
            ForecastHorizon.QUARTERLY: 90,
        }
        return horizon_map.get(horizon, 30)

    def generate_forecast(self, request: ForecastRequest) -> UsageForecast:
        usage_records = self.resource_service.get_usage(
            resource_id=request.resource_id
        )

        if request.project_id:
            resources = self.resource_service.get_resources(
                project_id=request.project_id
            )
            resource_ids = {r.id for r in resources}
            usage_records = [u for u in usage_records if u.resource_id in resource_ids]

        if request.team_id:
            resources = self.resource_service.get_resources(team_id=request.team_id)
            resource_ids = {r.id for r in resources}
            usage_records = [u for u in usage_records if u.resource_id in resource_ids]

        if len(usage_records) < 3:
            return self._generate_empty_forecast(request)

        usage_records.sort(key=lambda x: x.timestamp)

        costs = [u.cost for u in usage_records]
        timestamps = [u.timestamp.timestamp() for u in usage_records]

        X = np.array(timestamps).reshape(-1, 1)
        y = np.array(costs)

        model = LinearRegression()
        model.fit(X, y)

        horizon_days = self._get_horizon_days(request.horizon)
        predictions = []
        last_timestamp = usage_records[-1].timestamp

        for i in range(1, request.periods + 1):
            future_date = last_timestamp + timedelta(days=horizon_days * i)
            future_timestamp = np.array([[future_date.timestamp()]])
            predicted_value = float(model.predict(future_timestamp)[0])
            predicted_value = max(0, predicted_value)

            std_dev = float(np.std(costs)) if len(costs) > 1 else predicted_value * 0.1
            confidence = min(0.95, 0.5 + len(usage_records) * 0.05)

            predictions.append(
                ForecastDataPoint(
                    date=future_date,
                    predicted_value=predicted_value,
                    lower_bound=max(0, predicted_value - 1.96 * std_dev),
                    upper_bound=predicted_value + 1.96 * std_dev,
                    confidence=confidence,
                )
            )

        total_predicted = sum(p.predicted_value for p in predictions)
        avg_confidence = sum(p.confidence for p in predictions) / len(predictions)

        forecast = UsageForecast(
            id=str(uuid.uuid4()),
            resource_id=request.resource_id,
            project_id=request.project_id,
            team_id=request.team_id,
            horizon=request.horizon,
            generated_at=datetime.utcnow(),
            predictions=predictions,
            total_predicted_cost=total_predicted,
            confidence_score=avg_confidence,
            model_type="linear_regression",
        )

        self.db.forecasts.create(forecast.model_dump())
        return forecast

    def _generate_empty_forecast(self, request: ForecastRequest) -> UsageForecast:
        return UsageForecast(
            id=str(uuid.uuid4()),
            resource_id=request.resource_id,
            project_id=request.project_id,
            team_id=request.team_id,
            horizon=request.horizon,
            generated_at=datetime.utcnow(),
            predictions=[],
            total_predicted_cost=0.0,
            confidence_score=0.0,
            model_type="linear_regression",
        )

    def analyze_trend(
        self,
        resource_id: Optional[str] = None,
        project_id: Optional[str] = None,
        days: int = 30,
    ) -> TrendAnalysis:
        end_time = datetime.utcnow()
        start_time = end_time - timedelta(days=days)

        usage_records = self.resource_service.get_usage(
            resource_id=resource_id,
            start_time=start_time,
            end_time=end_time,
        )

        if project_id:
            resources = self.resource_service.get_resources(project_id=project_id)
            resource_ids = {r.id for r in resources}
            usage_records = [u for u in usage_records if u.resource_id in resource_ids]

        if not usage_records:
            return TrendAnalysis(
                id=str(uuid.uuid4()),
                resource_id=resource_id,
                project_id=project_id,
                period_start=start_time,
                period_end=end_time,
                trend_direction="stable",
                trend_percentage=0.0,
                seasonality_detected=False,
                average_daily_cost=0.0,
                projected_monthly_cost=0.0,
            )

        usage_records.sort(key=lambda x: x.timestamp)
        costs = [u.cost for u in usage_records]

        mid_point = len(costs) // 2
        first_half_avg = np.mean(costs[:mid_point]) if mid_point > 0 else 0
        second_half_avg = np.mean(costs[mid_point:]) if mid_point < len(costs) else 0

        if first_half_avg > 0:
            trend_percentage = ((second_half_avg - first_half_avg) / first_half_avg) * 100
        else:
            trend_percentage = 0.0

        if trend_percentage > 5:
            trend_direction = "increasing"
        elif trend_percentage < -5:
            trend_direction = "decreasing"
        else:
            trend_direction = "stable"

        total_cost = sum(costs)
        actual_days = max(1, (end_time - start_time).days)
        average_daily_cost = total_cost / actual_days
        projected_monthly_cost = average_daily_cost * 30

        seasonality_detected = False
        seasonal_pattern = None
        peak_usage_time = None

        if len(costs) >= 7:
            daily_costs: dict[int, list[float]] = {}
            for usage in usage_records:
                day = usage.timestamp.weekday()
                if day not in daily_costs:
                    daily_costs[day] = []
                daily_costs[day].append(usage.cost)

            if len(daily_costs) >= 5:
                daily_averages = {
                    day: np.mean(costs_list) for day, costs_list in daily_costs.items()
                }
                if daily_averages:
                    max_day = max(daily_averages, key=lambda x: daily_averages[x])
                    min_day = min(daily_averages, key=lambda x: daily_averages[x])
                    variance = (daily_averages[max_day] - daily_averages[min_day]) / max(
                        daily_averages[max_day], 1
                    )
                    if variance > 0.2:
                        seasonality_detected = True
                        seasonal_pattern = "weekly"
                        days_map = [
                            "Monday",
                            "Tuesday",
                            "Wednesday",
                            "Thursday",
                            "Friday",
                            "Saturday",
                            "Sunday",
                        ]
                        peak_usage_time = days_map[max_day]

        return TrendAnalysis(
            id=str(uuid.uuid4()),
            resource_id=resource_id,
            project_id=project_id,
            period_start=start_time,
            period_end=end_time,
            trend_direction=trend_direction,
            trend_percentage=trend_percentage,
            seasonality_detected=seasonality_detected,
            seasonal_pattern=seasonal_pattern,
            peak_usage_time=peak_usage_time,
            average_daily_cost=average_daily_cost,
            projected_monthly_cost=projected_monthly_cost,
        )

    def get_forecasts(
        self,
        resource_id: Optional[str] = None,
        project_id: Optional[str] = None,
    ) -> list[UsageForecast]:
        filters = {}
        if resource_id:
            filters["resource_id"] = resource_id
        if project_id:
            filters["project_id"] = project_id

        results = self.db.forecasts.get_all(filters if filters else None)
        forecasts = []
        for r in results:
            if "predictions" in r:
                r["predictions"] = [
                    ForecastDataPoint(**p) if isinstance(p, dict) else p
                    for p in r["predictions"]
                ]
            forecasts.append(UsageForecast(**r))
        return forecasts
