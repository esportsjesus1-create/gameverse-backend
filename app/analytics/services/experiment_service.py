from typing import List, Optional
from datetime import datetime
import random
import math
from scipy import stats
from ..models.experiment import (
    Experiment,
    ExperimentCreate,
    ExperimentStatus,
    ExperimentResult,
)
from .database import db


class ExperimentService:
    """Service for A/B testing and experimentation."""

    @staticmethod
    def create_experiment(experiment_data: ExperimentCreate) -> Experiment:
        experiment = Experiment(
            name=experiment_data.name,
            description=experiment_data.description,
            hypothesis=experiment_data.hypothesis,
            primary_metric=experiment_data.primary_metric,
            secondary_metrics=experiment_data.secondary_metrics,
            target_sample_size=experiment_data.target_sample_size,
            minimum_detectable_effect=experiment_data.minimum_detectable_effect,
            variants=experiment_data.variants,
        )
        experiment_dict = experiment.model_dump()
        experiment_dict["created_at"] = experiment_dict["created_at"].isoformat()
        if experiment_dict.get("started_at"):
            experiment_dict["started_at"] = experiment_dict["started_at"].isoformat()
        if experiment_dict.get("ended_at"):
            experiment_dict["ended_at"] = experiment_dict["ended_at"].isoformat()
        db.add_experiment(experiment.id, experiment_dict)
        return experiment

    @staticmethod
    def get_experiment(experiment_id: str) -> Optional[Experiment]:
        experiment_data = db.get_experiment(experiment_id)
        if experiment_data:
            return Experiment(**experiment_data)
        return None

    @staticmethod
    def get_all_experiments() -> List[Experiment]:
        experiments = db.get_all_experiments()
        return [Experiment(**e) for e in experiments]

    @staticmethod
    def start_experiment(experiment_id: str) -> Optional[Experiment]:
        experiment_data = db.get_experiment(experiment_id)
        if not experiment_data:
            return None
        
        updates = {
            "status": ExperimentStatus.RUNNING.value,
            "started_at": datetime.utcnow().isoformat(),
        }
        updated = db.update_experiment(experiment_id, updates)
        if updated:
            return Experiment(**updated)
        return None

    @staticmethod
    def pause_experiment(experiment_id: str) -> Optional[Experiment]:
        experiment_data = db.get_experiment(experiment_id)
        if not experiment_data:
            return None
        
        updates = {"status": ExperimentStatus.PAUSED.value}
        updated = db.update_experiment(experiment_id, updates)
        if updated:
            return Experiment(**updated)
        return None

    @staticmethod
    def stop_experiment(experiment_id: str) -> Optional[Experiment]:
        experiment_data = db.get_experiment(experiment_id)
        if not experiment_data:
            return None
        
        updates = {
            "status": ExperimentStatus.COMPLETED.value,
            "ended_at": datetime.utcnow().isoformat(),
        }
        updated = db.update_experiment(experiment_id, updates)
        if updated:
            return Experiment(**updated)
        return None

    @staticmethod
    def delete_experiment(experiment_id: str) -> bool:
        return db.delete_experiment(experiment_id)

    @staticmethod
    def assign_player_to_variant(
        experiment_id: str, player_id: str
    ) -> Optional[str]:
        """Assign a player to a variant using weighted random assignment."""
        experiment_data = db.get_experiment(experiment_id)
        if not experiment_data:
            return None
        
        if experiment_data.get("status") != ExperimentStatus.RUNNING.value:
            return None
        
        existing = db.get_player_variant(experiment_id, player_id)
        if existing:
            return existing
        
        variants = experiment_data.get("variants", [])
        if not variants:
            return None
        
        total_weight = sum(v.get("weight", 1.0) for v in variants)
        rand = random.random() * total_weight
        
        cumulative = 0
        selected_variant = None
        for variant in variants:
            cumulative += variant.get("weight", 1.0)
            if rand <= cumulative:
                selected_variant = variant
                break
        
        if not selected_variant:
            selected_variant = variants[0]
        
        variant_id = selected_variant.get("id")
        db.assign_player_to_variant(experiment_id, player_id, variant_id)
        
        for i, v in enumerate(variants):
            if v.get("id") == variant_id:
                variants[i]["participants"] = v.get("participants", 0) + 1
                break
        
        db.update_experiment(experiment_id, {
            "variants": variants,
            "total_participants": experiment_data.get("total_participants", 0) + 1,
        })
        
        return variant_id

    @staticmethod
    def record_conversion(
        experiment_id: str,
        player_id: str,
        value: float = 1.0,
    ) -> bool:
        """Record a conversion for a player in an experiment."""
        experiment_data = db.get_experiment(experiment_id)
        if not experiment_data:
            return False
        
        variant_id = db.get_player_variant(experiment_id, player_id)
        if not variant_id:
            return False
        
        variants = experiment_data.get("variants", [])
        for i, v in enumerate(variants):
            if v.get("id") == variant_id:
                variants[i]["conversions"] = v.get("conversions", 0) + 1
                variants[i]["total_value"] = v.get("total_value", 0) + value
                break
        
        db.update_experiment(experiment_id, {"variants": variants})
        return True

    @staticmethod
    def get_experiment_results(experiment_id: str) -> Optional[List[ExperimentResult]]:
        """Calculate and return experiment results with statistical analysis."""
        experiment_data = db.get_experiment(experiment_id)
        if not experiment_data:
            return None
        
        variants = experiment_data.get("variants", [])
        if not variants:
            return None
        
        results = []
        control_rate = None
        
        for i, variant in enumerate(variants):
            participants = variant.get("participants", 0)
            conversions = variant.get("conversions", 0)
            total_value = variant.get("total_value", 0)
            
            conversion_rate = conversions / participants if participants > 0 else 0
            average_value = total_value / conversions if conversions > 0 else 0
            
            ci_lower, ci_upper = ExperimentService._calculate_confidence_interval(
                conversions, participants
            )
            
            if i == 0:
                control_rate = conversion_rate
                p_value = None
                lift = None
            else:
                p_value = ExperimentService._calculate_p_value(
                    variants[0].get("conversions", 0),
                    variants[0].get("participants", 0),
                    conversions,
                    participants,
                )
                lift = (
                    (conversion_rate - control_rate) / control_rate
                    if control_rate and control_rate > 0
                    else None
                )
            
            is_significant = p_value is not None and p_value < 0.05
            
            results.append(ExperimentResult(
                experiment_id=experiment_id,
                variant_id=variant.get("id"),
                variant_name=variant.get("name"),
                participants=participants,
                conversions=conversions,
                conversion_rate=conversion_rate,
                total_value=total_value,
                average_value=average_value,
                confidence_interval_lower=ci_lower,
                confidence_interval_upper=ci_upper,
                p_value=p_value,
                is_significant=is_significant,
                is_winner=False,
                lift_vs_control=lift,
            ))
        
        if len(results) > 1:
            significant_results = [r for r in results[1:] if r.is_significant]
            if significant_results:
                winner = max(significant_results, key=lambda r: r.conversion_rate)
                for r in results:
                    if r.variant_id == winner.variant_id:
                        r.is_winner = True
        
        return results

    @staticmethod
    def _calculate_confidence_interval(
        successes: int, trials: int, confidence: float = 0.95
    ) -> tuple:
        """Calculate Wilson score confidence interval."""
        if trials == 0:
            return (0.0, 0.0)
        
        z = stats.norm.ppf((1 + confidence) / 2)
        p = successes / trials
        
        denominator = 1 + z * z / trials
        center = (p + z * z / (2 * trials)) / denominator
        margin = z * math.sqrt((p * (1 - p) + z * z / (4 * trials)) / trials) / denominator
        
        return (max(0, center - margin), min(1, center + margin))

    @staticmethod
    def _calculate_p_value(
        control_conversions: int,
        control_participants: int,
        treatment_conversions: int,
        treatment_participants: int,
    ) -> Optional[float]:
        """Calculate p-value using chi-squared test."""
        if control_participants == 0 or treatment_participants == 0:
            return None
        
        table = [
            [control_conversions, control_participants - control_conversions],
            [treatment_conversions, treatment_participants - treatment_conversions],
        ]
        
        if any(cell < 0 for row in table for cell in row):
            return None
        
        try:
            _, p_value, _, _ = stats.chi2_contingency(table)
            return p_value
        except ValueError:
            return None

    @staticmethod
    def calculate_required_sample_size(
        baseline_rate: float,
        minimum_detectable_effect: float,
        power: float = 0.8,
        significance: float = 0.05,
    ) -> int:
        """Calculate required sample size per variant."""
        if baseline_rate <= 0 or baseline_rate >= 1:
            return 1000
        
        effect_size = baseline_rate * minimum_detectable_effect
        p1 = baseline_rate
        p2 = baseline_rate + effect_size
        
        z_alpha = stats.norm.ppf(1 - significance / 2)
        z_beta = stats.norm.ppf(power)
        
        p_pooled = (p1 + p2) / 2
        
        numerator = (z_alpha * math.sqrt(2 * p_pooled * (1 - p_pooled)) +
                    z_beta * math.sqrt(p1 * (1 - p1) + p2 * (1 - p2))) ** 2
        denominator = (p2 - p1) ** 2
        
        if denominator == 0:
            return 1000
        
        return int(math.ceil(numerator / denominator))
