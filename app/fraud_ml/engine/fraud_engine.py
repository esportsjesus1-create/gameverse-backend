"""Main fraud detection engine that orchestrates all components."""

from datetime import datetime
from typing import Any, Optional

from ..models.schemas import (
    UserEvent,
    Transaction,
    BehaviorEvent,
    FraudScore,
    FlagDecision,
)
from ..detectors.anomaly_detector import AnomalyDetector
from ..detectors.behavior_detector import BehaviorPatternDetector
from ..detectors.transaction_detector import TransactionMonitor
from ..detectors.bot_detector import BotDetector
from ..detectors.flagging import AutomatedFlagger, FlagStore
from .base import DetectorRegistry
from .feature_extractor import FeatureExtractor
from .scoring_engine import ScoringEngine


class FraudEngine:
    """
    Main fraud detection engine.
    
    Orchestrates feature extraction, detection, scoring, and flagging
    for comprehensive fraud detection.
    """
    
    def __init__(
        self,
        enable_anomaly_detection: bool = True,
        enable_behavior_analysis: bool = True,
        enable_transaction_monitoring: bool = True,
        enable_bot_detection: bool = True,
        enable_auto_flagging: bool = True,
    ):
        """
        Initialize the fraud engine.
        
        Args:
            enable_anomaly_detection: Enable anomaly detector
            enable_behavior_analysis: Enable behavior pattern detector
            enable_transaction_monitoring: Enable transaction monitor
            enable_bot_detection: Enable bot detector
            enable_auto_flagging: Enable automated flagging
        """
        # Initialize components
        self.feature_extractor = FeatureExtractor()
        self.registry = DetectorRegistry()
        self.scoring_engine = ScoringEngine(registry=self.registry)
        self.flag_store = FlagStore()
        self.flagger = AutomatedFlagger(flag_store=self.flag_store)
        
        # Initialize and register detectors
        if enable_anomaly_detection:
            self.anomaly_detector = AnomalyDetector()
            self.registry.register(self.anomaly_detector)
        else:
            self.anomaly_detector = None
        
        if enable_behavior_analysis:
            self.behavior_detector = BehaviorPatternDetector()
            self.registry.register(self.behavior_detector)
        else:
            self.behavior_detector = None
        
        if enable_transaction_monitoring:
            self.transaction_monitor = TransactionMonitor()
            self.registry.register(self.transaction_monitor)
        else:
            self.transaction_monitor = None
        
        if enable_bot_detection:
            self.bot_detector = BotDetector()
            self.registry.register(self.bot_detector)
        else:
            self.bot_detector = None
        
        self.enable_auto_flagging = enable_auto_flagging
        
        # Event/transaction storage (in-memory)
        self._user_events: dict[str, list[UserEvent]] = {}
        self._user_transactions: dict[str, list[Transaction]] = {}
        self._user_behavior: dict[str, list[BehaviorEvent]] = {}
    
    def analyze_user(
        self,
        user_id: str,
        events: Optional[list[UserEvent]] = None,
        transactions: Optional[list[Transaction]] = None,
        behavior_events: Optional[list[BehaviorEvent]] = None,
        reference_time: Optional[datetime] = None,
    ) -> tuple[FraudScore, Optional[FlagDecision]]:
        """
        Perform comprehensive fraud analysis for a user.
        
        Args:
            user_id: User identifier
            events: List of user events (uses stored if None)
            transactions: List of transactions (uses stored if None)
            behavior_events: List of behavior events (uses stored if None)
            reference_time: Reference time for analysis
            
        Returns:
            Tuple of (FraudScore, FlagDecision or None)
        """
        # Use stored data if not provided
        events = events or self._user_events.get(user_id, [])
        transactions = transactions or self._user_transactions.get(user_id, [])
        behavior_events = behavior_events or self._user_behavior.get(user_id, [])
        
        # Extract features
        features = self.feature_extractor.extract_user_features(
            user_id=user_id,
            events=events,
            transactions=transactions,
            behavior_events=behavior_events,
            reference_time=reference_time,
        )
        
        # Run detectors
        detector_results = self.scoring_engine.run_detectors(features)
        
        # Calculate risk score
        fraud_score = self.scoring_engine.calculate_risk_score(
            detector_results=detector_results,
            entity_id=user_id,
            entity_type="user",
        )
        
        # Auto-flag if enabled
        flag_decision = None
        if self.enable_auto_flagging:
            flag_decision = self.flagger.evaluate(fraud_score)
        
        # Update feature extractor baseline
        self.feature_extractor.update_user_baseline(user_id, features)
        
        return fraud_score, flag_decision
    
    def analyze_transaction(
        self,
        transaction: Transaction,
    ) -> tuple[FraudScore, Optional[FlagDecision]]:
        """
        Analyze a single transaction for fraud.
        
        Args:
            transaction: Transaction to analyze
            
        Returns:
            Tuple of (FraudScore, FlagDecision or None)
        """
        user_id = transaction.user_id
        
        # Add to stored transactions
        self.add_transaction(transaction)
        
        # Get user's transaction history
        transactions = self._user_transactions.get(user_id, [])
        
        # Extract features
        features = self.feature_extractor.extract_user_features(
            user_id=user_id,
            events=self._user_events.get(user_id, []),
            transactions=transactions,
            behavior_events=self._user_behavior.get(user_id, []),
            reference_time=transaction.timestamp,
        )
        
        # Add transaction-specific features
        features["current_transaction"] = {
            "amount": transaction.amount,
            "type": transaction.transaction_type.value,
            "payment_method": transaction.payment_method,
        }
        
        # Run detectors
        detector_results = self.scoring_engine.run_detectors(features)
        
        # Calculate risk score
        fraud_score = self.scoring_engine.calculate_risk_score(
            detector_results=detector_results,
            entity_id=transaction.transaction_id,
            entity_type="transaction",
        )
        
        # Check for impossible travel if transaction monitor is enabled
        if self.transaction_monitor and len(transactions) >= 2:
            travel_score, travel_reasons = self.transaction_monitor.check_impossible_travel(
                transactions[-10:]  # Check last 10 transactions
            )
            if travel_score > 0:
                # Adjust score for impossible travel
                fraud_score.overall_score = max(fraud_score.overall_score, travel_score)
                fraud_score.metadata["impossible_travel"] = travel_reasons
        
        # Auto-flag if enabled
        flag_decision = None
        if self.enable_auto_flagging:
            flag_decision = self.flagger.evaluate(fraud_score)
        
        return fraud_score, flag_decision
    
    def analyze_behavior(
        self,
        user_id: str,
        behavior_events: list[BehaviorEvent],
    ) -> tuple[FraudScore, Optional[FlagDecision]]:
        """
        Analyze behavior events for a user.
        
        Args:
            user_id: User identifier
            behavior_events: List of behavior events
            
        Returns:
            Tuple of (FraudScore, FlagDecision or None)
        """
        # Add to stored behavior
        for event in behavior_events:
            self.add_behavior_event(event)
        
        # Extract features
        features = self.feature_extractor.extract_user_features(
            user_id=user_id,
            events=self._user_events.get(user_id, []),
            transactions=self._user_transactions.get(user_id, []),
            behavior_events=self._user_behavior.get(user_id, []),
        )
        
        # Run detectors
        detector_results = self.scoring_engine.run_detectors(features)
        
        # Calculate risk score
        fraud_score = self.scoring_engine.calculate_risk_score(
            detector_results=detector_results,
            entity_id=user_id,
            entity_type="user_behavior",
        )
        
        # Auto-flag if enabled
        flag_decision = None
        if self.enable_auto_flagging:
            flag_decision = self.flagger.evaluate(fraud_score)
        
        return fraud_score, flag_decision
    
    def add_event(self, event: UserEvent) -> None:
        """Add a user event to storage."""
        user_id = event.user_id
        if user_id not in self._user_events:
            self._user_events[user_id] = []
        
        self._user_events[user_id].append(event)
        
        # Keep bounded
        if len(self._user_events[user_id]) > 1000:
            self._user_events[user_id] = self._user_events[user_id][-1000:]
    
    def add_transaction(self, transaction: Transaction) -> None:
        """Add a transaction to storage."""
        user_id = transaction.user_id
        if user_id not in self._user_transactions:
            self._user_transactions[user_id] = []
        
        self._user_transactions[user_id].append(transaction)
        
        # Keep bounded
        if len(self._user_transactions[user_id]) > 1000:
            self._user_transactions[user_id] = self._user_transactions[user_id][-1000:]
        
        # Also add to transaction monitor history
        if self.transaction_monitor:
            self.transaction_monitor.add_transaction_to_history(user_id, transaction)
    
    def add_behavior_event(self, event: BehaviorEvent) -> None:
        """Add a behavior event to storage."""
        user_id = event.user_id
        if user_id not in self._user_behavior:
            self._user_behavior[user_id] = []
        
        self._user_behavior[user_id].append(event)
        
        # Keep bounded
        if len(self._user_behavior[user_id]) > 1000:
            self._user_behavior[user_id] = self._user_behavior[user_id][-1000:]
    
    def is_user_blocked(self, user_id: str) -> bool:
        """Check if a user is currently blocked."""
        return self.flag_store.is_blocked(user_id)
    
    def get_user_flags(self, user_id: str) -> list[FlagDecision]:
        """Get all flags for a user."""
        return self.flag_store.get_entity_flags(user_id)
    
    def get_user_risk_history(
        self,
        user_id: str,
    ) -> dict[str, Any]:
        """
        Get risk history and statistics for a user.
        
        Args:
            user_id: User identifier
            
        Returns:
            Dictionary with risk history and statistics
        """
        events = self._user_events.get(user_id, [])
        transactions = self._user_transactions.get(user_id, [])
        behavior = self._user_behavior.get(user_id, [])
        flags = self.flag_store.get_entity_flags(user_id, include_expired=True)
        
        return {
            "user_id": user_id,
            "event_count": len(events),
            "transaction_count": len(transactions),
            "behavior_event_count": len(behavior),
            "flag_count": len(flags),
            "is_blocked": self.is_user_blocked(user_id),
            "baseline": self.feature_extractor.get_user_baseline(user_id),
            "recent_flags": [
                {
                    "flag_id": f.flag_id,
                    "action": f.action.value,
                    "risk_score": f.risk_score,
                    "timestamp": f.timestamp.isoformat(),
                }
                for f in flags[-5:]
            ],
        }
    
    def get_statistics(self) -> dict[str, Any]:
        """Get engine statistics."""
        return {
            "detectors": {
                "registered": len(self.registry),
                "enabled": len(self.registry.get_enabled()),
                "names": [d.name for d in self.registry.get_all()],
            },
            "storage": {
                "users_with_events": len(self._user_events),
                "users_with_transactions": len(self._user_transactions),
                "users_with_behavior": len(self._user_behavior),
            },
            "flagging": self.flagger.get_statistics(),
            "scoring": {
                "thresholds": {
                    k.value: v for k, v in self.scoring_engine.get_thresholds().items()
                },
            },
        }
    
    def configure_detector(
        self,
        detector_name: str,
        weight: Optional[float] = None,
        enabled: Optional[bool] = None,
    ) -> bool:
        """
        Configure a detector.
        
        Args:
            detector_name: Name of detector to configure
            weight: New weight (optional)
            enabled: Enable/disable (optional)
            
        Returns:
            True if detector was found and configured
        """
        detector = self.registry.get(detector_name)
        if detector is None:
            return False
        
        if weight is not None:
            detector.set_weight(weight)
        
        if enabled is not None:
            if enabled:
                detector.enable()
            else:
                detector.disable()
        
        return True
    
    def clear_user_data(self, user_id: str) -> None:
        """Clear all stored data for a user."""
        self._user_events.pop(user_id, None)
        self._user_transactions.pop(user_id, None)
        self._user_behavior.pop(user_id, None)
