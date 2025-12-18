import pytest
from datetime import datetime, timedelta
from app.services import AnomalyService, ResourceService
from app.models import (
    AnomalyConfigCreate,
    ResourceCreate,
    ResourceUsageCreate,
    ResourceType,
    CloudProvider,
    AnomalyType,
    AnomalySeverity,
)


class TestAnomalyService:
    @pytest.fixture
    def service(self):
        return AnomalyService()

    @pytest.fixture
    def resource_service(self):
        return ResourceService()

    @pytest.fixture
    def sample_config(self):
        return AnomalyConfigCreate(
            name="Test Anomaly Config",
            sensitivity=2.0,
            min_data_points=10,
            detection_window_hours=24,
            notification_emails=["admin@example.com"],
        )

    @pytest.fixture
    def resource_with_anomaly(self, resource_service):
        resource = resource_service.create_resource(
            ResourceCreate(
                name="test-server",
                resource_type=ResourceType.COMPUTE,
                provider=CloudProvider.AWS,
                region="us-east-1",
                project_id="project-1",
                unit_cost=0.10,
            )
        )

        base_time = datetime.utcnow() - timedelta(hours=48)
        for i in range(20):
            usage_value = 10.0
            if i == 19:
                usage_value = 100.0
            resource_service.record_usage(
                ResourceUsageCreate(
                    resource_id=resource.id,
                    usage_value=usage_value,
                    timestamp=base_time + timedelta(hours=i * 2),
                )
            )

        return resource

    def test_create_config(self, service, sample_config):
        config = service.create_config(sample_config)
        assert config.id is not None
        assert config.name == "Test Anomaly Config"
        assert config.sensitivity == 2.0

    def test_get_config(self, service, sample_config):
        created = service.create_config(sample_config)
        retrieved = service.get_config(created.id)
        assert retrieved is not None
        assert retrieved.id == created.id

    def test_get_nonexistent_config(self, service):
        result = service.get_config("nonexistent")
        assert result is None

    def test_get_configs(self, service, sample_config):
        service.create_config(sample_config)
        configs = service.get_configs()
        assert len(configs) == 1

    def test_get_configs_by_resource(self, service):
        service.create_config(
            AnomalyConfigCreate(
                name="Config 1",
                resource_id="resource-1",
            )
        )
        service.create_config(
            AnomalyConfigCreate(
                name="Config 2",
                resource_id="resource-2",
            )
        )

        configs = service.get_configs(resource_id="resource-1")
        assert len(configs) == 1
        assert configs[0].name == "Config 1"

    def test_update_config(self, service, sample_config):
        created = service.create_config(sample_config)
        updated = service.update_config(created.id, {"name": "Updated Config"})
        assert updated is not None
        assert updated.name == "Updated Config"

    def test_update_nonexistent_config(self, service):
        result = service.update_config("nonexistent", {"name": "Test"})
        assert result is None

    def test_delete_config(self, service, sample_config):
        created = service.create_config(sample_config)
        result = service.delete_config(created.id)
        assert result is True
        assert service.get_config(created.id) is None

    def test_delete_nonexistent_config(self, service):
        result = service.delete_config("nonexistent")
        assert result is False

    def test_detect_anomalies_no_data(self, service):
        anomalies = service.detect_anomalies(resource_id="nonexistent")
        assert len(anomalies) == 0

    def test_detect_anomalies_with_spike(self, service, resource_with_anomaly):
        config = service.create_config(
            AnomalyConfigCreate(
                name="Test Config",
                resource_id=resource_with_anomaly.id,
                sensitivity=2.0,
                min_data_points=5,
                detection_window_hours=48,
            )
        )

        anomalies = service.detect_anomalies(config_id=config.id)
        assert len(anomalies) >= 1
        assert any(a.anomaly_type == AnomalyType.SPIKE for a in anomalies)

    def test_get_anomalies(self, service, resource_with_anomaly):
        config = service.create_config(
            AnomalyConfigCreate(
                name="Test Config",
                resource_id=resource_with_anomaly.id,
                sensitivity=2.0,
                min_data_points=5,
                detection_window_hours=48,
            )
        )
        service.detect_anomalies(config_id=config.id)

        anomalies = service.get_anomalies()
        assert len(anomalies) >= 1

    def test_get_anomalies_by_type(self, service, resource_with_anomaly):
        config = service.create_config(
            AnomalyConfigCreate(
                name="Test Config",
                resource_id=resource_with_anomaly.id,
                sensitivity=2.0,
                min_data_points=5,
                detection_window_hours=48,
            )
        )
        service.detect_anomalies(config_id=config.id)

        spike_anomalies = service.get_anomalies(anomaly_type=AnomalyType.SPIKE)
        assert all(a.anomaly_type == AnomalyType.SPIKE for a in spike_anomalies)

    def test_resolve_anomaly(self, service, resource_with_anomaly):
        config = service.create_config(
            AnomalyConfigCreate(
                name="Test Config",
                resource_id=resource_with_anomaly.id,
                sensitivity=2.0,
                min_data_points=5,
                detection_window_hours=48,
            )
        )
        anomalies = service.detect_anomalies(config_id=config.id)

        if anomalies:
            resolved = service.resolve_anomaly(
                anomalies[0].id, "Investigated and resolved"
            )
            assert resolved is not None
            assert resolved.is_resolved is True
            assert resolved.resolution_notes == "Investigated and resolved"

    def test_get_anomaly_summary(self, service, resource_with_anomaly):
        config = service.create_config(
            AnomalyConfigCreate(
                name="Test Config",
                resource_id=resource_with_anomaly.id,
                sensitivity=2.0,
                min_data_points=5,
                detection_window_hours=48,
            )
        )
        service.detect_anomalies(config_id=config.id)

        summary = service.get_anomaly_summary()
        assert "total_anomalies" in summary
        assert "unresolved_count" in summary
        assert "by_type" in summary
        assert "by_severity" in summary

    def test_calculate_severity(self, service):
        assert service._calculate_severity(4.0, 2.0) == AnomalySeverity.CRITICAL
        assert service._calculate_severity(3.0, 2.0) == AnomalySeverity.HIGH
        assert service._calculate_severity(2.4, 2.0) == AnomalySeverity.MEDIUM
        assert service._calculate_severity(2.0, 2.0) == AnomalySeverity.LOW
