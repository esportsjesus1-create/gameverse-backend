from typing import List, Optional, Dict, Any
from datetime import datetime
from ..models.player import Player, PlayerCreate, PlayerUpdate
from .database import db


class PlayerService:
    """Service for player management and behavior analysis."""

    @staticmethod
    def create_player(player_data: PlayerCreate) -> Player:
        player = Player(**player_data.model_dump())
        player_dict = player.model_dump()
        player_dict["created_at"] = player_dict["created_at"].isoformat()
        player_dict["last_active"] = player_dict["last_active"].isoformat()
        db.add_player(player.id, player_dict)
        return player

    @staticmethod
    def get_player(player_id: str) -> Optional[Player]:
        player_data = db.get_player(player_id)
        if player_data:
            return Player(**player_data)
        return None

    @staticmethod
    def update_player(player_id: str, updates: PlayerUpdate) -> Optional[Player]:
        update_dict = {k: v for k, v in updates.model_dump().items() if v is not None}
        if "last_active" in update_dict and update_dict["last_active"]:
            update_dict["last_active"] = update_dict["last_active"].isoformat()
        updated = db.update_player(player_id, update_dict)
        if updated:
            return Player(**updated)
        return None

    @staticmethod
    def delete_player(player_id: str) -> bool:
        return db.delete_player(player_id)

    @staticmethod
    def get_all_players(
        skip: int = 0, limit: int = 100
    ) -> List[Player]:
        players = db.get_all_players()
        return [Player(**p) for p in players[skip : skip + limit]]

    @staticmethod
    def get_players_by_cohort(
        start_date: datetime, end_date: datetime
    ) -> List[Player]:
        players = db.get_players_by_filter(
            created_after=start_date, created_before=end_date
        )
        return [Player(**p) for p in players]

    @staticmethod
    def get_player_behavior_summary(player_id: str) -> Optional[Dict[str, Any]]:
        player = db.get_player(player_id)
        if not player:
            return None

        events = db.get_events_by_player(player_id)
        sessions = db.get_sessions_by_player(player_id)

        event_types: Dict[str, int] = {}
        for event in events:
            event_type = event.get("event_type", "unknown")
            event_types[event_type] = event_types.get(event_type, 0) + 1

        total_playtime = sum(s.get("duration_minutes", 0) for s in sessions)
        avg_session_duration = total_playtime / len(sessions) if sessions else 0

        features_used: set = set()
        screens_viewed: set = set()
        for session in sessions:
            features_used.update(session.get("features_used", []))
            screens_viewed.update(session.get("screens_viewed", []))

        return {
            "player_id": player_id,
            "total_events": len(events),
            "total_sessions": len(sessions),
            "total_playtime_minutes": total_playtime,
            "average_session_duration": avg_session_duration,
            "event_breakdown": event_types,
            "unique_features_used": list(features_used),
            "unique_screens_viewed": list(screens_viewed),
            "first_seen": player.get("created_at"),
            "last_active": player.get("last_active"),
        }

    @staticmethod
    def get_player_journey(player_id: str) -> List[Dict[str, Any]]:
        events = db.get_events_by_player(player_id)
        sorted_events = sorted(events, key=lambda e: e.get("timestamp", ""))
        
        journey = []
        for event in sorted_events:
            journey.append({
                "timestamp": event.get("timestamp"),
                "event_type": event.get("event_type"),
                "event_name": event.get("event_name"),
                "session_id": event.get("session_id"),
                "properties": event.get("properties"),
            })
        return journey

    @staticmethod
    def get_action_frequency(
        player_id: Optional[str] = None,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
    ) -> Dict[str, int]:
        events = db.get_events_by_filter(
            player_id=player_id, start_time=start_time, end_time=end_time
        )
        
        frequency: Dict[str, int] = {}
        for event in events:
            action = f"{event.get('event_type')}:{event.get('event_name')}"
            frequency[action] = frequency.get(action, 0) + 1
        
        return dict(sorted(frequency.items(), key=lambda x: x[1], reverse=True))

    @staticmethod
    def segment_players() -> Dict[str, List[str]]:
        """Segment players based on engagement and behavior."""
        players = db.get_all_players()
        segments: Dict[str, List[str]] = {
            "whales": [],
            "engaged": [],
            "casual": [],
            "at_risk": [],
            "churned": [],
            "new": [],
        }

        now = datetime.utcnow()
        for player in players:
            player_id = player.get("id")
            created_at = datetime.fromisoformat(player.get("created_at"))
            last_active = datetime.fromisoformat(player.get("last_active"))
            days_since_signup = (now - created_at).days
            days_since_active = (now - last_active).days
            ltv = player.get("lifetime_value", 0)
            engagement = player.get("engagement_score", 0)

            if days_since_signup <= 7:
                segments["new"].append(player_id)
            elif days_since_active > 30:
                segments["churned"].append(player_id)
            elif days_since_active > 14:
                segments["at_risk"].append(player_id)
            elif ltv > 100:
                segments["whales"].append(player_id)
            elif engagement > 0.7:
                segments["engaged"].append(player_id)
            else:
                segments["casual"].append(player_id)

        return segments
