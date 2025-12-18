import uuid
from datetime import datetime, timedelta
from typing import Optional
import numpy as np
from app.database import get_database
from app.models import (
    Recommendation,
    RecommendationType,
    RecommendationPriority,
    OptimizationSummary,
)
from app.services.resource_service import ResourceService


class RecommendationService:
    def __init__(self):
        self.db = get_database()
        self.resource_service = ResourceService()

    def generate_recommendations(
        self,
        resource_id: Optional[str] = None,
        project_id: Optional[str] = None,
        team_id: Optional[str] = None,
    ) -> list[Recommendation]:
        recommendations = []

        recommendations.extend(
            self._check_idle_resources(resource_id, project_id, team_id)
        )
        recommendations.extend(
            self._check_right_sizing(resource_id, project_id, team_id)
        )
        recommendations.extend(
            self._check_reserved_instances(resource_id, project_id, team_id)
        )
        recommendations.extend(
            self._check_scheduling_opportunities(resource_id, project_id, team_id)
        )

        stored_recommendations = []
        for rec in recommendations:
            data = rec.model_dump()
            del data["id"]
            del data["created_at"]
            result = self.db.recommendations.create(data)
            stored_recommendations.append(Recommendation(**result))

        return stored_recommendations

    def _check_idle_resources(
        self,
        resource_id: Optional[str],
        project_id: Optional[str],
        team_id: Optional[str],
    ) -> list[Recommendation]:
        recommendations = []
        resources = self.resource_service.get_resources(
            project_id=project_id, team_id=team_id, is_active=True
        )

        if resource_id:
            resources = [r for r in resources if r.id == resource_id]

        end_time = datetime.utcnow()
        start_time = end_time - timedelta(days=7)

        for resource in resources:
            usage = self.resource_service.get_usage(
                resource_id=resource.id,
                start_time=start_time,
                end_time=end_time,
            )

            if not usage:
                current_cost = resource.unit_cost * 24 * 7
                recommendations.append(
                    Recommendation(
                        id=str(uuid.uuid4()),
                        resource_id=resource.id,
                        project_id=resource.project_id,
                        team_id=resource.team_id,
                        recommendation_type=RecommendationType.IDLE_RESOURCE,
                        priority=RecommendationPriority.HIGH,
                        title=f"Idle Resource Detected: {resource.name}",
                        description=f"Resource '{resource.name}' has had no usage in the past 7 days. "
                        f"Consider terminating or downsizing this resource.",
                        current_cost=current_cost,
                        projected_savings=current_cost,
                        savings_percentage=100.0,
                        implementation_effort="Low",
                        risk_level="Low",
                        created_at=datetime.utcnow(),
                        expires_at=datetime.utcnow() + timedelta(days=30),
                    )
                )
            elif len(usage) < 10:
                total_cost = sum(u.cost for u in usage)
                avg_usage = np.mean([u.usage_value for u in usage])
                if avg_usage < 0.1:
                    recommendations.append(
                        Recommendation(
                            id=str(uuid.uuid4()),
                            resource_id=resource.id,
                            project_id=resource.project_id,
                            team_id=resource.team_id,
                            recommendation_type=RecommendationType.IDLE_RESOURCE,
                            priority=RecommendationPriority.MEDIUM,
                            title=f"Low Utilization: {resource.name}",
                            description=f"Resource '{resource.name}' has very low utilization "
                            f"(avg: {avg_usage:.2%}). Consider downsizing or consolidating.",
                            current_cost=total_cost,
                            projected_savings=total_cost * 0.5,
                            savings_percentage=50.0,
                            implementation_effort="Medium",
                            risk_level="Low",
                            created_at=datetime.utcnow(),
                            expires_at=datetime.utcnow() + timedelta(days=30),
                        )
                    )

        return recommendations

    def _check_right_sizing(
        self,
        resource_id: Optional[str],
        project_id: Optional[str],
        team_id: Optional[str],
    ) -> list[Recommendation]:
        recommendations = []
        resources = self.resource_service.get_resources(
            project_id=project_id, team_id=team_id, is_active=True
        )

        if resource_id:
            resources = [r for r in resources if r.id == resource_id]

        end_time = datetime.utcnow()
        start_time = end_time - timedelta(days=30)

        for resource in resources:
            usage = self.resource_service.get_usage(
                resource_id=resource.id,
                start_time=start_time,
                end_time=end_time,
            )

            if len(usage) < 20:
                continue

            usage_values = [u.usage_value for u in usage]
            max_usage = np.max(usage_values)
            p95_usage = np.percentile(usage_values, 95)

            if p95_usage < 0.5 and max_usage < 0.7:
                total_cost = sum(u.cost for u in usage)
                potential_savings = total_cost * (1 - p95_usage - 0.1)

                recommendations.append(
                    Recommendation(
                        id=str(uuid.uuid4()),
                        resource_id=resource.id,
                        project_id=resource.project_id,
                        team_id=resource.team_id,
                        recommendation_type=RecommendationType.RIGHT_SIZING,
                        priority=RecommendationPriority.MEDIUM,
                        title=f"Right-size Opportunity: {resource.name}",
                        description=f"Resource '{resource.name}' is over-provisioned. "
                        f"P95 usage is {p95_usage:.1%}, max is {max_usage:.1%}. "
                        f"Consider downsizing to a smaller instance type.",
                        current_cost=total_cost,
                        projected_savings=potential_savings,
                        savings_percentage=(potential_savings / total_cost * 100)
                        if total_cost > 0
                        else 0,
                        implementation_effort="Medium",
                        risk_level="Medium",
                        created_at=datetime.utcnow(),
                        expires_at=datetime.utcnow() + timedelta(days=30),
                    )
                )

        return recommendations

    def _check_reserved_instances(
        self,
        resource_id: Optional[str],
        project_id: Optional[str],
        team_id: Optional[str],
    ) -> list[Recommendation]:
        recommendations = []
        resources = self.resource_service.get_resources(
            project_id=project_id, team_id=team_id, is_active=True
        )

        if resource_id:
            resources = [r for r in resources if r.id == resource_id]

        end_time = datetime.utcnow()
        start_time = end_time - timedelta(days=90)

        for resource in resources:
            usage = self.resource_service.get_usage(
                resource_id=resource.id,
                start_time=start_time,
                end_time=end_time,
            )

            if len(usage) < 60:
                continue

            usage_values = [u.usage_value for u in usage]
            avg_usage = np.mean(usage_values)
            std_usage = np.std(usage_values)
            cv = std_usage / avg_usage if avg_usage > 0 else float("inf")

            if cv < 0.3 and avg_usage > 0.5:
                total_cost = sum(u.cost for u in usage)
                reserved_savings = total_cost * 0.3

                recommendations.append(
                    Recommendation(
                        id=str(uuid.uuid4()),
                        resource_id=resource.id,
                        project_id=resource.project_id,
                        team_id=resource.team_id,
                        recommendation_type=RecommendationType.RESERVED_INSTANCE,
                        priority=RecommendationPriority.HIGH,
                        title=f"Reserved Instance Opportunity: {resource.name}",
                        description=f"Resource '{resource.name}' has consistent usage "
                        f"(CV: {cv:.2f}, avg: {avg_usage:.1%}). "
                        f"Consider purchasing reserved capacity for ~30% savings.",
                        current_cost=total_cost,
                        projected_savings=reserved_savings,
                        savings_percentage=30.0,
                        implementation_effort="Low",
                        risk_level="Low",
                        created_at=datetime.utcnow(),
                        expires_at=datetime.utcnow() + timedelta(days=30),
                    )
                )

        return recommendations

    def _check_scheduling_opportunities(
        self,
        resource_id: Optional[str],
        project_id: Optional[str],
        team_id: Optional[str],
    ) -> list[Recommendation]:
        recommendations = []
        resources = self.resource_service.get_resources(
            project_id=project_id, team_id=team_id, is_active=True
        )

        if resource_id:
            resources = [r for r in resources if r.id == resource_id]

        end_time = datetime.utcnow()
        start_time = end_time - timedelta(days=14)

        for resource in resources:
            usage = self.resource_service.get_usage(
                resource_id=resource.id,
                start_time=start_time,
                end_time=end_time,
            )

            if len(usage) < 50:
                continue

            hourly_usage: dict[int, list[float]] = {}
            for u in usage:
                hour = u.timestamp.hour
                if hour not in hourly_usage:
                    hourly_usage[hour] = []
                hourly_usage[hour].append(u.usage_value)

            if len(hourly_usage) < 12:
                continue

            hourly_avg = {h: np.mean(vals) for h, vals in hourly_usage.items()}
            low_hours = [h for h, avg in hourly_avg.items() if avg < 0.1]

            if len(low_hours) >= 8:
                total_cost = sum(u.cost for u in usage)
                potential_savings = total_cost * (len(low_hours) / 24) * 0.8

                recommendations.append(
                    Recommendation(
                        id=str(uuid.uuid4()),
                        resource_id=resource.id,
                        project_id=resource.project_id,
                        team_id=resource.team_id,
                        recommendation_type=RecommendationType.SCHEDULING,
                        priority=RecommendationPriority.MEDIUM,
                        title=f"Scheduling Opportunity: {resource.name}",
                        description=f"Resource '{resource.name}' has {len(low_hours)} hours/day "
                        f"with very low usage. Consider implementing auto-scaling or "
                        f"scheduled shutdown during off-peak hours.",
                        current_cost=total_cost,
                        projected_savings=potential_savings,
                        savings_percentage=(potential_savings / total_cost * 100)
                        if total_cost > 0
                        else 0,
                        implementation_effort="Medium",
                        risk_level="Medium",
                        created_at=datetime.utcnow(),
                        expires_at=datetime.utcnow() + timedelta(days=30),
                    )
                )

        return recommendations

    def get_recommendations(
        self,
        resource_id: Optional[str] = None,
        project_id: Optional[str] = None,
        team_id: Optional[str] = None,
        recommendation_type: Optional[RecommendationType] = None,
        priority: Optional[RecommendationPriority] = None,
        is_implemented: Optional[bool] = None,
    ) -> list[Recommendation]:
        filters = {}
        if resource_id:
            filters["resource_id"] = resource_id
        if project_id:
            filters["project_id"] = project_id
        if team_id:
            filters["team_id"] = team_id
        if recommendation_type:
            filters["recommendation_type"] = recommendation_type.value
        if priority:
            filters["priority"] = priority.value
        if is_implemented is not None:
            filters["is_implemented"] = is_implemented

        results = self.db.recommendations.get_all(filters if filters else None)
        return [Recommendation(**r) for r in results]

    def implement_recommendation(
        self, recommendation_id: str, actual_savings: Optional[float] = None
    ) -> Optional[Recommendation]:
        result = self.db.recommendations.update(
            recommendation_id,
            {
                "is_implemented": True,
                "implemented_at": datetime.utcnow(),
                "actual_savings": actual_savings,
            },
        )
        if result:
            return Recommendation(**result)
        return None

    def get_optimization_summary(
        self,
        project_id: Optional[str] = None,
        team_id: Optional[str] = None,
    ) -> OptimizationSummary:
        recommendations = self.get_recommendations(
            project_id=project_id, team_id=team_id
        )

        by_type: dict[str, int] = {}
        by_priority: dict[str, int] = {}
        total_potential_savings = 0.0
        implemented_count = 0
        realized_savings = 0.0

        for rec in recommendations:
            type_key = rec.recommendation_type.value
            by_type[type_key] = by_type.get(type_key, 0) + 1

            priority_key = rec.priority.value
            by_priority[priority_key] = by_priority.get(priority_key, 0) + 1

            total_potential_savings += rec.projected_savings

            if rec.is_implemented:
                implemented_count += 1
                if rec.actual_savings:
                    realized_savings += rec.actual_savings

        implementation_rate = (
            implemented_count / len(recommendations) if recommendations else 0
        )

        top_recommendations = sorted(
            [r for r in recommendations if not r.is_implemented],
            key=lambda x: x.projected_savings,
            reverse=True,
        )[:5]

        return OptimizationSummary(
            total_recommendations=len(recommendations),
            total_potential_savings=total_potential_savings,
            by_type=by_type,
            by_priority=by_priority,
            top_recommendations=top_recommendations,
            implementation_rate=implementation_rate,
            realized_savings=realized_savings,
        )
