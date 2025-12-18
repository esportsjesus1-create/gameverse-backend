from typing import List, Optional, Dict, Any
from datetime import datetime
from ..models.session import Session, SessionCreate, SessionUpdate
from .database import db


class SessionService:
    """Service for session tracking and management."""

    @staticmethod
    def start_session(session_data: SessionCreate) -> Session:
        session = Session(**session_data.model_dump())
        session_dict = session.model_dump()
        session_dict["start_time"] = session_dict["start_time"].isoformat()
        if session_dict.get("end_time"):
            session_dict["end_time"] = session_dict["end_time"].isoformat()
        db.add_session(session.id, session_dict)
        
        player = db.get_player(session.player_id)
        if player:
            total_sessions = player.get("total_sessions", 0) + 1
            db.update_player(session.player_id, {
                "total_sessions": total_sessions,
                "last_active": datetime.utcnow().isoformat(),
            })
        
        return session

    @staticmethod
    def end_session(session_id: str) -> Optional[Session]:
        session_data = db.get_session(session_id)
        if not session_data:
            return None
        
        end_time = datetime.utcnow()
        start_time = datetime.fromisoformat(session_data["start_time"])
        duration = (end_time - start_time).total_seconds() / 60
        
        updates = {
            "end_time": end_time.isoformat(),
            "duration_minutes": duration,
            "is_active": False,
        }
        
        updated = db.update_session(session_id, updates)
        if updated:
            player = db.get_player(updated["player_id"])
            if player:
                total_playtime = player.get("total_playtime_minutes", 0) + duration
                db.update_player(updated["player_id"], {
                    "total_playtime_minutes": total_playtime,
                })
            return Session(**updated)
        return None

    @staticmethod
    def get_session(session_id: str) -> Optional[Session]:
        session_data = db.get_session(session_id)
        if session_data:
            return Session(**session_data)
        return None

    @staticmethod
    def update_session(
        session_id: str, updates: SessionUpdate
    ) -> Optional[Session]:
        update_dict = {k: v for k, v in updates.model_dump().items() if v is not None}
        if "end_time" in update_dict and update_dict["end_time"]:
            update_dict["end_time"] = update_dict["end_time"].isoformat()
        updated = db.update_session(session_id, update_dict)
        if updated:
            return Session(**updated)
        return None

    @staticmethod
    def get_sessions(
        player_id: Optional[str] = None,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        is_active: Optional[bool] = None,
        skip: int = 0,
        limit: int = 100,
    ) -> List[Session]:
        sessions = db.get_sessions_by_filter(
            player_id=player_id,
            start_time=start_time,
            end_time=end_time,
            is_active=is_active,
        )
        return [Session(**s) for s in sessions[skip : skip + limit]]

    @staticmethod
    def get_session_stats(
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
    ) -> Dict[str, Any]:
        sessions = db.get_sessions_by_filter(
            start_time=start_time, end_time=end_time, is_active=False
        )
        
        if not sessions:
            return {
                "total_sessions": 0,
                "average_duration": 0,
                "median_duration": 0,
                "total_playtime": 0,
                "unique_players": 0,
            }
        
        durations = [s.get("duration_minutes", 0) for s in sessions]
        unique_players = set(s.get("player_id") for s in sessions)
        
        sorted_durations = sorted(durations)
        n = len(sorted_durations)
        median = (
            sorted_durations[n // 2]
            if n % 2 == 1
            else (sorted_durations[n // 2 - 1] + sorted_durations[n // 2]) / 2
        )
        
        return {
            "total_sessions": len(sessions),
            "average_duration": sum(durations) / len(durations),
            "median_duration": median,
            "total_playtime": sum(durations),
            "unique_players": len(unique_players),
            "min_duration": min(durations),
            "max_duration": max(durations),
        }

    @staticmethod
    def get_active_sessions() -> List[Session]:
        sessions = db.get_sessions_by_filter(is_active=True)
        return [Session(**s) for s in sessions]

    @staticmethod
    def add_screen_view(session_id: str, screen_name: str) -> Optional[Session]:
        session_data = db.get_session(session_id)
        if not session_data:
            return None
        
        screens = session_data.get("screens_viewed", [])
        if screen_name not in screens:
            screens.append(screen_name)
        
        updated = db.update_session(session_id, {"screens_viewed": screens})
        if updated:
            return Session(**updated)
        return None

    @staticmethod
    def add_feature_use(session_id: str, feature_name: str) -> Optional[Session]:
        session_data = db.get_session(session_id)
        if not session_data:
            return None
        
        features = session_data.get("features_used", [])
        if feature_name not in features:
            features.append(feature_name)
        
        updated = db.update_session(session_id, {"features_used": features})
        if updated:
            return Session(**updated)
        return None
