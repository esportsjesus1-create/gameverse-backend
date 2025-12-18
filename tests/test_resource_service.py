import pytest
from app.services import ResourceService
from app.models import (
    ResourceCreate,
    ResourceUsageCreate,
    ResourceType,
    CloudProvider,
)


class TestResourceService:
    @pytest.fixture
    def service(self):
        return ResourceService()

    @pytest.fixture
    def sample_resource(self):
        return ResourceCreate(
            name="test-server",
            resource_type=ResourceType.COMPUTE,
            provider=CloudProvider.AWS,
            region="us-east-1",
            tags={"env": "test"},
            project_id="project-1",
            team_id="team-1",
            unit_cost=0.10,
            unit="hour",
        )

    def test_create_resource(self, service, sample_resource):
        resource = service.create_resource(sample_resource)
        assert resource.id is not None
        assert resource.name == "test-server"
        assert resource.resource_type == ResourceType.COMPUTE
        assert resource.provider == CloudProvider.AWS

    def test_get_resource(self, service, sample_resource):
        created = service.create_resource(sample_resource)
        retrieved = service.get_resource(created.id)
        assert retrieved is not None
        assert retrieved.id == created.id
        assert retrieved.name == created.name

    def test_get_nonexistent_resource(self, service):
        result = service.get_resource("nonexistent")
        assert result is None

    def test_get_resources_no_filter(self, service, sample_resource):
        service.create_resource(sample_resource)
        resources = service.get_resources()
        assert len(resources) == 1

    def test_get_resources_by_provider(self, service):
        service.create_resource(
            ResourceCreate(
                name="aws-server",
                resource_type=ResourceType.COMPUTE,
                provider=CloudProvider.AWS,
                region="us-east-1",
                unit_cost=0.10,
            )
        )
        service.create_resource(
            ResourceCreate(
                name="gcp-server",
                resource_type=ResourceType.COMPUTE,
                provider=CloudProvider.GCP,
                region="us-central1",
                unit_cost=0.12,
            )
        )

        aws_resources = service.get_resources(provider=CloudProvider.AWS)
        assert len(aws_resources) == 1
        assert aws_resources[0].name == "aws-server"

    def test_get_resources_by_type(self, service):
        service.create_resource(
            ResourceCreate(
                name="compute-server",
                resource_type=ResourceType.COMPUTE,
                provider=CloudProvider.AWS,
                region="us-east-1",
                unit_cost=0.10,
            )
        )
        service.create_resource(
            ResourceCreate(
                name="storage-bucket",
                resource_type=ResourceType.STORAGE,
                provider=CloudProvider.AWS,
                region="us-east-1",
                unit_cost=0.05,
            )
        )

        compute_resources = service.get_resources(resource_type=ResourceType.COMPUTE)
        assert len(compute_resources) == 1
        assert compute_resources[0].name == "compute-server"

    def test_get_resources_by_project(self, service):
        service.create_resource(
            ResourceCreate(
                name="project1-server",
                resource_type=ResourceType.COMPUTE,
                provider=CloudProvider.AWS,
                region="us-east-1",
                project_id="project-1",
                unit_cost=0.10,
            )
        )
        service.create_resource(
            ResourceCreate(
                name="project2-server",
                resource_type=ResourceType.COMPUTE,
                provider=CloudProvider.AWS,
                region="us-east-1",
                project_id="project-2",
                unit_cost=0.10,
            )
        )

        project1_resources = service.get_resources(project_id="project-1")
        assert len(project1_resources) == 1
        assert project1_resources[0].name == "project1-server"

    def test_update_resource(self, service, sample_resource):
        created = service.create_resource(sample_resource)
        updated = service.update_resource(created.id, {"name": "updated-server"})
        assert updated is not None
        assert updated.name == "updated-server"

    def test_update_nonexistent_resource(self, service):
        result = service.update_resource("nonexistent", {"name": "test"})
        assert result is None

    def test_delete_resource(self, service, sample_resource):
        created = service.create_resource(sample_resource)
        result = service.delete_resource(created.id)
        assert result is True
        assert service.get_resource(created.id) is None

    def test_delete_nonexistent_resource(self, service):
        result = service.delete_resource("nonexistent")
        assert result is False

    def test_record_usage(self, service, sample_resource):
        resource = service.create_resource(sample_resource)
        usage = service.record_usage(
            ResourceUsageCreate(
                resource_id=resource.id,
                usage_value=10.0,
            )
        )
        assert usage is not None
        assert usage.resource_id == resource.id
        assert usage.usage_value == 10.0
        assert usage.cost == 1.0

    def test_record_usage_nonexistent_resource(self, service):
        result = service.record_usage(
            ResourceUsageCreate(
                resource_id="nonexistent",
                usage_value=10.0,
            )
        )
        assert result is None

    def test_get_usage(self, service, sample_resource):
        resource = service.create_resource(sample_resource)
        service.record_usage(
            ResourceUsageCreate(resource_id=resource.id, usage_value=10.0)
        )
        service.record_usage(
            ResourceUsageCreate(resource_id=resource.id, usage_value=20.0)
        )

        usage = service.get_usage(resource_id=resource.id)
        assert len(usage) == 2

    def test_get_total_cost(self, service, sample_resource):
        resource = service.create_resource(sample_resource)
        service.record_usage(
            ResourceUsageCreate(resource_id=resource.id, usage_value=10.0)
        )
        service.record_usage(
            ResourceUsageCreate(resource_id=resource.id, usage_value=20.0)
        )

        total = service.get_total_cost(resource_id=resource.id)
        assert total == 3.0

    def test_get_usage_summary(self, service, sample_resource):
        resource = service.create_resource(sample_resource)
        service.record_usage(
            ResourceUsageCreate(resource_id=resource.id, usage_value=10.0)
        )
        service.record_usage(
            ResourceUsageCreate(resource_id=resource.id, usage_value=20.0)
        )

        summary = service.get_usage_summary(resource_id=resource.id)
        assert summary["total_usage"] == 30.0
        assert summary["total_cost"] == 3.0
        assert summary["record_count"] == 2
        assert summary["average_usage"] == 15.0
        assert summary["average_cost"] == 1.5

    def test_get_usage_summary_empty(self, service):
        summary = service.get_usage_summary()
        assert summary["total_usage"] == 0
        assert summary["total_cost"] == 0
        assert summary["record_count"] == 0
