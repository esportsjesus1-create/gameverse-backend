from datetime import datetime, timedelta
from typing import Optional
import numpy as np
from app.database import get_database
from app.models import (
    Anomaly,
    AnomalyConfig,
    AnomalyConfigCreate,
    AnomalyType,
    AnomalySeverity,
)
from app.services.resource_service import ResourceService


class AnomalyService:
    def __init__(self):
        self.db = get_database()
        self.resource_service = ResourceService()

    def create_config(self, config: AnomalyConfigCreate) -> AnomalyConfig:
        data = config.model_dump()
        result = self.db.anomaly_configs.create(data)
        return AnomalyConfig(**result)

    def get_config(self, config_id: str) -> Optional[AnomalyConfig]:
        result = self.db.anomaly_configs.get(config_id)
        if result:
            return AnomalyConfig(**result)
        return None

    def get_configs(
        self,
        resource_id: Optional[str] = None,
        project_id: Optional[str] = None,
        is_active: Optional[bool] = None,
    ) -> list[AnomalyConfig]:
        filters = {}
        if resource_id:
            filters["resource_id"] = resource_id
        if project_id:
            filters["project_id"] = project_id
        if is_active is not None:
            filters["is_active"] = is_active

        results = self.db.anomaly_configs.get_all(filters if filters else None)
        return [AnomalyConfig(**r) for r in results]

    def update_config(
        self, config_id: str, updates: dict
    ) -> Optional[AnomalyConfig]:
        result = self.db.anomaly_configs.update(config_id, updates)
        if result:
            return AnomalyConfig(**result)
        return None

    def delete_config(self, config_id: str) -> bool:
        return self.db.anomaly_configs.delete(config_id)

    def detect_anomalies(
        self,
        config_id: Optional[str] = None,
        resource_id: Optional[str] = None,
        project_id: Optional[str] = None,
    ) -> list[Anomaly]:
        configs = []
        if config_id:
            config = self.get_config(config_id)
            if config:
                configs = [config]
        else:
            configs = self.get_configs(
                resource_id=resource_id,
                project_id=project_id,
                is_active=True,
            )

        if not configs:
            configs = [
                AnomalyConfig(
                    id="default",
                    name="Default Config",
                    sensitivity=2.0,
                    min_data_points=10,
                    detection_window_hours=24,
                    notification_emails=[],
                    is_active=True,
                    created_at=datetime.utcnow(),
                    updated_at=datetime.utcnow(),
                    resource_id=resource_id,
                    project_id=project_id,
                )
            ]

        all_anomalies = []
        for config in configs:
            anomalies = self._detect_for_config(config)
            all_anomalies.extend(anomalies)

        return all_anomalies

    def _detect_for_config(self, config: AnomalyConfig) -> list[Anomaly]:
        end_time = datetime.utcnow()
        start_time = end_time - timedelta(hours=config.detection_window_hours * 7)

        usage_records = self.resource_service.get_usage(
            resource_id=config.resource_id,
            start_time=start_time,
            end_time=end_time,
        )

        if config.project_id:
            resources = self.resource_service.get_resources(
                project_id=config.project_id
            )
            resource_ids = {r.id for r in resources}
            usage_records = [u for u in usage_records if u.resource_id in resource_ids]

        if len(usage_records) < config.min_data_points:
            return []

        usage_records.sort(key=lambda x: x.timestamp)
        costs = np.array([u.cost for u in usage_records])

        mean = np.mean(costs)
        std = np.std(costs)

        if std == 0:
            return []

        anomalies = []
        recent_window = end_time - timedelta(hours=config.detection_window_hours)

        for usage in usage_records:
            if usage.timestamp < recent_window:
                continue

            z_score = abs(usage.cost - mean) / std

            if z_score >= config.sensitivity:
                deviation_percentage = ((usage.cost - mean) / mean) * 100 if mean > 0 else 0

                if usage.cost > mean:
                    anomaly_type = AnomalyType.SPIKE
                else:
                    anomaly_type = AnomalyType.DROP

                severity = self._calculate_severity(z_score, config.sensitivity)

                anomaly_data = {
                    "config_id": config.id,
                    "resource_id": usage.resource_id,
                    "project_id": config.project_id,
                    "anomaly_type": anomaly_type.value,
                    "severity": severity.value,
                    "detected_at": datetime.utcnow(),
                    "description": f"Detected {anomaly_type.value} in cost: ${usage.cost:.2f} "
                    f"(expected: ${mean:.2f}, deviation: {deviation_percentage:.1f}%)",
                    "expected_value": mean,
                    "actual_value": usage.cost,
                    "deviation_percentage": deviation_percentage,
                    "baseline_mean": mean,
                    "baseline_std": std,
                    "is_resolved": False,
                }

                result = self.db.anomalies.create(anomaly_data)
                anomalies.append(Anomaly(**result))

        return anomalies

    def _calculate_severity(
        self, z_score: float, sensitivity: float
    ) -> AnomalySeverity:
        if z_score >= sensitivity * 2:
            return AnomalySeverity.CRITICAL
        elif z_score >= sensitivity * 1.5:
            return AnomalySeverity.HIGH
        elif z_score >= sensitivity * 1.2:
            return AnomalySeverity.MEDIUM
        else:
            return AnomalySeverity.LOW

    def get_anomalies(
        self,
        resource_id: Optional[str] = None,
        project_id: Optional[str] = None,
        anomaly_type: Optional[AnomalyType] = None,
        severity: Optional[AnomalySeverity] = None,
        is_resolved: Optional[bool] = None,
    ) -> list[Anomaly]:
        filters = {}
        if resource_id:
            filters["resource_id"] = resource_id
        if project_id:
            filters["project_id"] = project_id
        if anomaly_type:
            filters["anomaly_type"] = anomaly_type.value
        if severity:
            filters["severity"] = severity.value
        if is_resolved is not None:
            filters["is_resolved"] = is_resolved

        results = self.db.anomalies.get_all(filters if filters else None)
        return [Anomaly(**r) for r in results]

    def resolve_anomaly(
        self, anomaly_id: str, resolution_notes: Optional[str] = None
    ) -> Optional[Anomaly]:
        result = self.db.anomalies.update(
            anomaly_id,
            {
                "is_resolved": True,
                "resolved_at": datetime.utcnow(),
                "resolution_notes": resolution_notes,
            },
        )
        if result:
            return Anomaly(**result)
        return None

    def get_anomaly_summary(
        self,
        resource_id: Optional[str] = None,
        project_id: Optional[str] = None,
    ) -> dict:
        anomalies = self.get_anomalies(
            resource_id=resource_id,
            project_id=project_id,
        )

        by_type: dict[str, int] = {}
        by_severity: dict[str, int] = {}
        unresolved_count = 0

        for anomaly in anomalies:
            type_key = anomaly.anomaly_type.value
            by_type[type_key] = by_type.get(type_key, 0) + 1

            severity_key = anomaly.severity.value
            by_severity[severity_key] = by_severity.get(severity_key, 0) + 1

            if not anomaly.is_resolved:
                unresolved_count += 1

        return {
            "total_anomalies": len(anomalies),
            "unresolved_count": unresolved_count,
            "by_type": by_type,
            "by_severity": by_severity,
        }
