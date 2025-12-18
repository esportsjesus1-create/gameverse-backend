"""Automated flagging and decisioning for fraud detection."""

from collections import defaultdict
from datetime import datetime, timedelta
from typing import Any, Optional
from uuid import uuid4

from ..models.schemas import (
    FlagAction,
    FlagDecision,
    FraudScore,
    RiskLevel,
)


class FlagStore:
    """
    In-memory store for fraud flags.
    
    Provides storage and retrieval of flag decisions with
    expiration support.
    """
    
    def __init__(self):
        """Initialize the flag store."""
        self._flags: dict[str, FlagDecision] = {}
        self._entity_flags: dict[str, list[str]] = defaultdict(list)
        self._active_blocks: dict[str, FlagDecision] = {}
    
    def add_flag(self, flag: FlagDecision) -> None:
        """
        Add a flag to the store.
        
        Args:
            flag: Flag decision to store
        """
        self._flags[flag.flag_id] = flag
        self._entity_flags[flag.entity_id].append(flag.flag_id)
        
        if flag.action in (FlagAction.BLOCK, FlagAction.SUSPEND):
            self._active_blocks[flag.entity_id] = flag
    
    def get_flag(self, flag_id: str) -> Optional[FlagDecision]:
        """Get a flag by ID."""
        return self._flags.get(flag_id)
    
    def get_entity_flags(
        self,
        entity_id: str,
        include_expired: bool = False,
    ) -> list[FlagDecision]:
        """
        Get all flags for an entity.
        
        Args:
            entity_id: Entity identifier
            include_expired: Whether to include expired flags
            
        Returns:
            List of flag decisions
        """
        flag_ids = self._entity_flags.get(entity_id, [])
        flags = [self._flags[fid] for fid in flag_ids if fid in self._flags]
        
        if not include_expired:
            now = datetime.utcnow()
            flags = [
                f for f in flags
                if f.expires_at is None or f.expires_at > now
            ]
        
        return flags
    
    def is_blocked(self, entity_id: str) -> bool:
        """
        Check if an entity is currently blocked.
        
        Args:
            entity_id: Entity identifier
            
        Returns:
            True if entity is blocked
        """
        block = self._active_blocks.get(entity_id)
        if block is None:
            return False
        
        # Check expiration
        if block.expires_at and block.expires_at <= datetime.utcnow():
            del self._active_blocks[entity_id]
            return False
        
        return True
    
    def remove_block(self, entity_id: str) -> bool:
        """
        Remove active block for an entity.
        
        Args:
            entity_id: Entity identifier
            
        Returns:
            True if block was removed
        """
        if entity_id in self._active_blocks:
            del self._active_blocks[entity_id]
            return True
        return False
    
    def get_active_blocks(self) -> list[FlagDecision]:
        """Get all active blocks."""
        now = datetime.utcnow()
        active = []
        
        expired_entities = []
        for entity_id, flag in self._active_blocks.items():
            if flag.expires_at and flag.expires_at <= now:
                expired_entities.append(entity_id)
            else:
                active.append(flag)
        
        # Clean up expired
        for entity_id in expired_entities:
            del self._active_blocks[entity_id]
        
        return active
    
    def get_flags_by_action(self, action: FlagAction) -> list[FlagDecision]:
        """Get all flags with a specific action."""
        return [f for f in self._flags.values() if f.action == action]
    
    def get_recent_flags(
        self,
        hours: int = 24,
        limit: int = 100,
    ) -> list[FlagDecision]:
        """Get recent flags within time window."""
        cutoff = datetime.utcnow() - timedelta(hours=hours)
        recent = [
            f for f in self._flags.values()
            if f.timestamp >= cutoff
        ]
        recent.sort(key=lambda f: f.timestamp, reverse=True)
        return recent[:limit]
    
    def clear_expired(self) -> int:
        """
        Clear all expired flags.
        
        Returns:
            Number of flags cleared
        """
        now = datetime.utcnow()
        expired_ids = [
            fid for fid, flag in self._flags.items()
            if flag.expires_at and flag.expires_at <= now
        ]
        
        for fid in expired_ids:
            flag = self._flags.pop(fid)
            if flag.entity_id in self._entity_flags:
                self._entity_flags[flag.entity_id].remove(fid)
        
        return len(expired_ids)
    
    def get_statistics(self) -> dict[str, Any]:
        """Get flag store statistics."""
        action_counts = defaultdict(int)
        risk_counts = defaultdict(int)
        
        for flag in self._flags.values():
            action_counts[flag.action.value] += 1
            risk_counts[flag.risk_level.value] += 1
        
        return {
            "total_flags": len(self._flags),
            "active_blocks": len(self._active_blocks),
            "unique_entities": len(self._entity_flags),
            "by_action": dict(action_counts),
            "by_risk_level": dict(risk_counts),
        }


class AutomatedFlagger:
    """
    Automated flagging system for fraud decisions.
    
    Converts fraud scores into actionable flag decisions
    with configurable thresholds and rules.
    """
    
    # Default action thresholds
    DEFAULT_THRESHOLDS = {
        FlagAction.ALLOW: 0.0,
        FlagAction.REVIEW: 0.4,
        FlagAction.BLOCK: 0.75,
        FlagAction.SUSPEND: 0.9,
    }
    
    # Default expiration times (in hours)
    DEFAULT_EXPIRATIONS = {
        FlagAction.ALLOW: None,
        FlagAction.REVIEW: 24,
        FlagAction.BLOCK: 72,
        FlagAction.SUSPEND: 168,  # 1 week
    }
    
    def __init__(
        self,
        flag_store: Optional[FlagStore] = None,
        thresholds: Optional[dict[FlagAction, float]] = None,
        expirations: Optional[dict[FlagAction, Optional[int]]] = None,
    ):
        """
        Initialize the automated flagger.
        
        Args:
            flag_store: Store for flag decisions
            thresholds: Custom action thresholds
            expirations: Custom expiration times (hours)
        """
        self.flag_store = flag_store or FlagStore()
        self.thresholds = thresholds or self.DEFAULT_THRESHOLDS.copy()
        self.expirations = expirations or self.DEFAULT_EXPIRATIONS.copy()
        
        # Custom rules for specific detectors
        self._detector_rules: dict[str, dict[str, Any]] = {}
        
        # Callback for flag events
        self._callbacks: list[callable] = []
    
    def evaluate(
        self,
        fraud_score: FraudScore,
        auto_flag: bool = True,
    ) -> FlagDecision:
        """
        Evaluate a fraud score and create a flag decision.
        
        Args:
            fraud_score: Fraud score to evaluate
            auto_flag: Whether to automatically store the flag
            
        Returns:
            Flag decision
        """
        # Determine action based on score
        action = self._determine_action(fraud_score)
        
        # Collect reasons from all detectors
        reasons = []
        triggered_detectors = []
        
        for result in fraud_score.detector_results:
            if result.score > 0.3:  # Only include significant detectors
                triggered_detectors.append(result.detector_name)
                reasons.extend(result.reasons)
        
        # Apply detector-specific rules
        action = self._apply_detector_rules(
            action,
            fraud_score.detector_results,
            triggered_detectors
        )
        
        # Calculate expiration
        expires_at = self._calculate_expiration(action)
        
        # Create flag decision
        flag = FlagDecision(
            flag_id=str(uuid4()),
            entity_id=fraud_score.entity_id,
            entity_type=fraud_score.entity_type,
            action=action,
            risk_score=fraud_score.overall_score,
            risk_level=fraud_score.risk_level,
            triggered_detectors=triggered_detectors,
            reasons=reasons[:10],  # Limit reasons
            expires_at=expires_at,
            metadata={
                "fraud_score_metadata": fraud_score.metadata,
                "detector_count": len(fraud_score.detector_results),
            },
        )
        
        # Store flag if auto-flagging is enabled
        if auto_flag:
            self.flag_store.add_flag(flag)
            self._notify_callbacks(flag)
        
        return flag
    
    def _determine_action(self, fraud_score: FraudScore) -> FlagAction:
        """
        Determine action based on fraud score.
        
        Args:
            fraud_score: Fraud score to evaluate
            
        Returns:
            Appropriate flag action
        """
        score = fraud_score.overall_score
        
        if score >= self.thresholds[FlagAction.SUSPEND]:
            return FlagAction.SUSPEND
        elif score >= self.thresholds[FlagAction.BLOCK]:
            return FlagAction.BLOCK
        elif score >= self.thresholds[FlagAction.REVIEW]:
            return FlagAction.REVIEW
        else:
            return FlagAction.ALLOW
    
    def _apply_detector_rules(
        self,
        action: FlagAction,
        detector_results: list,
        triggered_detectors: list[str],
    ) -> FlagAction:
        """
        Apply detector-specific rules to potentially escalate action.
        
        Args:
            action: Initial action
            detector_results: List of detector results
            triggered_detectors: Names of triggered detectors
            
        Returns:
            Potentially escalated action
        """
        for detector_name, rules in self._detector_rules.items():
            if detector_name not in triggered_detectors:
                continue
            
            # Find the detector result
            result = next(
                (r for r in detector_results if r.detector_name == detector_name),
                None
            )
            if result is None:
                continue
            
            # Check escalation rules
            escalate_threshold = rules.get("escalate_threshold", 1.0)
            escalate_to = rules.get("escalate_to")
            
            if result.score >= escalate_threshold and escalate_to:
                escalate_action = FlagAction(escalate_to)
                if self._action_severity(escalate_action) > self._action_severity(action):
                    action = escalate_action
        
        return action
    
    def _action_severity(self, action: FlagAction) -> int:
        """Get severity level of an action."""
        severity = {
            FlagAction.ALLOW: 0,
            FlagAction.REVIEW: 1,
            FlagAction.BLOCK: 2,
            FlagAction.SUSPEND: 3,
        }
        return severity.get(action, 0)
    
    def _calculate_expiration(
        self,
        action: FlagAction,
    ) -> Optional[datetime]:
        """Calculate expiration time for a flag."""
        hours = self.expirations.get(action)
        if hours is None:
            return None
        return datetime.utcnow() + timedelta(hours=hours)
    
    def set_threshold(self, action: FlagAction, threshold: float) -> None:
        """
        Set threshold for an action.
        
        Args:
            action: Action to set threshold for
            threshold: New threshold value (0-1)
        """
        self.thresholds[action] = max(0.0, min(1.0, threshold))
    
    def set_expiration(self, action: FlagAction, hours: Optional[int]) -> None:
        """
        Set expiration time for an action.
        
        Args:
            action: Action to set expiration for
            hours: Expiration time in hours (None for no expiration)
        """
        self.expirations[action] = hours
    
    def add_detector_rule(
        self,
        detector_name: str,
        escalate_threshold: float,
        escalate_to: str,
    ) -> None:
        """
        Add a rule for a specific detector.
        
        Args:
            detector_name: Name of the detector
            escalate_threshold: Score threshold for escalation
            escalate_to: Action to escalate to
        """
        self._detector_rules[detector_name] = {
            "escalate_threshold": escalate_threshold,
            "escalate_to": escalate_to,
        }
    
    def remove_detector_rule(self, detector_name: str) -> bool:
        """Remove a detector rule."""
        if detector_name in self._detector_rules:
            del self._detector_rules[detector_name]
            return True
        return False
    
    def register_callback(self, callback: callable) -> None:
        """
        Register a callback for flag events.
        
        Args:
            callback: Function to call when flags are created
        """
        self._callbacks.append(callback)
    
    def _notify_callbacks(self, flag: FlagDecision) -> None:
        """Notify all registered callbacks."""
        for callback in self._callbacks:
            try:
                callback(flag)
            except Exception:
                pass  # Don't let callback errors affect flagging
    
    def get_thresholds(self) -> dict[FlagAction, float]:
        """Get current thresholds."""
        return self.thresholds.copy()
    
    def get_statistics(self) -> dict[str, Any]:
        """Get flagger statistics."""
        return {
            "thresholds": {k.value: v for k, v in self.thresholds.items()},
            "expirations": {k.value: v for k, v in self.expirations.items()},
            "detector_rules": len(self._detector_rules),
            "callbacks": len(self._callbacks),
            "flag_store": self.flag_store.get_statistics(),
        }


def create_manual_flag(
    entity_id: str,
    action: FlagAction,
    reason: str,
    entity_type: str = "user",
    expires_hours: Optional[int] = None,
) -> FlagDecision:
    """
    Create a manual flag decision.
    
    Args:
        entity_id: Entity identifier
        action: Flag action
        reason: Reason for flagging
        entity_type: Type of entity
        expires_hours: Hours until expiration
        
    Returns:
        Flag decision
    """
    expires_at = None
    if expires_hours:
        expires_at = datetime.utcnow() + timedelta(hours=expires_hours)
    
    return FlagDecision(
        flag_id=str(uuid4()),
        entity_id=entity_id,
        entity_type=entity_type,
        action=action,
        risk_score=1.0 if action in (FlagAction.BLOCK, FlagAction.SUSPEND) else 0.5,
        risk_level=RiskLevel.HIGH if action in (FlagAction.BLOCK, FlagAction.SUSPEND) else RiskLevel.MEDIUM,
        triggered_detectors=["manual"],
        reasons=[reason],
        expires_at=expires_at,
        metadata={"manual": True},
    )
