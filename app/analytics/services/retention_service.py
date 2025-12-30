from typing import List, Dict, Any
from datetime import datetime, timedelta, date
from ..models.metrics import RetentionMetrics, CohortRetention
from .database import db


class RetentionService:
    """Service for retention tracking and analysis."""

    @staticmethod
    def calculate_day_n_retention(cohort_date: date, n: int) -> float:
        """Calculate Day-N retention for a cohort."""
        cohort_start = datetime.combine(cohort_date, datetime.min.time())
        cohort_end = datetime.combine(cohort_date, datetime.max.time())
        
        cohort_players = db.get_players_by_filter(
            created_after=cohort_start, created_before=cohort_end
        )
        cohort_player_ids = set(p.get("id") for p in cohort_players)
        
        if not cohort_player_ids:
            return 0.0
        
        target_date = cohort_date + timedelta(days=n)
        target_start = datetime.combine(target_date, datetime.min.time())
        target_end = datetime.combine(target_date, datetime.max.time())
        
        sessions = db.get_sessions_by_filter(start_time=target_start, end_time=target_end)
        active_on_day_n = set(s.get("player_id") for s in sessions)
        
        retained = cohort_player_ids & active_on_day_n
        return len(retained) / len(cohort_player_ids)

    @staticmethod
    def get_retention_metrics(target_date: date) -> RetentionMetrics:
        """Get comprehensive retention metrics for users who signed up on target_date."""
        return RetentionMetrics(
            date=target_date,
            d1_retention=RetentionService.calculate_day_n_retention(target_date, 1),
            d7_retention=RetentionService.calculate_day_n_retention(target_date, 7),
            d14_retention=RetentionService.calculate_day_n_retention(target_date, 14),
            d30_retention=RetentionService.calculate_day_n_retention(target_date, 30),
            d60_retention=RetentionService.calculate_day_n_retention(target_date, 60),
            d90_retention=RetentionService.calculate_day_n_retention(target_date, 90),
            churned_users=RetentionService.count_churned_users(target_date),
            returned_users=RetentionService.count_returned_users(target_date),
            churn_rate=RetentionService.calculate_churn_rate(target_date),
        )

    @staticmethod
    def get_cohort_retention(cohort_date: date, max_days: int = 30) -> CohortRetention:
        """Get retention curve for a specific cohort."""
        cohort_start = datetime.combine(cohort_date, datetime.min.time())
        cohort_end = datetime.combine(cohort_date, datetime.max.time())
        
        cohort_players = db.get_players_by_filter(
            created_after=cohort_start, created_before=cohort_end
        )
        
        retention_by_day: Dict[int, float] = {}
        for day in range(1, max_days + 1):
            retention_by_day[day] = RetentionService.calculate_day_n_retention(
                cohort_date, day
            )
        
        return CohortRetention(
            cohort_date=cohort_date,
            cohort_size=len(cohort_players),
            retention_by_day=retention_by_day,
        )

    @staticmethod
    def get_cohort_retention_matrix(
        start_date: date, end_date: date, max_days: int = 14
    ) -> List[CohortRetention]:
        """Get retention matrix for multiple cohorts."""
        cohorts = []
        current = start_date
        while current <= end_date:
            cohorts.append(
                RetentionService.get_cohort_retention(current, max_days)
            )
            current += timedelta(days=1)
        return cohorts

    @staticmethod
    def count_churned_users(
        target_date: date, inactivity_days: int = 14
    ) -> int:
        """Count users who haven't been active for inactivity_days."""
        cutoff = datetime.combine(target_date - timedelta(days=inactivity_days), datetime.min.time())
        
        players = db.get_all_players()
        churned = 0
        for player in players:
            last_active = datetime.fromisoformat(player.get("last_active"))
            if last_active < cutoff:
                churned += 1
        return churned

    @staticmethod
    def count_returned_users(target_date: date) -> int:
        """Count users who returned after being inactive for 7+ days."""
        target_start = datetime.combine(target_date, datetime.min.time())
        target_end = datetime.combine(target_date, datetime.max.time())
        
        sessions = db.get_sessions_by_filter(start_time=target_start, end_time=target_end)
        active_today = set(s.get("player_id") for s in sessions)
        
        returned = 0
        for player_id in active_today:
            player = db.get_player(player_id)
            if not player:
                continue
            
            prev_sessions = db.get_sessions_by_player(player_id)
            prev_sessions = [
                s for s in prev_sessions
                if datetime.fromisoformat(s["start_time"]) < target_start
            ]
            
            if prev_sessions:
                last_session = max(
                    prev_sessions,
                    key=lambda s: datetime.fromisoformat(s["start_time"])
                )
                last_active = datetime.fromisoformat(last_session["start_time"])
                days_inactive = (target_start - last_active).days
                if days_inactive >= 7:
                    returned += 1
        
        return returned

    @staticmethod
    def calculate_churn_rate(target_date: date, period_days: int = 30) -> float:
        """Calculate churn rate over a period."""
        period_start = datetime.combine(target_date - timedelta(days=period_days), datetime.min.time())
        period_end = datetime.combine(target_date, datetime.max.time())
        
        sessions_in_period = db.get_sessions_by_filter(
            start_time=period_start, end_time=period_end
        )
        active_in_period = set(s.get("player_id") for s in sessions_in_period)
        
        if not active_in_period:
            return 0.0
        
        churned = RetentionService.count_churned_users(target_date)
        return churned / len(active_in_period) if active_in_period else 0.0

    @staticmethod
    def identify_at_risk_players(inactivity_threshold_days: int = 7) -> List[Dict[str, Any]]:
        """Identify players at risk of churning."""
        now = datetime.utcnow()
        cutoff = now - timedelta(days=inactivity_threshold_days)
        
        players = db.get_all_players()
        at_risk = []
        
        for player in players:
            last_active = datetime.fromisoformat(player.get("last_active"))
            if last_active < cutoff:
                days_inactive = (now - last_active).days
                at_risk.append({
                    "player_id": player.get("id"),
                    "username": player.get("username"),
                    "last_active": player.get("last_active"),
                    "days_inactive": days_inactive,
                    "total_sessions": player.get("total_sessions", 0),
                    "lifetime_value": player.get("lifetime_value", 0),
                })
        
        at_risk.sort(key=lambda x: x["days_inactive"], reverse=True)
        return at_risk
