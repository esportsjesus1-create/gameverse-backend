from datetime import datetime
from typing import Optional
from app.database import get_database
from app.models import (
    Resource,
    ResourceCreate,
    ResourceUsage,
    ResourceUsageCreate,
    ResourceType,
    CloudProvider,
)


class ResourceService:
    def __init__(self):
        self.db = get_database()

    def create_resource(self, resource: ResourceCreate) -> Resource:
        data = resource.model_dump()
        data["is_active"] = True
        result = self.db.resources.create(data)
        return Resource(**result)

    def get_resource(self, resource_id: str) -> Optional[Resource]:
        result = self.db.resources.get(resource_id)
        if result:
            return Resource(**result)
        return None

    def get_resources(
        self,
        provider: Optional[CloudProvider] = None,
        resource_type: Optional[ResourceType] = None,
        project_id: Optional[str] = None,
        team_id: Optional[str] = None,
        is_active: Optional[bool] = None,
    ) -> list[Resource]:
        filters = {}
        if provider:
            filters["provider"] = provider.value
        if resource_type:
            filters["resource_type"] = resource_type.value
        if project_id:
            filters["project_id"] = project_id
        if team_id:
            filters["team_id"] = team_id
        if is_active is not None:
            filters["is_active"] = is_active

        results = self.db.resources.get_all(filters if filters else None)
        return [Resource(**r) for r in results]

    def update_resource(
        self, resource_id: str, updates: dict
    ) -> Optional[Resource]:
        result = self.db.resources.update(resource_id, updates)
        if result:
            return Resource(**result)
        return None

    def delete_resource(self, resource_id: str) -> bool:
        return self.db.resources.delete(resource_id)

    def record_usage(self, usage: ResourceUsageCreate) -> Optional[ResourceUsage]:
        resource = self.get_resource(usage.resource_id)
        if not resource:
            return None

        data = usage.model_dump()
        if data["timestamp"] is None:
            data["timestamp"] = datetime.utcnow()
        data["cost"] = usage.usage_value * resource.unit_cost

        result = self.db.resource_usage.create(data)
        return ResourceUsage(**result)

    def get_usage(
        self,
        resource_id: Optional[str] = None,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
    ) -> list[ResourceUsage]:
        filters = {}
        if resource_id:
            filters["resource_id"] = resource_id

        results = self.db.resource_usage.get_all(filters if filters else None)

        if start_time:
            results = [r for r in results if r["timestamp"] >= start_time]
        if end_time:
            results = [r for r in results if r["timestamp"] <= end_time]

        return [ResourceUsage(**r) for r in results]

    def get_total_cost(
        self,
        resource_id: Optional[str] = None,
        project_id: Optional[str] = None,
        team_id: Optional[str] = None,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
    ) -> float:
        usage_records = self.get_usage(resource_id, start_time, end_time)

        if project_id or team_id:
            resource_ids = set()
            resources = self.get_resources(project_id=project_id, team_id=team_id)
            resource_ids = {r.id for r in resources}
            usage_records = [u for u in usage_records if u.resource_id in resource_ids]

        return sum(u.cost for u in usage_records)

    def get_usage_summary(
        self,
        resource_id: Optional[str] = None,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
    ) -> dict:
        usage_records = self.get_usage(resource_id, start_time, end_time)

        if not usage_records:
            return {
                "total_usage": 0,
                "total_cost": 0,
                "record_count": 0,
                "average_usage": 0,
                "average_cost": 0,
            }

        total_usage = sum(u.usage_value for u in usage_records)
        total_cost = sum(u.cost for u in usage_records)
        count = len(usage_records)

        return {
            "total_usage": total_usage,
            "total_cost": total_cost,
            "record_count": count,
            "average_usage": total_usage / count,
            "average_cost": total_cost / count,
        }
