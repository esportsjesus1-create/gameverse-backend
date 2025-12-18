"""Feature extraction for fraud detection."""

from collections import Counter, defaultdict
from datetime import datetime, timedelta
from typing import Any, Optional

import numpy as np

from ..models.schemas import UserEvent, Transaction, BehaviorEvent
from ..utils.statistics import calculate_entropy, calculate_statistics
from ..utils.time_utils import calculate_time_delta


class FeatureExtractor:
    """Extract features from events and transactions for fraud detection."""
    
    def __init__(self):
        """Initialize the feature extractor."""
        self._user_baselines: dict[str, dict[str, Any]] = {}
    
    def extract_user_features(
        self,
        user_id: str,
        events: list[UserEvent],
        transactions: list[Transaction],
        behavior_events: list[BehaviorEvent],
        reference_time: Optional[datetime] = None,
    ) -> dict[str, Any]:
        """
        Extract comprehensive features for a user.
        
        Args:
            user_id: User identifier
            events: List of user events
            transactions: List of transactions
            behavior_events: List of behavior events
            reference_time: Reference time for windowed features
            
        Returns:
            Dictionary of extracted features
        """
        reference_time = reference_time or datetime.utcnow()
        
        features: dict[str, Any] = {
            "user_id": user_id,
            "reference_time": reference_time,
        }
        
        # Event features
        features.update(self._extract_event_features(events, reference_time))
        
        # Transaction features
        features.update(self._extract_transaction_features(transactions, reference_time))
        
        # Behavior features
        features.update(self._extract_behavior_features(behavior_events, reference_time))
        
        # Cross-feature analysis
        features.update(self._extract_cross_features(events, transactions, behavior_events))
        
        return features
    
    def _extract_event_features(
        self,
        events: list[UserEvent],
        reference_time: datetime,
    ) -> dict[str, Any]:
        """Extract features from user events."""
        features: dict[str, Any] = {}
        
        if not events:
            return {
                "event_count_1h": 0,
                "event_count_24h": 0,
                "unique_event_types": 0,
                "event_type_entropy": 0.0,
                "unique_devices": 0,
                "unique_ips": 0,
                "unique_locations": 0,
                "avg_events_per_session": 0.0,
            }
        
        # Time windows
        one_hour_ago = reference_time - timedelta(hours=1)
        one_day_ago = reference_time - timedelta(days=1)
        
        events_1h = [e for e in events if e.timestamp >= one_hour_ago]
        events_24h = [e for e in events if e.timestamp >= one_day_ago]
        
        features["event_count_1h"] = len(events_1h)
        features["event_count_24h"] = len(events_24h)
        
        # Event type distribution
        event_types = [e.event_type.value for e in events_24h]
        type_counts = Counter(event_types)
        features["unique_event_types"] = len(type_counts)
        
        if event_types:
            total = len(event_types)
            probs = [count / total for count in type_counts.values()]
            features["event_type_entropy"] = calculate_entropy(probs)
        else:
            features["event_type_entropy"] = 0.0
        
        # Device/IP/Location diversity
        features["unique_devices"] = len(set(e.device_id for e in events_24h if e.device_id))
        features["unique_ips"] = len(set(e.ip_address for e in events_24h if e.ip_address))
        features["unique_locations"] = len(set(e.geo_location for e in events_24h if e.geo_location))
        
        # Session analysis
        sessions = defaultdict(list)
        for e in events_24h:
            if e.session_id:
                sessions[e.session_id].append(e)
        
        if sessions:
            events_per_session = [len(evts) for evts in sessions.values()]
            features["avg_events_per_session"] = sum(events_per_session) / len(events_per_session)
        else:
            features["avg_events_per_session"] = 0.0
        
        return features
    
    def _extract_transaction_features(
        self,
        transactions: list[Transaction],
        reference_time: datetime,
    ) -> dict[str, Any]:
        """Extract features from transactions."""
        features: dict[str, Any] = {}
        
        if not transactions:
            return {
                "tx_count_1h": 0,
                "tx_count_24h": 0,
                "tx_total_amount_1h": 0.0,
                "tx_total_amount_24h": 0.0,
                "tx_avg_amount": 0.0,
                "tx_max_amount": 0.0,
                "tx_amount_std": 0.0,
                "unique_payment_methods": 0,
                "unique_recipients": 0,
                "tx_velocity_ratio": 0.0,
            }
        
        # Time windows
        one_hour_ago = reference_time - timedelta(hours=1)
        one_day_ago = reference_time - timedelta(days=1)
        
        tx_1h = [t for t in transactions if t.timestamp >= one_hour_ago]
        tx_24h = [t for t in transactions if t.timestamp >= one_day_ago]
        
        features["tx_count_1h"] = len(tx_1h)
        features["tx_count_24h"] = len(tx_24h)
        
        # Amount analysis
        amounts_1h = [t.amount for t in tx_1h]
        amounts_24h = [t.amount for t in tx_24h]
        
        features["tx_total_amount_1h"] = sum(amounts_1h)
        features["tx_total_amount_24h"] = sum(amounts_24h)
        
        if amounts_24h:
            stats = calculate_statistics(amounts_24h)
            features["tx_avg_amount"] = stats["mean"]
            features["tx_max_amount"] = stats["max"]
            features["tx_amount_std"] = stats["std"]
        else:
            features["tx_avg_amount"] = 0.0
            features["tx_max_amount"] = 0.0
            features["tx_amount_std"] = 0.0
        
        # Payment method diversity
        features["unique_payment_methods"] = len(set(
            t.payment_method for t in tx_24h if t.payment_method
        ))
        
        # Recipient diversity (for trades/gifts)
        features["unique_recipients"] = len(set(
            t.recipient_id for t in tx_24h if t.recipient_id
        ))
        
        # Velocity ratio (1h vs 24h)
        if features["tx_count_24h"] > 0:
            expected_1h = features["tx_count_24h"] / 24
            features["tx_velocity_ratio"] = features["tx_count_1h"] / max(expected_1h, 0.1)
        else:
            features["tx_velocity_ratio"] = 0.0
        
        return features
    
    def _extract_behavior_features(
        self,
        behavior_events: list[BehaviorEvent],
        reference_time: datetime,
    ) -> dict[str, Any]:
        """Extract features from behavior events."""
        features: dict[str, Any] = {}
        
        if not behavior_events:
            return {
                "behavior_count_1h": 0,
                "action_entropy": 0.0,
                "avg_action_duration_ms": 0.0,
                "action_duration_variance": 0.0,
                "inter_action_time_mean": 0.0,
                "inter_action_time_variance": 0.0,
                "unique_actions": 0,
                "action_burstiness": 0.0,
            }
        
        # Time window
        one_hour_ago = reference_time - timedelta(hours=1)
        recent_events = [e for e in behavior_events if e.timestamp >= one_hour_ago]
        
        features["behavior_count_1h"] = len(recent_events)
        
        # Action distribution
        actions = [e.action for e in recent_events]
        action_counts = Counter(actions)
        features["unique_actions"] = len(action_counts)
        
        if actions:
            total = len(actions)
            probs = [count / total for count in action_counts.values()]
            features["action_entropy"] = calculate_entropy(probs)
        else:
            features["action_entropy"] = 0.0
        
        # Duration analysis
        durations = [e.duration_ms for e in recent_events if e.duration_ms is not None]
        if durations:
            stats = calculate_statistics(durations)
            features["avg_action_duration_ms"] = stats["mean"]
            features["action_duration_variance"] = stats["std"] ** 2
        else:
            features["avg_action_duration_ms"] = 0.0
            features["action_duration_variance"] = 0.0
        
        # Inter-action timing
        if len(recent_events) >= 2:
            sorted_events = sorted(recent_events, key=lambda e: e.timestamp)
            inter_times = []
            for i in range(1, len(sorted_events)):
                delta = calculate_time_delta(
                    sorted_events[i-1].timestamp,
                    sorted_events[i].timestamp,
                    unit="seconds"
                )
                inter_times.append(delta)
            
            if inter_times:
                stats = calculate_statistics(inter_times)
                features["inter_action_time_mean"] = stats["mean"]
                features["inter_action_time_variance"] = stats["std"] ** 2
                
                # Burstiness: coefficient of variation
                if stats["mean"] > 0:
                    features["action_burstiness"] = stats["std"] / stats["mean"]
                else:
                    features["action_burstiness"] = 0.0
            else:
                features["inter_action_time_mean"] = 0.0
                features["inter_action_time_variance"] = 0.0
                features["action_burstiness"] = 0.0
        else:
            features["inter_action_time_mean"] = 0.0
            features["inter_action_time_variance"] = 0.0
            features["action_burstiness"] = 0.0
        
        return features
    
    def _extract_cross_features(
        self,
        events: list[UserEvent],
        transactions: list[Transaction],
        behavior_events: list[BehaviorEvent],
    ) -> dict[str, Any]:
        """Extract cross-feature relationships."""
        features: dict[str, Any] = {}
        
        # Event-to-transaction ratio
        if transactions:
            features["event_to_tx_ratio"] = len(events) / len(transactions)
        else:
            features["event_to_tx_ratio"] = float(len(events)) if events else 0.0
        
        # Behavior-to-event ratio
        if events:
            features["behavior_to_event_ratio"] = len(behavior_events) / len(events)
        else:
            features["behavior_to_event_ratio"] = float(len(behavior_events)) if behavior_events else 0.0
        
        # Device consistency across all event types
        all_devices = set()
        for e in events:
            if e.device_id:
                all_devices.add(e.device_id)
        for t in transactions:
            if t.device_id:
                all_devices.add(t.device_id)
        
        features["total_unique_devices"] = len(all_devices)
        
        # IP consistency
        all_ips = set()
        for e in events:
            if e.ip_address:
                all_ips.add(e.ip_address)
        for t in transactions:
            if t.ip_address:
                all_ips.add(t.ip_address)
        
        features["total_unique_ips"] = len(all_ips)
        
        return features
    
    def update_user_baseline(
        self,
        user_id: str,
        features: dict[str, Any],
        alpha: float = 0.1,
    ) -> None:
        """
        Update user baseline with exponential moving average.
        
        Args:
            user_id: User identifier
            features: Current features
            alpha: Smoothing factor (0-1, higher = more weight to recent)
        """
        if user_id not in self._user_baselines:
            self._user_baselines[user_id] = {}
        
        baseline = self._user_baselines[user_id]
        
        for key, value in features.items():
            if isinstance(value, (int, float)) and key not in ("user_id", "reference_time"):
                if key in baseline:
                    baseline[key] = alpha * value + (1 - alpha) * baseline[key]
                else:
                    baseline[key] = value
    
    def get_user_baseline(self, user_id: str) -> dict[str, Any]:
        """Get baseline features for a user."""
        return self._user_baselines.get(user_id, {})
    
    def calculate_deviation_from_baseline(
        self,
        user_id: str,
        features: dict[str, Any],
    ) -> dict[str, float]:
        """
        Calculate how much current features deviate from user baseline.
        
        Args:
            user_id: User identifier
            features: Current features
            
        Returns:
            Dictionary of deviation scores for each feature
        """
        baseline = self.get_user_baseline(user_id)
        deviations: dict[str, float] = {}
        
        for key, value in features.items():
            if isinstance(value, (int, float)) and key in baseline:
                baseline_val = baseline[key]
                if baseline_val != 0:
                    deviations[key] = abs(value - baseline_val) / abs(baseline_val)
                elif value != 0:
                    deviations[key] = 1.0  # Complete deviation from zero baseline
                else:
                    deviations[key] = 0.0
        
        return deviations
