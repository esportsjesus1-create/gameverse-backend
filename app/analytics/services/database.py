from typing import Dict, List, Optional, Any
from datetime import datetime
import threading


class InMemoryDatabase:
    """
    In-memory database for the GameVerse Analytics Module.
    Note: Data will be lost when the application restarts.
    This is a proof of concept implementation.
    """

    def __init__(self):
        self._lock = threading.RLock()
        self._players: Dict[str, Any] = {}
        self._events: Dict[str, Any] = {}
        self._sessions: Dict[str, Any] = {}
        self._experiments: Dict[str, Any] = {}
        self._funnels: Dict[str, Any] = {}
        self._player_events: Dict[str, List[str]] = {}
        self._player_sessions: Dict[str, List[str]] = {}
        self._experiment_assignments: Dict[str, Dict[str, str]] = {}

    def clear(self):
        """Clear all data from the database."""
        with self._lock:
            self._players.clear()
            self._events.clear()
            self._sessions.clear()
            self._experiments.clear()
            self._funnels.clear()
            self._player_events.clear()
            self._player_sessions.clear()
            self._experiment_assignments.clear()

    def add_player(self, player_id: str, player_data: dict) -> dict:
        with self._lock:
            self._players[player_id] = player_data
            self._player_events[player_id] = []
            self._player_sessions[player_id] = []
            return player_data

    def get_player(self, player_id: str) -> Optional[dict]:
        with self._lock:
            return self._players.get(player_id)

    def update_player(self, player_id: str, updates: dict) -> Optional[dict]:
        with self._lock:
            if player_id in self._players:
                self._players[player_id].update(updates)
                return self._players[player_id]
            return None

    def delete_player(self, player_id: str) -> bool:
        with self._lock:
            if player_id in self._players:
                del self._players[player_id]
                self._player_events.pop(player_id, None)
                self._player_sessions.pop(player_id, None)
                return True
            return False

    def get_all_players(self) -> List[dict]:
        with self._lock:
            return list(self._players.values())

    def get_players_by_filter(
        self,
        created_after: Optional[datetime] = None,
        created_before: Optional[datetime] = None,
        country: Optional[str] = None,
        platform: Optional[str] = None,
    ) -> List[dict]:
        with self._lock:
            players = list(self._players.values())
            if created_after:
                players = [
                    p
                    for p in players
                    if datetime.fromisoformat(p["created_at"]) >= created_after
                ]
            if created_before:
                players = [
                    p
                    for p in players
                    if datetime.fromisoformat(p["created_at"]) <= created_before
                ]
            if country:
                players = [p for p in players if p.get("country") == country]
            if platform:
                players = [p for p in players if p.get("platform") == platform]
            return players

    def add_event(self, event_id: str, event_data: dict) -> dict:
        with self._lock:
            self._events[event_id] = event_data
            player_id = event_data.get("player_id")
            if player_id and player_id in self._player_events:
                self._player_events[player_id].append(event_id)
            return event_data

    def get_event(self, event_id: str) -> Optional[dict]:
        with self._lock:
            return self._events.get(event_id)

    def get_all_events(self) -> List[dict]:
        with self._lock:
            return list(self._events.values())

    def get_events_by_player(self, player_id: str) -> List[dict]:
        with self._lock:
            event_ids = self._player_events.get(player_id, [])
            return [self._events[eid] for eid in event_ids if eid in self._events]

    def get_events_by_filter(
        self,
        player_id: Optional[str] = None,
        event_type: Optional[str] = None,
        event_name: Optional[str] = None,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        session_id: Optional[str] = None,
    ) -> List[dict]:
        with self._lock:
            if player_id:
                events = self.get_events_by_player(player_id)
            else:
                events = list(self._events.values())

            if event_type:
                events = [e for e in events if e.get("event_type") == event_type]
            if event_name:
                events = [e for e in events if e.get("event_name") == event_name]
            if session_id:
                events = [e for e in events if e.get("session_id") == session_id]
            if start_time:
                events = [
                    e
                    for e in events
                    if datetime.fromisoformat(e["timestamp"]) >= start_time
                ]
            if end_time:
                events = [
                    e
                    for e in events
                    if datetime.fromisoformat(e["timestamp"]) <= end_time
                ]
            return events

    def add_session(self, session_id: str, session_data: dict) -> dict:
        with self._lock:
            self._sessions[session_id] = session_data
            player_id = session_data.get("player_id")
            if player_id and player_id in self._player_sessions:
                self._player_sessions[player_id].append(session_id)
            return session_data

    def get_session(self, session_id: str) -> Optional[dict]:
        with self._lock:
            return self._sessions.get(session_id)

    def update_session(self, session_id: str, updates: dict) -> Optional[dict]:
        with self._lock:
            if session_id in self._sessions:
                self._sessions[session_id].update(updates)
                return self._sessions[session_id]
            return None

    def get_all_sessions(self) -> List[dict]:
        with self._lock:
            return list(self._sessions.values())

    def get_sessions_by_player(self, player_id: str) -> List[dict]:
        with self._lock:
            session_ids = self._player_sessions.get(player_id, [])
            return [
                self._sessions[sid] for sid in session_ids if sid in self._sessions
            ]

    def get_sessions_by_filter(
        self,
        player_id: Optional[str] = None,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        is_active: Optional[bool] = None,
    ) -> List[dict]:
        with self._lock:
            if player_id:
                sessions = self.get_sessions_by_player(player_id)
            else:
                sessions = list(self._sessions.values())

            if is_active is not None:
                sessions = [s for s in sessions if s.get("is_active") == is_active]
            if start_time:
                sessions = [
                    s
                    for s in sessions
                    if datetime.fromisoformat(s["start_time"]) >= start_time
                ]
            if end_time:
                sessions = [
                    s
                    for s in sessions
                    if datetime.fromisoformat(s["start_time"]) <= end_time
                ]
            return sessions

    def add_experiment(self, experiment_id: str, experiment_data: dict) -> dict:
        with self._lock:
            self._experiments[experiment_id] = experiment_data
            self._experiment_assignments[experiment_id] = {}
            return experiment_data

    def get_experiment(self, experiment_id: str) -> Optional[dict]:
        with self._lock:
            return self._experiments.get(experiment_id)

    def update_experiment(self, experiment_id: str, updates: dict) -> Optional[dict]:
        with self._lock:
            if experiment_id in self._experiments:
                self._experiments[experiment_id].update(updates)
                return self._experiments[experiment_id]
            return None

    def delete_experiment(self, experiment_id: str) -> bool:
        with self._lock:
            if experiment_id in self._experiments:
                del self._experiments[experiment_id]
                self._experiment_assignments.pop(experiment_id, None)
                return True
            return False

    def get_all_experiments(self) -> List[dict]:
        with self._lock:
            return list(self._experiments.values())

    def assign_player_to_variant(
        self, experiment_id: str, player_id: str, variant_id: str
    ) -> bool:
        with self._lock:
            if experiment_id in self._experiment_assignments:
                self._experiment_assignments[experiment_id][player_id] = variant_id
                return True
            return False

    def get_player_variant(
        self, experiment_id: str, player_id: str
    ) -> Optional[str]:
        with self._lock:
            return self._experiment_assignments.get(experiment_id, {}).get(player_id)

    def get_experiment_assignments(self, experiment_id: str) -> Dict[str, str]:
        with self._lock:
            return dict(self._experiment_assignments.get(experiment_id, {}))

    def add_funnel(self, funnel_id: str, funnel_data: dict) -> dict:
        with self._lock:
            self._funnels[funnel_id] = funnel_data
            return funnel_data

    def get_funnel(self, funnel_id: str) -> Optional[dict]:
        with self._lock:
            return self._funnels.get(funnel_id)

    def update_funnel(self, funnel_id: str, updates: dict) -> Optional[dict]:
        with self._lock:
            if funnel_id in self._funnels:
                self._funnels[funnel_id].update(updates)
                return self._funnels[funnel_id]
            return None

    def delete_funnel(self, funnel_id: str) -> bool:
        with self._lock:
            if funnel_id in self._funnels:
                del self._funnels[funnel_id]
                return True
            return False

    def get_all_funnels(self) -> List[dict]:
        with self._lock:
            return list(self._funnels.values())

    def get_player_count(self) -> int:
        with self._lock:
            return len(self._players)

    def get_event_count(self) -> int:
        with self._lock:
            return len(self._events)

    def get_session_count(self) -> int:
        with self._lock:
            return len(self._sessions)


db = InMemoryDatabase()
