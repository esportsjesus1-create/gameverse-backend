from typing import List, Optional, Dict, Any
from datetime import datetime
from ..models.funnel import Funnel, FunnelCreate, FunnelAnalysis, FunnelStepAnalysis
from .database import db


class FunnelService:
    """Service for funnel analysis."""

    @staticmethod
    def create_funnel(funnel_data: FunnelCreate) -> Funnel:
        funnel = Funnel(
            name=funnel_data.name,
            description=funnel_data.description,
            steps=funnel_data.steps,
        )
        funnel_dict = funnel.model_dump()
        funnel_dict["created_at"] = funnel_dict["created_at"].isoformat()
        funnel_dict["updated_at"] = funnel_dict["updated_at"].isoformat()
        db.add_funnel(funnel.id, funnel_dict)
        return funnel

    @staticmethod
    def get_funnel(funnel_id: str) -> Optional[Funnel]:
        funnel_data = db.get_funnel(funnel_id)
        if funnel_data:
            return Funnel(**funnel_data)
        return None

    @staticmethod
    def get_all_funnels() -> List[Funnel]:
        funnels = db.get_all_funnels()
        return [Funnel(**f) for f in funnels]

    @staticmethod
    def delete_funnel(funnel_id: str) -> bool:
        return db.delete_funnel(funnel_id)

    @staticmethod
    def analyze_funnel(
        funnel_id: str,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
    ) -> Optional[FunnelAnalysis]:
        funnel_data = db.get_funnel(funnel_id)
        if not funnel_data:
            return None
        
        funnel = Funnel(**funnel_data)
        steps = sorted(funnel.steps, key=lambda s: s.order)
        
        if not steps:
            return None
        
        events = db.get_events_by_filter(start_time=start_time, end_time=end_time)
        
        player_step_times: Dict[str, Dict[int, datetime]] = {}
        
        for event in events:
            player_id = event.get("player_id")
            event_type = event.get("event_type")
            event_name = event.get("event_name")
            timestamp = datetime.fromisoformat(event.get("timestamp"))
            
            for step in steps:
                if step.event_type == event_type and step.event_name == event_name:
                    if player_id not in player_step_times:
                        player_step_times[player_id] = {}
                    
                    if step.order not in player_step_times[player_id]:
                        player_step_times[player_id][step.order] = timestamp
                    break
        
        step_analyses = []
        prev_users = None
        
        for i, step in enumerate(steps):
            users_at_step = set()
            completion_times = []
            
            for player_id, step_times in player_step_times.items():
                completed_all_prev = all(
                    j in step_times for j in range(step.order)
                )
                if step.order in step_times and completed_all_prev:
                    users_at_step.add(player_id)
                    
                    if step.order > 0 and (step.order - 1) in step_times:
                        prev_time = step_times[step.order - 1]
                        curr_time = step_times[step.order]
                        time_diff = (curr_time - prev_time).total_seconds()
                        if time_diff >= 0:
                            completion_times.append(time_diff)
            
            users_entered = len(prev_users) if prev_users is not None else len(player_step_times)
            users_completed = len(users_at_step)
            
            conversion_rate = users_completed / users_entered if users_entered > 0 else 0
            drop_off_rate = 1 - conversion_rate
            avg_time = sum(completion_times) / len(completion_times) if completion_times else None
            
            step_analyses.append(FunnelStepAnalysis(
                step_name=step.name,
                step_order=step.order,
                users_entered=users_entered,
                users_completed=users_completed,
                conversion_rate=conversion_rate,
                drop_off_rate=drop_off_rate,
                average_time_to_complete=avg_time,
            ))
            
            prev_users = users_at_step
        
        total_entered = len(player_step_times)
        total_completed = len(prev_users) if prev_users else 0
        overall_conversion = total_completed / total_entered if total_entered > 0 else 0
        
        return FunnelAnalysis(
            funnel_id=funnel.id,
            funnel_name=funnel.name,
            total_users_entered=total_entered,
            total_users_completed=total_completed,
            overall_conversion_rate=overall_conversion,
            steps=step_analyses,
            analysis_period_start=start_time or datetime.min,
            analysis_period_end=end_time or datetime.utcnow(),
        )

    @staticmethod
    def compare_funnels(
        funnel_ids: List[str],
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
    ) -> List[Dict[str, Any]]:
        """Compare multiple funnels."""
        comparisons = []
        for funnel_id in funnel_ids:
            analysis = FunnelService.analyze_funnel(funnel_id, start_time, end_time)
            if analysis:
                comparisons.append({
                    "funnel_id": analysis.funnel_id,
                    "funnel_name": analysis.funnel_name,
                    "total_entered": analysis.total_users_entered,
                    "total_completed": analysis.total_users_completed,
                    "overall_conversion": analysis.overall_conversion_rate,
                    "step_count": len(analysis.steps),
                })
        return comparisons

    @staticmethod
    def get_funnel_drop_off_analysis(
        funnel_id: str,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
    ) -> Optional[Dict[str, Any]]:
        """Get detailed drop-off analysis for a funnel."""
        analysis = FunnelService.analyze_funnel(funnel_id, start_time, end_time)
        if not analysis:
            return None
        
        drop_offs = []
        for i, step in enumerate(analysis.steps):
            if i > 0:
                prev_step = analysis.steps[i - 1]
                dropped = prev_step.users_completed - step.users_completed
                drop_offs.append({
                    "from_step": prev_step.step_name,
                    "to_step": step.step_name,
                    "users_dropped": dropped,
                    "drop_rate": step.drop_off_rate,
                })
        
        biggest_drop = max(drop_offs, key=lambda x: x["users_dropped"]) if drop_offs else None
        
        return {
            "funnel_id": funnel_id,
            "funnel_name": analysis.funnel_name,
            "drop_offs": drop_offs,
            "biggest_drop_off": biggest_drop,
            "total_drop_off": analysis.total_users_entered - analysis.total_users_completed,
        }
