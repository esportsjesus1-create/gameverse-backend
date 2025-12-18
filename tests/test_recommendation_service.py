import pytest
from datetime import datetime, timedelta
from app.services import RecommendationService, ResourceService
from app.models import (
    ResourceCreate,
    ResourceUsageCreate,
    ResourceType,
    CloudProvider,
    RecommendationType,
    RecommendationPriority,
)


class TestRecommendationService:
    @pytest.fixture
    def service(self):
        return RecommendationService()

    @pytest.fixture
    def resource_service(self):
        return ResourceService()

    @pytest.fixture
    def idle_resource(self, resource_service):
        resource = resource_service.create_resource(
            ResourceCreate(
                name="idle-server",
                resource_type=ResourceType.COMPUTE,
                provider=CloudProvider.AWS,
                region="us-east-1",
                project_id="project-1",
                team_id="team-1",
                unit_cost=0.10,
            )
        )
        return resource

    @pytest.fixture
    def active_resource(self, resource_service):
        resource = resource_service.create_resource(
            ResourceCreate(
                name="active-server",
                resource_type=ResourceType.COMPUTE,
                provider=CloudProvider.AWS,
                region="us-east-1",
                project_id="project-1",
                team_id="team-1",
                unit_cost=0.10,
            )
        )

        base_time = datetime.utcnow() - timedelta(days=90)
        for i in range(100):
            resource_service.record_usage(
                ResourceUsageCreate(
                    resource_id=resource.id,
                    usage_value=0.7 + (i % 10) * 0.02,
                    timestamp=base_time + timedelta(hours=i * 20),
                )
            )

        return resource

    def test_generate_recommendations_idle(self, service, idle_resource):
        recommendations = service.generate_recommendations(
            project_id="project-1"
        )
        assert len(recommendations) >= 1
        assert any(
            r.recommendation_type == RecommendationType.IDLE_RESOURCE
            for r in recommendations
        )

    def test_generate_recommendations_by_project(self, service, idle_resource):
        recommendations = service.generate_recommendations(project_id="project-1")
        assert len(recommendations) >= 1

    def test_generate_recommendations_by_team(self, service, idle_resource):
        recommendations = service.generate_recommendations(team_id="team-1")
        assert len(recommendations) >= 1

    def test_get_recommendations(self, service, idle_resource):
        service.generate_recommendations(project_id="project-1")
        recommendations = service.get_recommendations()
        assert len(recommendations) >= 1

    def test_get_recommendations_by_type(self, service, idle_resource):
        service.generate_recommendations(project_id="project-1")
        recommendations = service.get_recommendations(
            recommendation_type=RecommendationType.IDLE_RESOURCE
        )
        assert all(
            r.recommendation_type == RecommendationType.IDLE_RESOURCE
            for r in recommendations
        )

    def test_get_recommendations_by_priority(self, service, idle_resource):
        service.generate_recommendations(project_id="project-1")
        recommendations = service.get_recommendations(
            priority=RecommendationPriority.HIGH
        )
        assert all(r.priority == RecommendationPriority.HIGH for r in recommendations)

    def test_implement_recommendation(self, service, idle_resource):
        recommendations = service.generate_recommendations(
            project_id="project-1"
        )
        if recommendations:
            implemented = service.implement_recommendation(
                recommendations[0].id, actual_savings=50.0
            )
            assert implemented is not None
            assert implemented.is_implemented is True
            assert implemented.actual_savings == 50.0

    def test_implement_nonexistent_recommendation(self, service):
        result = service.implement_recommendation("nonexistent")
        assert result is None

    def test_get_optimization_summary(self, service, idle_resource):
        service.generate_recommendations(project_id="project-1")
        summary = service.get_optimization_summary()
        assert summary.total_recommendations >= 1
        assert summary.total_potential_savings >= 0
        assert isinstance(summary.by_type, dict)
        assert isinstance(summary.by_priority, dict)

    def test_get_optimization_summary_by_project(self, service, idle_resource):
        service.generate_recommendations(project_id="project-1")
        summary = service.get_optimization_summary(project_id="project-1")
        assert summary.total_recommendations >= 0

    def test_check_idle_resources(self, service, idle_resource):
        recommendations = service._check_idle_resources(
            None, "project-1", "team-1"
        )
        assert len(recommendations) >= 1
        assert recommendations[0].recommendation_type == RecommendationType.IDLE_RESOURCE

    def test_check_right_sizing(self, service, resource_service):
        resource = resource_service.create_resource(
            ResourceCreate(
                name="oversized-server",
                resource_type=ResourceType.COMPUTE,
                provider=CloudProvider.AWS,
                region="us-east-1",
                project_id="project-right-size",
                unit_cost=0.10,
            )
        )

        base_time = datetime.utcnow() - timedelta(days=30)
        for i in range(30):
            resource_service.record_usage(
                ResourceUsageCreate(
                    resource_id=resource.id,
                    usage_value=0.2,
                    timestamp=base_time + timedelta(days=i),
                )
            )

        recommendations = service._check_right_sizing(None, "project-right-size", None)
        assert len(recommendations) >= 1
        assert recommendations[0].recommendation_type == RecommendationType.RIGHT_SIZING

    def test_check_reserved_instances(self, service, active_resource):
        recommendations = service._check_reserved_instances(
            active_resource.id, None, None
        )
        if recommendations:
            assert recommendations[0].recommendation_type == RecommendationType.RESERVED_INSTANCE

    def test_check_scheduling_opportunities(self, service, resource_service):
        resource = resource_service.create_resource(
            ResourceCreate(
                name="scheduled-server",
                resource_type=ResourceType.COMPUTE,
                provider=CloudProvider.AWS,
                region="us-east-1",
                unit_cost=0.10,
            )
        )

        base_time = datetime.utcnow() - timedelta(days=14)
        for i in range(200):
            hour = i % 24
            usage_value = 0.8 if 9 <= hour <= 17 else 0.05
            resource_service.record_usage(
                ResourceUsageCreate(
                    resource_id=resource.id,
                    usage_value=usage_value,
                    timestamp=base_time + timedelta(hours=i),
                )
            )

        recommendations = service._check_scheduling_opportunities(
            resource.id, None, None
        )
        if recommendations:
            assert recommendations[0].recommendation_type == RecommendationType.SCHEDULING
