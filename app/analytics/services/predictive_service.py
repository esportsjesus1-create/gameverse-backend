from typing import List, Optional, Dict, Any
from datetime import datetime
import math
from ..models.metrics import PredictiveMetrics
from .database import db


class PredictiveService:
    """Service for predictive modeling and player scoring."""

    @staticmethod
    def calculate_churn_probability(player_id: str) -> float:
        """
        Calculate churn probability based on player behavior.
        Uses a simplified logistic model based on:
        - Days since last active
        - Session frequency
        - Engagement patterns
        """
        player = db.get_player(player_id)
        if not player:
            return 0.0
        
        now = datetime.utcnow()
        last_active = datetime.fromisoformat(player.get("last_active"))
        days_inactive = (now - last_active).days
        
        sessions = db.get_sessions_by_player(player_id)
        total_sessions = len(sessions)
        
        created_at = datetime.fromisoformat(player.get("created_at"))
        days_since_signup = max((now - created_at).days, 1)
        session_frequency = total_sessions / days_since_signup
        
        total_playtime = player.get("total_playtime_minutes", 0)
        avg_session_duration = total_playtime / total_sessions if total_sessions > 0 else 0
        
        inactivity_score = min(days_inactive / 14, 1.0) * 0.4
        frequency_score = max(0, 1 - session_frequency) * 0.3
        duration_score = max(0, 1 - avg_session_duration / 30) * 0.2
        
        recent_sessions = [
            s for s in sessions
            if (now - datetime.fromisoformat(s["start_time"])).days <= 7
        ]
        recency_score = max(0, 1 - len(recent_sessions) / 3) * 0.1
        
        raw_score = inactivity_score + frequency_score + duration_score + recency_score
        churn_prob = 1 / (1 + math.exp(-5 * (raw_score - 0.5)))
        
        return round(churn_prob, 4)

    @staticmethod
    def predict_lifetime_value(player_id: str) -> float:
        """
        Predict player lifetime value based on:
        - Current spending
        - Engagement level
        - Retention probability
        """
        player = db.get_player(player_id)
        if not player:
            return 0.0
        
        current_ltv = player.get("lifetime_value", 0)
        
        churn_prob = PredictiveService.calculate_churn_probability(player_id)
        retention_prob = 1 - churn_prob
        
        events = db.get_events_by_player(player_id)
        purchase_events = [e for e in events if e.get("event_type") == "purchase"]
        total_purchases = sum(e.get("value", 0) for e in purchase_events)
        
        created_at = datetime.fromisoformat(player.get("created_at"))
        days_active = max((datetime.utcnow() - created_at).days, 1)
        
        daily_value = total_purchases / days_active if days_active > 0 else 0
        
        expected_lifetime_days = 365 * retention_prob
        predicted_ltv = current_ltv + (daily_value * expected_lifetime_days)
        
        return round(predicted_ltv, 2)

    @staticmethod
    def calculate_engagement_score(player_id: str) -> float:
        """
        Calculate engagement score (0-1) based on:
        - Session frequency
        - Session duration
        - Feature usage
        - Event diversity
        """
        player = db.get_player(player_id)
        if not player:
            return 0.0
        
        sessions = db.get_sessions_by_player(player_id)
        events = db.get_events_by_player(player_id)
        
        now = datetime.utcnow()
        created_at = datetime.fromisoformat(player.get("created_at"))
        days_since_signup = max((now - created_at).days, 1)
        
        session_frequency = len(sessions) / days_since_signup
        frequency_score = min(session_frequency / 0.5, 1.0) * 0.25
        
        total_playtime = player.get("total_playtime_minutes", 0)
        avg_duration = total_playtime / len(sessions) if sessions else 0
        duration_score = min(avg_duration / 30, 1.0) * 0.25
        
        all_features = set()
        for session in sessions:
            all_features.update(session.get("features_used", []))
        feature_score = min(len(all_features) / 10, 1.0) * 0.25
        
        event_types = set(e.get("event_type") for e in events)
        diversity_score = min(len(event_types) / 8, 1.0) * 0.25
        
        engagement = frequency_score + duration_score + feature_score + diversity_score
        return round(engagement, 4)

    @staticmethod
    def predict_next_session_probability(player_id: str) -> float:
        """Predict probability of player returning within 24 hours."""
        player = db.get_player(player_id)
        if not player:
            return 0.0
        
        sessions = db.get_sessions_by_player(player_id)
        if len(sessions) < 2:
            return 0.3
        
        sorted_sessions = sorted(
            sessions,
            key=lambda s: datetime.fromisoformat(s["start_time"])
        )
        
        gaps = []
        for i in range(1, len(sorted_sessions)):
            prev_time = datetime.fromisoformat(sorted_sessions[i-1]["start_time"])
            curr_time = datetime.fromisoformat(sorted_sessions[i]["start_time"])
            gap_hours = (curr_time - prev_time).total_seconds() / 3600
            gaps.append(gap_hours)
        
        avg_gap = sum(gaps) / len(gaps) if gaps else 48
        
        prob = math.exp(-avg_gap / 24)
        
        now = datetime.utcnow()
        last_active = datetime.fromisoformat(player.get("last_active"))
        hours_since_active = (now - last_active).total_seconds() / 3600
        
        time_decay = math.exp(-hours_since_active / 48)
        
        final_prob = prob * time_decay
        return round(min(final_prob, 1.0), 4)

    @staticmethod
    def get_predictive_metrics(player_id: str) -> Optional[PredictiveMetrics]:
        """Get comprehensive predictive metrics for a player."""
        player = db.get_player(player_id)
        if not player:
            return None
        
        churn_prob = PredictiveService.calculate_churn_probability(player_id)
        predicted_ltv = PredictiveService.predict_lifetime_value(player_id)
        engagement = PredictiveService.calculate_engagement_score(player_id)
        next_session_prob = PredictiveService.predict_next_session_probability(player_id)
        
        recommended_actions = []
        risk_factors = []
        
        if churn_prob > 0.7:
            risk_factors.append("High churn risk - inactive for extended period")
            recommended_actions.append("Send re-engagement notification")
            recommended_actions.append("Offer special promotion")
        elif churn_prob > 0.4:
            risk_factors.append("Moderate churn risk - declining activity")
            recommended_actions.append("Send personalized content recommendation")
        
        if engagement < 0.3:
            risk_factors.append("Low engagement score")
            recommended_actions.append("Introduce new features through tutorial")
        
        if predicted_ltv < 10:
            recommended_actions.append("Target with monetization campaign")
        
        sessions = db.get_sessions_by_player(player_id)
        if len(sessions) < 3:
            risk_factors.append("New player - limited data")
        
        confidence = min(len(sessions) / 10, 1.0)
        
        return PredictiveMetrics(
            player_id=player_id,
            churn_probability=churn_prob,
            predicted_ltv=predicted_ltv,
            engagement_score=engagement,
            next_session_probability=next_session_prob,
            recommended_actions=recommended_actions,
            risk_factors=risk_factors,
            prediction_confidence=round(confidence, 2),
        )

    @staticmethod
    def get_high_value_players(limit: int = 100) -> List[Dict[str, Any]]:
        """Identify high-value players based on predicted LTV."""
        players = db.get_all_players()
        
        player_values = []
        for player in players:
            player_id = player.get("id")
            predicted_ltv = PredictiveService.predict_lifetime_value(player_id)
            engagement = PredictiveService.calculate_engagement_score(player_id)
            
            player_values.append({
                "player_id": player_id,
                "username": player.get("username"),
                "predicted_ltv": predicted_ltv,
                "current_ltv": player.get("lifetime_value", 0),
                "engagement_score": engagement,
            })
        
        player_values.sort(key=lambda x: x["predicted_ltv"], reverse=True)
        return player_values[:limit]

    @staticmethod
    def get_at_risk_high_value_players(
        churn_threshold: float = 0.5,
        ltv_threshold: float = 50,
    ) -> List[Dict[str, Any]]:
        """Identify high-value players at risk of churning."""
        players = db.get_all_players()
        
        at_risk = []
        for player in players:
            player_id = player.get("id")
            current_ltv = player.get("lifetime_value", 0)
            
            if current_ltv < ltv_threshold:
                continue
            
            churn_prob = PredictiveService.calculate_churn_probability(player_id)
            if churn_prob >= churn_threshold:
                at_risk.append({
                    "player_id": player_id,
                    "username": player.get("username"),
                    "current_ltv": current_ltv,
                    "churn_probability": churn_prob,
                    "last_active": player.get("last_active"),
                })
        
        at_risk.sort(key=lambda x: x["current_ltv"], reverse=True)
        return at_risk
