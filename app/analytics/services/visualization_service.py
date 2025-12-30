from typing import Dict, Any
from datetime import datetime, timedelta, date
from ..models.metrics import TimeSeriesData, TimeSeriesDataPoint, DashboardData, DashboardWidget
from .database import db
from .engagement_service import EngagementService
from .retention_service import RetentionService


class VisualizationService:
    """Service for data visualization and dashboard generation."""

    @staticmethod
    def get_time_series(
        metric_name: str,
        start_date: date,
        end_date: date,
        aggregation: str = "daily",
    ) -> TimeSeriesData:
        """Generate time series data for a specific metric."""
        data_points = []
        current = start_date
        
        while current <= end_date:
            if metric_name == "dau":
                value = EngagementService.calculate_dau(current)
            elif metric_name == "wau":
                value = EngagementService.calculate_wau(current)
            elif metric_name == "mau":
                value = EngagementService.calculate_mau(current)
            elif metric_name == "new_users":
                value = EngagementService.calculate_new_users(current)
            elif metric_name == "sessions":
                start = datetime.combine(current, datetime.min.time())
                end = datetime.combine(current, datetime.max.time())
                sessions = db.get_sessions_by_filter(start_time=start, end_time=end)
                value = len(sessions)
            elif metric_name == "events":
                start = datetime.combine(current, datetime.min.time())
                end = datetime.combine(current, datetime.max.time())
                events = db.get_events_by_filter(start_time=start, end_time=end)
                value = len(events)
            elif metric_name == "d1_retention":
                value = RetentionService.calculate_day_n_retention(current, 1) * 100
            elif metric_name == "d7_retention":
                value = RetentionService.calculate_day_n_retention(current, 7) * 100
            elif metric_name == "stickiness":
                value = EngagementService.calculate_stickiness(current) * 100
            else:
                value = 0
            
            data_points.append(TimeSeriesDataPoint(
                timestamp=datetime.combine(current, datetime.min.time()),
                value=float(value),
                label=current.strftime("%Y-%m-%d"),
            ))
            
            if aggregation == "daily":
                current += timedelta(days=1)
            elif aggregation == "weekly":
                current += timedelta(weeks=1)
            else:
                current += timedelta(days=30)
        
        return TimeSeriesData(
            metric_name=metric_name,
            data_points=data_points,
            aggregation=aggregation,
            start_date=datetime.combine(start_date, datetime.min.time()),
            end_date=datetime.combine(end_date, datetime.max.time()),
        )

    @staticmethod
    def get_overview_dashboard(
        start_date: date,
        end_date: date,
    ) -> DashboardData:
        """Generate overview dashboard with key metrics."""
        widgets = []
        
        dau_series = VisualizationService.get_time_series("dau", start_date, end_date)
        widgets.append(DashboardWidget(
            id="dau_chart",
            title="Daily Active Users",
            widget_type="line_chart",
            data=dau_series.model_dump(),
            config={"color": "#4CAF50"},
        ))
        
        new_users_series = VisualizationService.get_time_series("new_users", start_date, end_date)
        widgets.append(DashboardWidget(
            id="new_users_chart",
            title="New User Acquisition",
            widget_type="bar_chart",
            data=new_users_series.model_dump(),
            config={"color": "#2196F3"},
        ))
        
        sessions_series = VisualizationService.get_time_series("sessions", start_date, end_date)
        widgets.append(DashboardWidget(
            id="sessions_chart",
            title="Total Sessions",
            widget_type="area_chart",
            data=sessions_series.model_dump(),
            config={"color": "#FF9800"},
        ))
        
        retention_series = VisualizationService.get_time_series("d1_retention", start_date, end_date)
        widgets.append(DashboardWidget(
            id="retention_chart",
            title="Day 1 Retention (%)",
            widget_type="line_chart",
            data=retention_series.model_dump(),
            config={"color": "#9C27B0"},
        ))
        
        today = end_date
        metrics = EngagementService.get_engagement_metrics(today)
        widgets.append(DashboardWidget(
            id="kpi_summary",
            title="Key Metrics Summary",
            widget_type="kpi_cards",
            data={
                "dau": metrics.daily_active_users,
                "wau": metrics.weekly_active_users,
                "mau": metrics.monthly_active_users,
                "avg_session_duration": round(metrics.average_session_duration, 1),
                "stickiness": round(metrics.stickiness * 100, 1),
            },
            config={},
        ))
        
        return DashboardData(
            dashboard_id="overview",
            title="Analytics Overview",
            widgets=widgets,
            filters={"start_date": str(start_date), "end_date": str(end_date)},
        )

    @staticmethod
    def get_retention_dashboard(
        start_date: date,
        end_date: date,
    ) -> DashboardData:
        """Generate retention-focused dashboard."""
        widgets = []
        
        cohorts = RetentionService.get_cohort_retention_matrix(start_date, end_date, 14)
        cohort_data = [c.model_dump() for c in cohorts]
        widgets.append(DashboardWidget(
            id="cohort_matrix",
            title="Cohort Retention Matrix",
            widget_type="heatmap",
            data=cohort_data,
            config={"color_scale": "blues"},
        ))
        
        d1_series = VisualizationService.get_time_series("d1_retention", start_date, end_date)
        d7_series = VisualizationService.get_time_series("d7_retention", start_date, end_date)
        widgets.append(DashboardWidget(
            id="retention_trends",
            title="Retention Trends",
            widget_type="multi_line_chart",
            data={
                "d1": d1_series.model_dump(),
                "d7": d7_series.model_dump(),
            },
            config={"colors": {"d1": "#4CAF50", "d7": "#2196F3"}},
        ))
        
        at_risk = RetentionService.identify_at_risk_players(7)[:10]
        widgets.append(DashboardWidget(
            id="at_risk_players",
            title="At-Risk Players",
            widget_type="table",
            data=at_risk,
            config={"columns": ["username", "days_inactive", "total_sessions"]},
        ))
        
        return DashboardData(
            dashboard_id="retention",
            title="Retention Analytics",
            widgets=widgets,
            filters={"start_date": str(start_date), "end_date": str(end_date)},
        )

    @staticmethod
    def get_engagement_dashboard(
        start_date: date,
        end_date: date,
    ) -> DashboardData:
        """Generate engagement-focused dashboard."""
        widgets = []
        
        stickiness_series = VisualizationService.get_time_series("stickiness", start_date, end_date)
        widgets.append(DashboardWidget(
            id="stickiness_chart",
            title="DAU/MAU Stickiness (%)",
            widget_type="line_chart",
            data=stickiness_series.model_dump(),
            config={"color": "#E91E63"},
        ))
        
        end_dt = datetime.combine(end_date, datetime.max.time())
        start_dt = datetime.combine(start_date, datetime.min.time())
        feature_stats = EngagementService.get_feature_usage_stats(start_dt, end_dt)
        widgets.append(DashboardWidget(
            id="feature_usage",
            title="Feature Usage",
            widget_type="bar_chart",
            data=feature_stats,
            config={"orientation": "horizontal"},
        ))
        
        screen_stats = EngagementService.get_screen_view_stats(start_dt, end_dt)
        widgets.append(DashboardWidget(
            id="screen_views",
            title="Screen Views",
            widget_type="pie_chart",
            data=screen_stats,
            config={},
        ))
        
        events_series = VisualizationService.get_time_series("events", start_date, end_date)
        widgets.append(DashboardWidget(
            id="events_chart",
            title="Total Events",
            widget_type="area_chart",
            data=events_series.model_dump(),
            config={"color": "#00BCD4"},
        ))
        
        return DashboardData(
            dashboard_id="engagement",
            title="Engagement Analytics",
            widgets=widgets,
            filters={"start_date": str(start_date), "end_date": str(end_date)},
        )

    @staticmethod
    def export_data(
        data_type: str,
        start_date: date,
        end_date: date,
        format: str = "json",
    ) -> Dict[str, Any]:
        """Export analytics data in various formats."""
        start_dt = datetime.combine(start_date, datetime.min.time())
        end_dt = datetime.combine(end_date, datetime.max.time())
        
        if data_type == "events":
            data = db.get_events_by_filter(start_time=start_dt, end_time=end_dt)
        elif data_type == "sessions":
            data = db.get_sessions_by_filter(start_time=start_dt, end_time=end_dt)
        elif data_type == "players":
            data = db.get_players_by_filter(created_after=start_dt, created_before=end_dt)
        elif data_type == "engagement":
            metrics = EngagementService.get_engagement_trend(start_date, end_date)
            data = [m.model_dump() for m in metrics]
        elif data_type == "retention":
            cohorts = RetentionService.get_cohort_retention_matrix(start_date, end_date)
            data = [c.model_dump() for c in cohorts]
        else:
            data = []
        
        return {
            "data_type": data_type,
            "format": format,
            "start_date": str(start_date),
            "end_date": str(end_date),
            "record_count": len(data),
            "data": data,
        }
