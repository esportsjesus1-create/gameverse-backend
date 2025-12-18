import uuid
from datetime import datetime
from typing import Optional
from app.database import get_database
from app.models import (
    CostCenter,
    CostCenterCreate,
    CostAllocation,
    CostAllocationCreate,
    CostBreakdown,
    CostReport,
)
from app.services.resource_service import ResourceService


class CostService:
    def __init__(self):
        self.db = get_database()
        self.resource_service = ResourceService()

    def create_cost_center(self, cost_center: CostCenterCreate) -> CostCenter:
        data = cost_center.model_dump()
        data["total_cost"] = 0.0
        data["is_active"] = True
        result = self.db.cost_centers.create(data)
        return CostCenter(**result)

    def get_cost_center(self, cost_center_id: str) -> Optional[CostCenter]:
        result = self.db.cost_centers.get(cost_center_id)
        if result:
            return CostCenter(**result)
        return None

    def get_cost_centers(
        self,
        parent_id: Optional[str] = None,
        is_active: Optional[bool] = None,
    ) -> list[CostCenter]:
        filters = {}
        if parent_id:
            filters["parent_id"] = parent_id
        if is_active is not None:
            filters["is_active"] = is_active

        results = self.db.cost_centers.get_all(filters if filters else None)
        return [CostCenter(**r) for r in results]

    def update_cost_center(
        self, cost_center_id: str, updates: dict
    ) -> Optional[CostCenter]:
        result = self.db.cost_centers.update(cost_center_id, updates)
        if result:
            return CostCenter(**result)
        return None

    def delete_cost_center(self, cost_center_id: str) -> bool:
        return self.db.cost_centers.delete(cost_center_id)

    def create_allocation(self, allocation: CostAllocationCreate) -> CostAllocation:
        data = allocation.model_dump()
        result = self.db.cost_allocations.create(data)
        return CostAllocation(**result)

    def get_allocation(self, allocation_id: str) -> Optional[CostAllocation]:
        result = self.db.cost_allocations.get(allocation_id)
        if result:
            return CostAllocation(**result)
        return None

    def get_allocations(
        self,
        resource_id: Optional[str] = None,
        cost_center_id: Optional[str] = None,
        project_id: Optional[str] = None,
        team_id: Optional[str] = None,
    ) -> list[CostAllocation]:
        filters = {}
        if resource_id:
            filters["resource_id"] = resource_id
        if cost_center_id:
            filters["cost_center_id"] = cost_center_id
        if project_id:
            filters["project_id"] = project_id
        if team_id:
            filters["team_id"] = team_id

        results = self.db.cost_allocations.get_all(filters if filters else None)
        return [CostAllocation(**r) for r in results]

    def delete_allocation(self, allocation_id: str) -> bool:
        return self.db.cost_allocations.delete(allocation_id)

    def generate_cost_report(
        self,
        start_date: datetime,
        end_date: datetime,
        project_id: Optional[str] = None,
        team_id: Optional[str] = None,
    ) -> CostReport:
        resources = self.resource_service.get_resources(
            project_id=project_id, team_id=team_id
        )
        usage_records = self.resource_service.get_usage(
            start_time=start_date, end_time=end_date
        )

        resource_map = {r.id: r for r in resources}
        if project_id or team_id:
            usage_records = [
                u for u in usage_records if u.resource_id in resource_map
            ]

        total_cost = sum(u.cost for u in usage_records)

        by_provider: dict[str, float] = {}
        by_resource_type: dict[str, float] = {}
        by_project: dict[str, float] = {}
        by_team: dict[str, float] = {}

        for usage in usage_records:
            resource = resource_map.get(usage.resource_id)
            if not resource:
                resource = self.resource_service.get_resource(usage.resource_id)
                if resource:
                    resource_map[resource.id] = resource

            if resource:
                provider = resource.provider.value if hasattr(resource.provider, 'value') else resource.provider
                by_provider[provider] = by_provider.get(provider, 0) + usage.cost

                res_type = resource.resource_type.value if hasattr(resource.resource_type, 'value') else resource.resource_type
                by_resource_type[res_type] = by_resource_type.get(res_type, 0) + usage.cost

                if resource.project_id:
                    by_project[resource.project_id] = (
                        by_project.get(resource.project_id, 0) + usage.cost
                    )

                if resource.team_id:
                    by_team[resource.team_id] = (
                        by_team.get(resource.team_id, 0) + usage.cost
                    )

        by_cost_center: dict[str, float] = {}
        allocations = self.get_allocations()
        for allocation in allocations:
            resource_usage = [
                u for u in usage_records if u.resource_id == allocation.resource_id
            ]
            allocated_cost = (
                sum(u.cost for u in resource_usage)
                * allocation.allocation_percentage
                / 100
            )
            by_cost_center[allocation.cost_center_id] = (
                by_cost_center.get(allocation.cost_center_id, 0) + allocated_cost
            )

        breakdowns = []
        for category, amount in by_resource_type.items():
            percentage = (amount / total_cost * 100) if total_cost > 0 else 0
            breakdowns.append(
                CostBreakdown(
                    category=category,
                    amount=amount,
                    percentage=percentage,
                    trend=0.0,
                    resources=[
                        r.id
                        for r in resources
                        if (r.resource_type.value if hasattr(r.resource_type, 'value') else r.resource_type) == category
                    ],
                )
            )

        return CostReport(
            id=str(uuid.uuid4()),
            start_date=start_date,
            end_date=end_date,
            total_cost=total_cost,
            by_provider=by_provider,
            by_resource_type=by_resource_type,
            by_project=by_project,
            by_team=by_team,
            by_cost_center=by_cost_center,
            breakdowns=breakdowns,
            generated_at=datetime.utcnow(),
        )

    def get_cost_by_tags(
        self,
        tags: dict[str, str],
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
    ) -> dict[str, float]:
        resources = self.resource_service.get_resources()

        matching_resources = []
        for resource in resources:
            matches = all(
                resource.tags.get(key) == value for key, value in tags.items()
            )
            if matches:
                matching_resources.append(resource)

        result: dict[str, float] = {}
        for resource in matching_resources:
            usage = self.resource_service.get_usage(
                resource_id=resource.id,
                start_time=start_date,
                end_time=end_date,
            )
            total_cost = sum(u.cost for u in usage)
            result[resource.id] = total_cost

        return result
