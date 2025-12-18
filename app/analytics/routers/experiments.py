from typing import List, Dict, Any
from fastapi import APIRouter, HTTPException, Query

from ..models.experiment import Experiment, ExperimentCreate, ExperimentResult
from ..services.experiment_service import ExperimentService

router = APIRouter(prefix="/experiments", tags=["A/B Testing"])


@router.post("/", response_model=Experiment)
async def create_experiment(experiment_data: ExperimentCreate):
    """Create a new A/B test experiment."""
    return ExperimentService.create_experiment(experiment_data)


@router.get("/", response_model=List[Experiment])
async def get_experiments():
    """Get all experiments."""
    return ExperimentService.get_all_experiments()


@router.get("/sample-size", response_model=Dict[str, Any])
async def calculate_sample_size(
    baseline_rate: float = Query(..., ge=0, le=1),
    minimum_detectable_effect: float = Query(..., ge=0.01, le=1),
    power: float = Query(0.8, ge=0.5, le=0.99),
    significance: float = Query(0.05, ge=0.01, le=0.1),
):
    """Calculate required sample size for an experiment."""
    sample_size = ExperimentService.calculate_required_sample_size(
        baseline_rate, minimum_detectable_effect, power, significance
    )
    return {
        "baseline_rate": baseline_rate,
        "minimum_detectable_effect": minimum_detectable_effect,
        "power": power,
        "significance": significance,
        "required_sample_size_per_variant": sample_size,
    }


@router.get("/{experiment_id}", response_model=Experiment)
async def get_experiment(experiment_id: str):
    """Get a specific experiment."""
    experiment = ExperimentService.get_experiment(experiment_id)
    if not experiment:
        raise HTTPException(status_code=404, detail="Experiment not found")
    return experiment


@router.post("/{experiment_id}/start", response_model=Experiment)
async def start_experiment(experiment_id: str):
    """Start an experiment."""
    experiment = ExperimentService.start_experiment(experiment_id)
    if not experiment:
        raise HTTPException(status_code=404, detail="Experiment not found")
    return experiment


@router.post("/{experiment_id}/pause", response_model=Experiment)
async def pause_experiment(experiment_id: str):
    """Pause an experiment."""
    experiment = ExperimentService.pause_experiment(experiment_id)
    if not experiment:
        raise HTTPException(status_code=404, detail="Experiment not found")
    return experiment


@router.post("/{experiment_id}/stop", response_model=Experiment)
async def stop_experiment(experiment_id: str):
    """Stop an experiment."""
    experiment = ExperimentService.stop_experiment(experiment_id)
    if not experiment:
        raise HTTPException(status_code=404, detail="Experiment not found")
    return experiment


@router.delete("/{experiment_id}")
async def delete_experiment(experiment_id: str):
    """Delete an experiment."""
    if not ExperimentService.delete_experiment(experiment_id):
        raise HTTPException(status_code=404, detail="Experiment not found")
    return {"message": "Experiment deleted successfully"}


@router.post("/{experiment_id}/assign", response_model=Dict[str, str])
async def assign_player(experiment_id: str, player_id: str = Query(...)):
    """Assign a player to a variant in an experiment."""
    variant_id = ExperimentService.assign_player_to_variant(experiment_id, player_id)
    if not variant_id:
        raise HTTPException(
            status_code=400,
            detail="Could not assign player. Experiment may not be running.",
        )
    return {"player_id": player_id, "variant_id": variant_id}


@router.post("/{experiment_id}/convert")
async def record_conversion(
    experiment_id: str,
    player_id: str = Query(...),
    value: float = Query(1.0),
):
    """Record a conversion for a player in an experiment."""
    if not ExperimentService.record_conversion(experiment_id, player_id, value):
        raise HTTPException(
            status_code=400,
            detail="Could not record conversion. Player may not be assigned.",
        )
    return {"message": "Conversion recorded successfully"}


@router.get("/{experiment_id}/results", response_model=List[ExperimentResult])
async def get_experiment_results(experiment_id: str):
    """Get experiment results with statistical analysis."""
    results = ExperimentService.get_experiment_results(experiment_id)
    if not results:
        raise HTTPException(status_code=404, detail="Experiment not found or has no variants")
    return results
