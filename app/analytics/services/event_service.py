from typing import List, Optional, Dict, Any
from datetime import datetime
from ..models.event import Event, EventCreate
from .database import db


class EventService:
    """Service for event tracking and management."""

    @staticmethod
    def track_event(event_data: EventCreate) -> Event:
        event = Event(**event_data.model_dump())
        event_dict = event.model_dump()
        event_dict["timestamp"] = event_dict["timestamp"].isoformat()
        db.add_event(event.id, event_dict)
        
        player = db.get_player(event.player_id)
        if player:
            db.update_player(event.player_id, {
                "last_active": datetime.utcnow().isoformat()
            })
        
        return event

    @staticmethod
    def get_event(event_id: str) -> Optional[Event]:
        event_data = db.get_event(event_id)
        if event_data:
            return Event(**event_data)
        return None

    @staticmethod
    def get_events(
        player_id: Optional[str] = None,
        event_type: Optional[str] = None,
        event_name: Optional[str] = None,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        session_id: Optional[str] = None,
        skip: int = 0,
        limit: int = 100,
    ) -> List[Event]:
        events = db.get_events_by_filter(
            player_id=player_id,
            event_type=event_type,
            event_name=event_name,
            start_time=start_time,
            end_time=end_time,
            session_id=session_id,
        )
        return [Event(**e) for e in events[skip : skip + limit]]

    @staticmethod
    def get_event_counts_by_type(
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
    ) -> Dict[str, int]:
        events = db.get_events_by_filter(start_time=start_time, end_time=end_time)
        counts: Dict[str, int] = {}
        for event in events:
            event_type = event.get("event_type", "unknown")
            counts[event_type] = counts.get(event_type, 0) + 1
        return counts

    @staticmethod
    def get_event_timeline(
        player_id: Optional[str] = None,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        granularity: str = "hour",
    ) -> List[Dict[str, Any]]:
        events = db.get_events_by_filter(
            player_id=player_id, start_time=start_time, end_time=end_time
        )
        
        timeline: Dict[str, int] = {}
        for event in events:
            timestamp = datetime.fromisoformat(event.get("timestamp"))
            if granularity == "hour":
                key = timestamp.strftime("%Y-%m-%d %H:00")
            elif granularity == "day":
                key = timestamp.strftime("%Y-%m-%d")
            elif granularity == "week":
                key = timestamp.strftime("%Y-W%W")
            else:
                key = timestamp.strftime("%Y-%m")
            timeline[key] = timeline.get(key, 0) + 1
        
        return [
            {"timestamp": k, "count": v}
            for k, v in sorted(timeline.items())
        ]

    @staticmethod
    def batch_track_events(events_data: List[EventCreate]) -> List[Event]:
        tracked_events = []
        for event_data in events_data:
            event = EventService.track_event(event_data)
            tracked_events.append(event)
        return tracked_events

    @staticmethod
    def get_popular_events(
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        limit: int = 10,
    ) -> List[Dict[str, Any]]:
        events = db.get_events_by_filter(start_time=start_time, end_time=end_time)
        
        event_counts: Dict[str, Dict[str, Any]] = {}
        for event in events:
            key = f"{event.get('event_type')}:{event.get('event_name')}"
            if key not in event_counts:
                event_counts[key] = {
                    "event_type": event.get("event_type"),
                    "event_name": event.get("event_name"),
                    "count": 0,
                    "unique_players": set(),
                }
            event_counts[key]["count"] += 1
            event_counts[key]["unique_players"].add(event.get("player_id"))
        
        result = []
        for key, data in event_counts.items():
            result.append({
                "event_type": data["event_type"],
                "event_name": data["event_name"],
                "total_count": data["count"],
                "unique_players": len(data["unique_players"]),
            })
        
        result.sort(key=lambda x: x["total_count"], reverse=True)
        return result[:limit]
