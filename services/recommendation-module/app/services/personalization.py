"""Real-time personalization engine for GameVerse."""

from typing import Optional

from app.database.memory_db import MemoryDatabase
from app.models.schemas import (
    Recommendation,
    RecommendationResponse,
    PersonalizationContext,
)
from app.services.hybrid import HybridRecommendationEngine


class PersonalizationEngine:
    """
    Real-time personalization engine.
    
    Implements:
    - Session-based recommendations
    - Context-aware recommendations (time, device, etc.)
    - Dynamic re-ranking based on user behavior
    """

    def __init__(self, database: MemoryDatabase) -> None:
        self.db = database
        self.hybrid_engine = HybridRecommendationEngine(database)
        self._session_interactions: dict[str, list[int]] = {}

    def _get_time_of_day_preferences(self, time_of_day: Optional[str]) -> dict[str, float]:
        """Get genre preferences based on time of day."""
        preferences = {
            "morning": {
                "Simulation": 1.2,
                "Strategy": 1.1,
                "Puzzle": 1.2,
                "casual": 1.3,
            },
            "afternoon": {
                "Action": 1.2,
                "RPG": 1.1,
                "Adventure": 1.2,
                "multiplayer": 1.1,
            },
            "evening": {
                "RPG": 1.3,
                "Action RPG": 1.2,
                "story-rich": 1.3,
                "open-world": 1.2,
            },
            "night": {
                "Horror": 1.3,
                "Action": 1.1,
                "Roguelike": 1.2,
                "difficult": 1.1,
            },
        }
        return preferences.get(time_of_day or "afternoon", {})

    def _get_device_preferences(self, device_type: Optional[str]) -> dict[str, float]:
        """Get genre preferences based on device type."""
        preferences = {
            "mobile": {
                "casual": 1.4,
                "Puzzle": 1.3,
                "indie": 1.2,
                "pixel-art": 1.2,
            },
            "console": {
                "Action": 1.2,
                "RPG": 1.2,
                "Action RPG": 1.3,
                "multiplayer": 1.2,
            },
            "pc": {
                "Strategy": 1.3,
                "Simulation": 1.2,
                "RPG": 1.1,
                "multiplayer": 1.1,
            },
        }
        return preferences.get(device_type or "pc", {})

    def _get_mood_preferences(self, mood: Optional[str]) -> dict[str, float]:
        """Get genre preferences based on user mood."""
        preferences = {
            "relaxed": {
                "Simulation": 1.4,
                "relaxing": 1.5,
                "casual": 1.3,
                "farming": 1.4,
            },
            "competitive": {
                "multiplayer": 1.4,
                "difficult": 1.3,
                "Action": 1.2,
                "Strategy": 1.2,
            },
            "adventurous": {
                "open-world": 1.4,
                "exploration": 1.4,
                "RPG": 1.3,
                "fantasy": 1.2,
            },
            "focused": {
                "Strategy": 1.3,
                "Puzzle": 1.3,
                "turn-based": 1.2,
                "building": 1.2,
            },
        }
        return preferences.get(mood or "adventurous", {})

    def _apply_context_boost(
        self,
        recommendations: list[Recommendation],
        context: PersonalizationContext,
    ) -> list[Recommendation]:
        """Apply context-based score boosts to recommendations."""
        time_prefs = self._get_time_of_day_preferences(context.time_of_day)
        device_prefs = self._get_device_preferences(context.device_type)
        mood_prefs = self._get_mood_preferences(context.current_mood)

        boosted_recs = []
        for rec in recommendations:
            game = self.db.get_game(rec.game_id)
            if not game:
                boosted_recs.append(rec)
                continue

            boost = 1.0

            genre_lower = game.genre.lower()
            tags_lower = [t.lower() for t in game.tags]

            for pref_key, pref_boost in time_prefs.items():
                if pref_key.lower() in genre_lower or pref_key.lower() in tags_lower:
                    boost *= pref_boost

            for pref_key, pref_boost in device_prefs.items():
                if pref_key.lower() in genre_lower or pref_key.lower() in tags_lower:
                    boost *= pref_boost

            for pref_key, pref_boost in mood_prefs.items():
                if pref_key.lower() in genre_lower or pref_key.lower() in tags_lower:
                    boost *= pref_boost

            boosted_score = min(rec.score * boost, 1.0)

            boosted_recs.append(
                Recommendation(
                    game_id=rec.game_id,
                    game_title=rec.game_title,
                    score=boosted_score,
                    reason=self._generate_personalized_reason(rec, context),
                    algorithm="personalized",
                )
            )

        boosted_recs.sort(key=lambda x: x.score, reverse=True)
        return boosted_recs

    def _generate_personalized_reason(
        self, rec: Recommendation, context: PersonalizationContext
    ) -> str:
        """Generate a personalized reason for the recommendation."""
        reasons = []

        if context.time_of_day:
            time_reasons = {
                "morning": "Great for a morning gaming session",
                "afternoon": "Perfect for afternoon play",
                "evening": "Ideal for evening relaxation",
                "night": "Perfect for late-night gaming",
            }
            reasons.append(time_reasons.get(context.time_of_day, ""))

        if context.current_mood:
            mood_reasons = {
                "relaxed": "Matches your relaxed mood",
                "competitive": "Great for competitive play",
                "adventurous": "Perfect for exploration",
                "focused": "Ideal for focused gameplay",
            }
            reasons.append(mood_reasons.get(context.current_mood, ""))

        if context.device_type:
            device_reasons = {
                "mobile": "Optimized for mobile gaming",
                "console": "Great console experience",
                "pc": "Best enjoyed on PC",
            }
            reasons.append(device_reasons.get(context.device_type, ""))

        valid_reasons = [r for r in reasons if r]
        if valid_reasons:
            return " | ".join(valid_reasons[:2])
        return rec.reason

    def _apply_session_boost(
        self,
        recommendations: list[Recommendation],
        recent_interactions: list[int],
    ) -> list[Recommendation]:
        """Boost recommendations based on recent session interactions."""
        if not recent_interactions:
            return recommendations

        recent_games = [self.db.get_game(gid) for gid in recent_interactions]
        recent_games = [g for g in recent_games if g is not None]

        if not recent_games:
            return recommendations

        recent_genres = set()
        recent_tags = set()
        recent_developers = set()

        for game in recent_games:
            recent_genres.add(game.genre.lower())
            recent_tags.update(t.lower() for t in game.tags)
            recent_developers.add(game.developer.lower())

        boosted_recs = []
        for rec in recommendations:
            game = self.db.get_game(rec.game_id)
            if not game:
                boosted_recs.append(rec)
                continue

            boost = 1.0

            if game.genre.lower() in recent_genres:
                boost *= 1.15

            matching_tags = sum(1 for t in game.tags if t.lower() in recent_tags)
            if matching_tags > 0:
                boost *= 1.0 + (matching_tags * 0.05)

            if game.developer.lower() in recent_developers:
                boost *= 1.1

            if game.id in recent_interactions:
                boost *= 0.3

            boosted_score = min(rec.score * boost, 1.0)

            boosted_recs.append(
                Recommendation(
                    game_id=rec.game_id,
                    game_title=rec.game_title,
                    score=boosted_score,
                    reason=rec.reason,
                    algorithm=rec.algorithm,
                )
            )

        boosted_recs.sort(key=lambda x: x.score, reverse=True)
        return boosted_recs

    def _apply_diversity_reranking(
        self, recommendations: list[Recommendation], diversity_factor: float = 0.3
    ) -> list[Recommendation]:
        """Re-rank recommendations to ensure diversity."""
        if len(recommendations) <= 1:
            return recommendations

        reranked = [recommendations[0]]
        remaining = recommendations[1:]
        selected_genres = {self.db.get_game(recommendations[0].game_id).genre.lower()}  # type: ignore
        selected_developers = {self.db.get_game(recommendations[0].game_id).developer.lower()}  # type: ignore

        while remaining and len(reranked) < len(recommendations):
            best_idx = 0
            best_score = -1.0

            for idx, rec in enumerate(remaining):
                game = self.db.get_game(rec.game_id)
                if not game:
                    continue

                diversity_bonus = 0.0
                if game.genre.lower() not in selected_genres:
                    diversity_bonus += diversity_factor
                if game.developer.lower() not in selected_developers:
                    diversity_bonus += diversity_factor * 0.5

                adjusted_score = rec.score + diversity_bonus

                if adjusted_score > best_score:
                    best_score = adjusted_score
                    best_idx = idx

            selected_rec = remaining.pop(best_idx)
            game = self.db.get_game(selected_rec.game_id)
            if game:
                selected_genres.add(game.genre.lower())
                selected_developers.add(game.developer.lower())
            reranked.append(selected_rec)

        return reranked

    def get_personalized_recommendations(
        self,
        context: PersonalizationContext,
        top_n: int = 10,
        apply_diversity: bool = True,
    ) -> RecommendationResponse:
        """
        Get real-time personalized recommendations.
        
        Combines hybrid recommendations with context-aware re-ranking.
        """
        base_recs = self.hybrid_engine.get_recommendations(
            context.user_id, method="auto", top_n=top_n * 2
        )

        if not base_recs.recommendations:
            return RecommendationResponse(
                user_id=context.user_id,
                recommendations=[],
                algorithm_type="personalized",
            )

        personalized_recs = self._apply_context_boost(
            base_recs.recommendations, context
        )

        personalized_recs = self._apply_session_boost(
            personalized_recs, context.recent_interactions
        )

        if apply_diversity:
            personalized_recs = self._apply_diversity_reranking(personalized_recs)

        final_recs = personalized_recs[:top_n]

        return RecommendationResponse(
            user_id=context.user_id,
            recommendations=final_recs,
            algorithm_type="real_time_personalized",
        )

    def record_interaction(self, session_id: str, game_id: int) -> None:
        """Record a user interaction for session-based recommendations."""
        if session_id not in self._session_interactions:
            self._session_interactions[session_id] = []

        interactions = self._session_interactions[session_id]
        if game_id not in interactions:
            interactions.append(game_id)

        if len(interactions) > 20:
            self._session_interactions[session_id] = interactions[-20:]

    def get_session_interactions(self, session_id: str) -> list[int]:
        """Get recent interactions for a session."""
        return self._session_interactions.get(session_id, [])

    def clear_session(self, session_id: str) -> None:
        """Clear session interaction history."""
        if session_id in self._session_interactions:
            del self._session_interactions[session_id]
