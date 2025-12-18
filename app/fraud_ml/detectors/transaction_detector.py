"""Transaction monitoring for fraud detection."""

from collections import defaultdict
from datetime import datetime, timedelta
from typing import Any, Optional

import numpy as np

from ..engine.base import BaseDetector
from ..models.schemas import DetectorResult, Transaction
from ..utils.statistics import calculate_statistics
from ..utils.time_utils import is_impossible_travel, calculate_time_delta


class TransactionMonitor(BaseDetector):
    """
    Monitors transactions for fraudulent patterns.
    
    Implements:
    - Velocity checks (transaction rate limits)
    - Amount anomaly detection
    - Geographic impossibility detection
    - Payment method risk assessment
    - Recipient pattern analysis
    """
    
    # Velocity thresholds
    MAX_TX_PER_MINUTE = 5
    MAX_TX_PER_HOUR = 50
    MAX_TX_PER_DAY = 200
    
    # Amount thresholds
    HIGH_AMOUNT_MULTIPLIER = 5.0  # Times average
    SUSPICIOUS_AMOUNT_THRESHOLD = 1000.0
    
    # Risk weights for payment methods
    PAYMENT_METHOD_RISK = {
        "credit_card": 0.2,
        "debit_card": 0.3,
        "paypal": 0.2,
        "crypto": 0.6,
        "gift_card": 0.7,
        "prepaid": 0.5,
        "bank_transfer": 0.3,
        "unknown": 0.5,
    }
    
    def __init__(
        self,
        name: str = "transaction_monitor",
        weight: float = 1.5,  # Higher weight for financial fraud
        enabled: bool = True,
    ):
        """
        Initialize the transaction monitor.
        
        Args:
            name: Detector name
            weight: Weight in ensemble scoring
            enabled: Whether detector is active
        """
        super().__init__(name, weight, enabled)
        
        # User transaction history
        self._user_tx_history: dict[str, list[dict[str, Any]]] = defaultdict(list)
        
        # Global transaction statistics
        self._global_stats: dict[str, float] = {}
        self._tx_count = 0
    
    def detect(self, features: dict[str, Any]) -> DetectorResult:
        """
        Detect suspicious transaction patterns.
        
        Args:
            features: Dictionary of extracted features
            
        Returns:
            DetectorResult with transaction risk score and reasons
        """
        reasons = []
        scores = []
        
        # Velocity check
        velocity_score, velocity_reasons = self._check_velocity(features)
        if velocity_score > 0:
            scores.append(velocity_score)
            reasons.extend(velocity_reasons)
        
        # Amount anomaly check
        amount_score, amount_reasons = self._check_amount_anomaly(features)
        if amount_score > 0:
            scores.append(amount_score)
            reasons.extend(amount_reasons)
        
        # Payment method risk
        payment_score, payment_reasons = self._check_payment_method_risk(features)
        if payment_score > 0:
            scores.append(payment_score)
            reasons.extend(payment_reasons)
        
        # Device/IP diversity check
        diversity_score, diversity_reasons = self._check_device_diversity(features)
        if diversity_score > 0:
            scores.append(diversity_score)
            reasons.extend(diversity_reasons)
        
        # Geographic check
        geo_score, geo_reasons = self._check_geographic_patterns(features)
        if geo_score > 0:
            scores.append(geo_score)
            reasons.extend(geo_reasons)
        
        # Calculate overall score (weighted average with emphasis on high scores)
        if scores:
            # Use RMS to emphasize higher scores
            overall_score = np.sqrt(np.mean(np.array(scores) ** 2))
        else:
            overall_score = 0.0
        
        # Calculate confidence
        confidence = self._calculate_confidence(features)
        
        # Update statistics
        self._update_statistics(features)
        
        return DetectorResult(
            detector_name=self.name,
            score=min(1.0, overall_score),
            confidence=confidence,
            reasons=reasons,
            metadata={
                "velocity_score": velocity_score,
                "amount_score": amount_score,
                "payment_score": payment_score,
                "diversity_score": diversity_score,
                "geo_score": geo_score,
            },
        )
    
    def _check_velocity(
        self,
        features: dict[str, Any],
    ) -> tuple[float, list[str]]:
        """
        Check transaction velocity against thresholds.
        """
        reasons = []
        score = 0.0
        
        tx_count_1h = features.get("tx_count_1h", 0)
        tx_count_24h = features.get("tx_count_24h", 0)
        velocity_ratio = features.get("tx_velocity_ratio", 0)
        
        # Check hourly velocity
        if tx_count_1h > self.MAX_TX_PER_HOUR:
            hourly_score = min(1.0, tx_count_1h / (self.MAX_TX_PER_HOUR * 2))
            score = max(score, hourly_score)
            reasons.append(
                f"High transaction velocity: {tx_count_1h} transactions in 1 hour "
                f"(threshold: {self.MAX_TX_PER_HOUR})"
            )
        
        # Check daily velocity
        if tx_count_24h > self.MAX_TX_PER_DAY:
            daily_score = min(1.0, tx_count_24h / (self.MAX_TX_PER_DAY * 2))
            score = max(score, daily_score)
            reasons.append(
                f"High daily transaction count: {tx_count_24h} transactions "
                f"(threshold: {self.MAX_TX_PER_DAY})"
            )
        
        # Check velocity ratio (burst detection)
        if velocity_ratio > 3.0:  # 3x expected rate
            ratio_score = min(1.0, velocity_ratio / 6.0)
            score = max(score, ratio_score)
            reasons.append(
                f"Transaction burst detected: {velocity_ratio:.1f}x expected rate"
            )
        
        return score, reasons
    
    def _check_amount_anomaly(
        self,
        features: dict[str, Any],
    ) -> tuple[float, list[str]]:
        """
        Check for anomalous transaction amounts.
        """
        reasons = []
        score = 0.0
        
        total_amount_1h = features.get("tx_total_amount_1h", 0)
        total_amount_24h = features.get("tx_total_amount_24h", 0)
        avg_amount = features.get("tx_avg_amount", 0)
        max_amount = features.get("tx_max_amount", 0)
        amount_std = features.get("tx_amount_std", 0)
        
        # Check for high total amount in short period
        if total_amount_1h > self.SUSPICIOUS_AMOUNT_THRESHOLD:
            amount_score = min(1.0, total_amount_1h / (self.SUSPICIOUS_AMOUNT_THRESHOLD * 5))
            score = max(score, amount_score)
            reasons.append(
                f"High transaction volume: ${total_amount_1h:.2f} in 1 hour"
            )
        
        # Check for unusually large single transaction
        global_avg = self._global_stats.get("avg_amount", avg_amount)
        if global_avg > 0 and max_amount > global_avg * self.HIGH_AMOUNT_MULTIPLIER:
            max_score = min(1.0, max_amount / (global_avg * self.HIGH_AMOUNT_MULTIPLIER * 2))
            score = max(score, max_score)
            reasons.append(
                f"Unusually large transaction: ${max_amount:.2f} "
                f"(average: ${global_avg:.2f})"
            )
        
        # Check for high variance (mixed small and large transactions)
        if avg_amount > 0 and amount_std > avg_amount * 2:
            variance_score = 0.4
            score = max(score, variance_score)
            reasons.append(
                f"High amount variance: std=${amount_std:.2f}, avg=${avg_amount:.2f}"
            )
        
        return score, reasons
    
    def _check_payment_method_risk(
        self,
        features: dict[str, Any],
    ) -> tuple[float, list[str]]:
        """
        Assess risk based on payment methods used.
        """
        reasons = []
        score = 0.0
        
        unique_payment_methods = features.get("unique_payment_methods", 0)
        
        # Multiple payment methods in short time is suspicious
        if unique_payment_methods > 3:
            method_score = min(1.0, unique_payment_methods / 6)
            score = max(score, method_score)
            reasons.append(
                f"Multiple payment methods used: {unique_payment_methods} different methods"
            )
        
        return score, reasons
    
    def _check_device_diversity(
        self,
        features: dict[str, Any],
    ) -> tuple[float, list[str]]:
        """
        Check for suspicious device/IP diversity patterns.
        """
        reasons = []
        score = 0.0
        
        unique_devices = features.get("total_unique_devices", 0)
        unique_ips = features.get("total_unique_ips", 0)
        tx_count_24h = features.get("tx_count_24h", 0)
        
        # Many devices for transactions is suspicious
        if unique_devices > 5:
            device_score = min(1.0, unique_devices / 10)
            score = max(score, device_score)
            reasons.append(
                f"Transactions from many devices: {unique_devices} unique devices"
            )
        
        # Many IPs for transactions is suspicious
        if unique_ips > 10:
            ip_score = min(1.0, unique_ips / 20)
            score = max(score, ip_score)
            reasons.append(
                f"Transactions from many IPs: {unique_ips} unique IP addresses"
            )
        
        # High device-to-transaction ratio
        if tx_count_24h > 0 and unique_devices > 0:
            ratio = unique_devices / tx_count_24h
            if ratio > 0.5:  # More than 1 device per 2 transactions
                ratio_score = min(1.0, ratio)
                score = max(score, ratio_score)
                reasons.append(
                    f"High device switching: {ratio:.2f} devices per transaction"
                )
        
        return score, reasons
    
    def _check_geographic_patterns(
        self,
        features: dict[str, Any],
    ) -> tuple[float, list[str]]:
        """
        Check for impossible travel or suspicious geographic patterns.
        """
        reasons = []
        score = 0.0
        
        unique_locations = features.get("unique_locations", 0)
        
        # Many locations in short time is suspicious
        if unique_locations > 3:
            location_score = min(1.0, unique_locations / 6)
            score = max(score, location_score)
            reasons.append(
                f"Transactions from many locations: {unique_locations} unique locations"
            )
        
        return score, reasons
    
    def check_impossible_travel(
        self,
        transactions: list[Transaction],
    ) -> tuple[float, list[str]]:
        """
        Check for impossible travel between transaction locations.
        
        Args:
            transactions: List of transactions to check
            
        Returns:
            Tuple of (score, reasons)
        """
        reasons = []
        score = 0.0
        
        if len(transactions) < 2:
            return 0.0, []
        
        # Sort by timestamp
        sorted_tx = sorted(transactions, key=lambda t: t.timestamp)
        
        for i in range(1, len(sorted_tx)):
            prev_tx = sorted_tx[i - 1]
            curr_tx = sorted_tx[i]
            
            if not prev_tx.geo_location or not curr_tx.geo_location:
                continue
            
            time_delta = calculate_time_delta(
                prev_tx.timestamp,
                curr_tx.timestamp,
                unit="hours"
            )
            
            is_impossible, reason = is_impossible_travel(
                prev_tx.geo_location,
                curr_tx.geo_location,
                time_delta
            )
            
            if is_impossible:
                score = 0.95  # Very high score for impossible travel
                reasons.append(
                    f"Impossible travel detected: {prev_tx.geo_location} to "
                    f"{curr_tx.geo_location} in {time_delta:.1f} hours"
                )
                break
        
        return score, reasons
    
    def _calculate_confidence(self, features: dict[str, Any]) -> float:
        """Calculate confidence based on available data."""
        required_features = [
            "tx_count_1h",
            "tx_count_24h",
            "tx_total_amount_1h",
        ]
        
        available = sum(1 for f in required_features if features.get(f) is not None)
        base_confidence = available / len(required_features)
        
        # Higher confidence with more transaction history
        history_confidence = min(1.0, self._tx_count / 100)
        
        return (base_confidence + history_confidence) / 2
    
    def _update_statistics(self, features: dict[str, Any]) -> None:
        """Update global transaction statistics."""
        self._tx_count += 1
        
        avg_amount = features.get("tx_avg_amount", 0)
        if avg_amount > 0:
            if "avg_amount" not in self._global_stats:
                self._global_stats["avg_amount"] = avg_amount
            else:
                # Exponential moving average
                alpha = 0.1
                self._global_stats["avg_amount"] = (
                    alpha * avg_amount + (1 - alpha) * self._global_stats["avg_amount"]
                )
    
    def add_transaction_to_history(
        self,
        user_id: str,
        transaction: Transaction,
    ) -> None:
        """
        Add a transaction to user history.
        
        Args:
            user_id: User identifier
            transaction: Transaction to add
        """
        self._user_tx_history[user_id].append({
            "transaction_id": transaction.transaction_id,
            "amount": transaction.amount,
            "timestamp": transaction.timestamp,
            "payment_method": transaction.payment_method,
            "device_id": transaction.device_id,
            "ip_address": transaction.ip_address,
            "geo_location": transaction.geo_location,
        })
        
        # Keep only recent history (last 1000 transactions)
        if len(self._user_tx_history[user_id]) > 1000:
            self._user_tx_history[user_id] = self._user_tx_history[user_id][-1000:]
    
    def get_user_transaction_history(
        self,
        user_id: str,
        limit: int = 100,
    ) -> list[dict[str, Any]]:
        """Get recent transaction history for a user."""
        history = self._user_tx_history.get(user_id, [])
        return history[-limit:]
