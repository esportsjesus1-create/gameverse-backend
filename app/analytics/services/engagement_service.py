from typing import List, Optional, Dict
from datetime import datetime, timedelta, date
from ..models.metrics import EngagementMetrics
from .database import db


class EngagementService:
    """Service for engagement metrics calculation."""

    @staticmethod
    def calculate_dau(target_date: date) -> int:
        """Calculate Daily Active Users for a specific date."""
        start = datetime.combine(target_date, datetime.min.time())
        end = datetime.combine(target_date, datetime.max.time())
        
        sessions = db.get_sessions_by_filter(start_time=start, end_time=end)
        unique_players = set(s.get("player_id") for s in sessions)
        return len(unique_players)

    @staticmethod
    def calculate_wau(target_date: date) -> int:
        """Calculate Weekly Active Users (7 days ending on target_date)."""
        end = datetime.combine(target_date, datetime.max.time())
        start = end - timedelta(days=7)
        
        sessions = db.get_sessions_by_filter(start_time=start, end_time=end)
        unique_players = set(s.get("player_id") for s in sessions)
        return len(unique_players)

    @staticmethod
    def calculate_mau(target_date: date) -> int:
        """Calculate Monthly Active Users (30 days ending on target_date)."""
        end = datetime.combine(target_date, datetime.max.time())
        start = end - timedelta(days=30)
        
        sessions = db.get_sessions_by_filter(start_time=start, end_time=end)
        unique_players = set(s.get("player_id") for s in sessions)
        return len(unique_players)

    @staticmethod
    def calculate_new_users(target_date: date) -> int:
        """Calculate new users who signed up on target_date."""
        start = datetime.combine(target_date, datetime.min.time())
        end = datetime.combine(target_date, datetime.max.time())
        
        players = db.get_players_by_filter(created_after=start, created_before=end)
        return len(players)

    @staticmethod
    def calculate_returning_users(target_date: date) -> int:
        """Calculate users who were active but not new on target_date."""
        start = datetime.combine(target_date, datetime.min.time())
        end = datetime.combine(target_date, datetime.max.time())
        
        sessions = db.get_sessions_by_filter(start_time=start, end_time=end)
        active_players = set(s.get("player_id") for s in sessions)
        
        new_players = db.get_players_by_filter(created_after=start, created_before=end)
        new_player_ids = set(p.get("id") for p in new_players)
        
        returning = active_players - new_player_ids
        return len(returning)

    @staticmethod
    def calculate_stickiness(target_date: date) -> float:
        """Calculate DAU/MAU ratio (stickiness)."""
        dau = EngagementService.calculate_dau(target_date)
        mau = EngagementService.calculate_mau(target_date)
        return dau / mau if mau > 0 else 0.0

    @staticmethod
    def get_engagement_metrics(target_date: date) -> EngagementMetrics:
        """Get comprehensive engagement metrics for a date."""
        start = datetime.combine(target_date, datetime.min.time())
        end = datetime.combine(target_date, datetime.max.time())
        
        sessions = db.get_sessions_by_filter(start_time=start, end_time=end)
        events = db.get_events_by_filter(start_time=start, end_time=end)
        
        total_sessions = len(sessions)
        total_events = len(events)
        
        durations = [s.get("duration_minutes", 0) for s in sessions if not s.get("is_active")]
        avg_duration = sum(durations) / len(durations) if durations else 0
        
        unique_players = set(s.get("player_id") for s in sessions)
        avg_sessions_per_user = total_sessions / len(unique_players) if unique_players else 0
        avg_events_per_session = total_events / total_sessions if total_sessions > 0 else 0
        
        return EngagementMetrics(
            date=target_date,
            daily_active_users=EngagementService.calculate_dau(target_date),
            weekly_active_users=EngagementService.calculate_wau(target_date),
            monthly_active_users=EngagementService.calculate_mau(target_date),
            new_users=EngagementService.calculate_new_users(target_date),
            returning_users=EngagementService.calculate_returning_users(target_date),
            total_sessions=total_sessions,
            average_session_duration=avg_duration,
            average_sessions_per_user=avg_sessions_per_user,
            total_events=total_events,
            average_events_per_session=avg_events_per_session,
            stickiness=EngagementService.calculate_stickiness(target_date),
        )

    @staticmethod
    def get_engagement_trend(
        start_date: date, end_date: date
    ) -> List[EngagementMetrics]:
        """Get engagement metrics trend over a date range."""
        metrics = []
        current = start_date
        while current <= end_date:
            metrics.append(EngagementService.get_engagement_metrics(current))
            current += timedelta(days=1)
        return metrics

    @staticmethod
    def get_feature_usage_stats(
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
    ) -> Dict[str, int]:
        """Get feature usage statistics."""
        sessions = db.get_sessions_by_filter(start_time=start_time, end_time=end_time)
        
        feature_counts: Dict[str, int] = {}
        for session in sessions:
            for feature in session.get("features_used", []):
                feature_counts[feature] = feature_counts.get(feature, 0) + 1
        
        return dict(sorted(feature_counts.items(), key=lambda x: x[1], reverse=True))

    @staticmethod
    def get_screen_view_stats(
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
    ) -> Dict[str, int]:
        """Get screen view statistics."""
        sessions = db.get_sessions_by_filter(start_time=start_time, end_time=end_time)
        
        screen_counts: Dict[str, int] = {}
        for session in sessions:
            for screen in session.get("screens_viewed", []):
                screen_counts[screen] = screen_counts.get(screen, 0) + 1
        
        return dict(sorted(screen_counts.items(), key=lambda x: x[1], reverse=True))
