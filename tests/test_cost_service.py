import pytest
from datetime import datetime, timedelta
from app.services import CostService, ResourceService
from app.models import (
    CostCenterCreate,
    CostAllocationCreate,
    ResourceCreate,
    ResourceUsageCreate,
    ResourceType,
    CloudProvider,
)


class TestCostService:
    @pytest.fixture
    def service(self):
        return CostService()

    @pytest.fixture
    def resource_service(self):
        return ResourceService()

    @pytest.fixture
    def sample_cost_center(self):
        return CostCenterCreate(
            name="Engineering",
            description="Engineering department costs",
            budget_limit=10000.0,
            tags={"department": "engineering"},
        )

    def test_create_cost_center(self, service, sample_cost_center):
        cost_center = service.create_cost_center(sample_cost_center)
        assert cost_center.id is not None
        assert cost_center.name == "Engineering"
        assert cost_center.total_cost == 0.0
        assert cost_center.is_active is True

    def test_get_cost_center(self, service, sample_cost_center):
        created = service.create_cost_center(sample_cost_center)
        retrieved = service.get_cost_center(created.id)
        assert retrieved is not None
        assert retrieved.id == created.id

    def test_get_nonexistent_cost_center(self, service):
        result = service.get_cost_center("nonexistent")
        assert result is None

    def test_get_cost_centers(self, service, sample_cost_center):
        service.create_cost_center(sample_cost_center)
        cost_centers = service.get_cost_centers()
        assert len(cost_centers) == 1

    def test_get_cost_centers_by_parent(self, service):
        parent = service.create_cost_center(
            CostCenterCreate(name="Parent", description="Parent center")
        )
        service.create_cost_center(
            CostCenterCreate(
                name="Child",
                description="Child center",
                parent_id=parent.id,
            )
        )

        children = service.get_cost_centers(parent_id=parent.id)
        assert len(children) == 1
        assert children[0].name == "Child"

    def test_update_cost_center(self, service, sample_cost_center):
        created = service.create_cost_center(sample_cost_center)
        updated = service.update_cost_center(
            created.id, {"name": "Updated Engineering"}
        )
        assert updated is not None
        assert updated.name == "Updated Engineering"

    def test_update_nonexistent_cost_center(self, service):
        result = service.update_cost_center("nonexistent", {"name": "Test"})
        assert result is None

    def test_delete_cost_center(self, service, sample_cost_center):
        created = service.create_cost_center(sample_cost_center)
        result = service.delete_cost_center(created.id)
        assert result is True
        assert service.get_cost_center(created.id) is None

    def test_delete_nonexistent_cost_center(self, service):
        result = service.delete_cost_center("nonexistent")
        assert result is False

    def test_create_allocation(self, service, resource_service, sample_cost_center):
        cost_center = service.create_cost_center(sample_cost_center)
        resource = resource_service.create_resource(
            ResourceCreate(
                name="test-server",
                resource_type=ResourceType.COMPUTE,
                provider=CloudProvider.AWS,
                region="us-east-1",
                unit_cost=0.10,
            )
        )

        allocation = service.create_allocation(
            CostAllocationCreate(
                resource_id=resource.id,
                cost_center_id=cost_center.id,
                allocation_percentage=100.0,
            )
        )
        assert allocation.id is not None
        assert allocation.resource_id == resource.id
        assert allocation.cost_center_id == cost_center.id

    def test_get_allocation(self, service, resource_service, sample_cost_center):
        cost_center = service.create_cost_center(sample_cost_center)
        resource = resource_service.create_resource(
            ResourceCreate(
                name="test-server",
                resource_type=ResourceType.COMPUTE,
                provider=CloudProvider.AWS,
                region="us-east-1",
                unit_cost=0.10,
            )
        )

        created = service.create_allocation(
            CostAllocationCreate(
                resource_id=resource.id,
                cost_center_id=cost_center.id,
            )
        )
        retrieved = service.get_allocation(created.id)
        assert retrieved is not None
        assert retrieved.id == created.id

    def test_get_nonexistent_allocation(self, service):
        result = service.get_allocation("nonexistent")
        assert result is None

    def test_get_allocations(self, service, resource_service, sample_cost_center):
        cost_center = service.create_cost_center(sample_cost_center)
        resource = resource_service.create_resource(
            ResourceCreate(
                name="test-server",
                resource_type=ResourceType.COMPUTE,
                provider=CloudProvider.AWS,
                region="us-east-1",
                unit_cost=0.10,
            )
        )

        service.create_allocation(
            CostAllocationCreate(
                resource_id=resource.id,
                cost_center_id=cost_center.id,
            )
        )

        allocations = service.get_allocations()
        assert len(allocations) == 1

    def test_get_allocations_by_cost_center(
        self, service, resource_service, sample_cost_center
    ):
        cost_center1 = service.create_cost_center(sample_cost_center)
        cost_center2 = service.create_cost_center(
            CostCenterCreate(name="Marketing", description="Marketing costs")
        )

        resource = resource_service.create_resource(
            ResourceCreate(
                name="test-server",
                resource_type=ResourceType.COMPUTE,
                provider=CloudProvider.AWS,
                region="us-east-1",
                unit_cost=0.10,
            )
        )

        service.create_allocation(
            CostAllocationCreate(
                resource_id=resource.id,
                cost_center_id=cost_center1.id,
                allocation_percentage=60.0,
            )
        )
        service.create_allocation(
            CostAllocationCreate(
                resource_id=resource.id,
                cost_center_id=cost_center2.id,
                allocation_percentage=40.0,
            )
        )

        allocations = service.get_allocations(cost_center_id=cost_center1.id)
        assert len(allocations) == 1

    def test_delete_allocation(self, service, resource_service, sample_cost_center):
        cost_center = service.create_cost_center(sample_cost_center)
        resource = resource_service.create_resource(
            ResourceCreate(
                name="test-server",
                resource_type=ResourceType.COMPUTE,
                provider=CloudProvider.AWS,
                region="us-east-1",
                unit_cost=0.10,
            )
        )

        allocation = service.create_allocation(
            CostAllocationCreate(
                resource_id=resource.id,
                cost_center_id=cost_center.id,
            )
        )
        result = service.delete_allocation(allocation.id)
        assert result is True
        assert service.get_allocation(allocation.id) is None

    def test_generate_cost_report(self, service, resource_service):
        resource = resource_service.create_resource(
            ResourceCreate(
                name="test-server",
                resource_type=ResourceType.COMPUTE,
                provider=CloudProvider.AWS,
                region="us-east-1",
                project_id="project-1",
                team_id="team-1",
                unit_cost=0.10,
            )
        )

        resource_service.record_usage(
            ResourceUsageCreate(resource_id=resource.id, usage_value=100.0)
        )

        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=30)

        report = service.generate_cost_report(start_date, end_date)
        assert report.id is not None
        assert report.total_cost == 10.0
        assert "aws" in report.by_provider
        assert "compute" in report.by_resource_type

    def test_generate_cost_report_by_project(self, service, resource_service):
        resource1 = resource_service.create_resource(
            ResourceCreate(
                name="project1-server",
                resource_type=ResourceType.COMPUTE,
                provider=CloudProvider.AWS,
                region="us-east-1",
                project_id="project-1",
                unit_cost=0.10,
            )
        )
        resource2 = resource_service.create_resource(
            ResourceCreate(
                name="project2-server",
                resource_type=ResourceType.COMPUTE,
                provider=CloudProvider.AWS,
                region="us-east-1",
                project_id="project-2",
                unit_cost=0.10,
            )
        )

        resource_service.record_usage(
            ResourceUsageCreate(resource_id=resource1.id, usage_value=100.0)
        )
        resource_service.record_usage(
            ResourceUsageCreate(resource_id=resource2.id, usage_value=200.0)
        )

        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=30)

        report = service.generate_cost_report(
            start_date, end_date, project_id="project-1"
        )
        assert report.total_cost == 10.0

    def test_get_cost_by_tags(self, service, resource_service):
        resource = resource_service.create_resource(
            ResourceCreate(
                name="tagged-server",
                resource_type=ResourceType.COMPUTE,
                provider=CloudProvider.AWS,
                region="us-east-1",
                tags={"env": "production", "team": "backend"},
                unit_cost=0.10,
            )
        )

        resource_service.record_usage(
            ResourceUsageCreate(resource_id=resource.id, usage_value=100.0)
        )

        costs = service.get_cost_by_tags({"env": "production"})
        assert resource.id in costs
        assert costs[resource.id] == 10.0
