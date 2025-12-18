"""Hybrid recommendation engine for GameVerse."""

from app.database.memory_db import MemoryDatabase
from app.models.schemas import Recommendation, RecommendationResponse
from app.services.collaborative_filtering import CollaborativeFilteringEngine
from app.services.content_based import ContentBasedEngine


class HybridRecommendationEngine:
    """
    Hybrid recommendation engine combining multiple approaches.
    
    Implements:
    - Weighted hybrid: Combines scores from multiple algorithms
    - Switching hybrid: Switches between algorithms based on data availability
    - Cascade hybrid: Uses one algorithm to refine another's results
    """

    def __init__(self, database: MemoryDatabase) -> None:
        self.db = database
        self.cf_engine = CollaborativeFilteringEngine(database)
        self.cb_engine = ContentBasedEngine(database)

    def _has_sufficient_ratings(self, user_id: int, min_ratings: int = 3) -> bool:
        """Check if user has enough ratings for collaborative filtering."""
        user_ratings = self.db.get_ratings_by_user(user_id)
        return len(user_ratings) >= min_ratings

    def get_weighted_hybrid_recommendations(
        self,
        user_id: int,
        top_n: int = 10,
        cf_weight: float = 0.6,
        cb_weight: float = 0.4,
    ) -> RecommendationResponse:
        """
        Get recommendations using weighted hybrid approach.
        
        Combines collaborative filtering and content-based scores
        using specified weights.
        """
        cf_recs = self.cf_engine.get_recommendations(user_id, method="combined", top_n=top_n * 2)
        cb_recs = self.cb_engine.get_recommendations(user_id, top_n=top_n * 2)

        combined_scores: dict[int, tuple[float, str, str]] = {}

        for rec in cf_recs.recommendations:
            combined_scores[rec.game_id] = (
                rec.score * cf_weight,
                rec.game_title,
                "Recommended by users with similar taste",
            )

        for rec in cb_recs.recommendations:
            if rec.game_id in combined_scores:
                old_score, title, _ = combined_scores[rec.game_id]
                combined_scores[rec.game_id] = (
                    old_score + rec.score * cb_weight,
                    title,
                    "Matches your preferences and similar users' taste",
                )
            else:
                combined_scores[rec.game_id] = (
                    rec.score * cb_weight,
                    rec.game_title,
                    rec.reason,
                )

        sorted_combined = sorted(
            combined_scores.items(), key=lambda x: x[1][0], reverse=True
        )[:top_n]

        recommendations = [
            Recommendation(
                game_id=game_id,
                game_title=data[1],
                score=min(data[0], 1.0),
                reason=data[2],
                algorithm="weighted_hybrid",
            )
            for game_id, data in sorted_combined
        ]

        return RecommendationResponse(
            user_id=user_id,
            recommendations=recommendations,
            algorithm_type="weighted_hybrid",
        )

    def get_switching_hybrid_recommendations(
        self, user_id: int, top_n: int = 10
    ) -> RecommendationResponse:
        """
        Get recommendations using switching hybrid approach.
        
        Uses collaborative filtering if user has enough ratings,
        otherwise falls back to content-based recommendations.
        """
        if self._has_sufficient_ratings(user_id):
            cf_recs = self.cf_engine.get_recommendations(
                user_id, method="combined", top_n=top_n
            )

            if cf_recs.recommendations:
                for rec in cf_recs.recommendations:
                    rec.algorithm = "switching_hybrid_cf"

                return RecommendationResponse(
                    user_id=user_id,
                    recommendations=cf_recs.recommendations,
                    algorithm_type="switching_hybrid_collaborative",
                )

        cb_recs = self.cb_engine.get_recommendations(user_id, top_n=top_n)

        for rec in cb_recs.recommendations:
            rec.algorithm = "switching_hybrid_cb"

        return RecommendationResponse(
            user_id=user_id,
            recommendations=cb_recs.recommendations,
            algorithm_type="switching_hybrid_content_based",
        )

    def get_cascade_hybrid_recommendations(
        self, user_id: int, top_n: int = 10
    ) -> RecommendationResponse:
        """
        Get recommendations using cascade hybrid approach.
        
        First uses content-based to generate candidates,
        then uses collaborative filtering to re-rank them.
        """
        cb_recs = self.cb_engine.get_recommendations(user_id, top_n=top_n * 3)

        if not cb_recs.recommendations:
            return RecommendationResponse(
                user_id=user_id,
                recommendations=[],
                algorithm_type="cascade_hybrid",
            )

        candidate_ids = {rec.game_id for rec in cb_recs.recommendations}
        cb_scores = {rec.game_id: rec.score for rec in cb_recs.recommendations}

        cf_recs = self.cf_engine.get_recommendations(
            user_id, method="combined", top_n=top_n * 3
        )
        cf_scores = {rec.game_id: rec.score for rec in cf_recs.recommendations}

        refined_scores: dict[int, tuple[float, str]] = {}
        for game_id in candidate_ids:
            cb_score = cb_scores.get(game_id, 0.0)
            cf_score = cf_scores.get(game_id, 0.0)

            if cf_score > 0:
                combined_score = 0.4 * cb_score + 0.6 * cf_score
            else:
                combined_score = cb_score * 0.7

            game = self.db.get_game(game_id)
            if game:
                refined_scores[game_id] = (combined_score, game.title)

        sorted_refined = sorted(
            refined_scores.items(), key=lambda x: x[1][0], reverse=True
        )[:top_n]

        recommendations = [
            Recommendation(
                game_id=game_id,
                game_title=data[1],
                score=min(data[0], 1.0),
                reason="Refined recommendation based on content and user behavior",
                algorithm="cascade_hybrid",
            )
            for game_id, data in sorted_refined
        ]

        return RecommendationResponse(
            user_id=user_id,
            recommendations=recommendations,
            algorithm_type="cascade_hybrid",
        )

    def get_recommendations(
        self, user_id: int, method: str = "weighted", top_n: int = 10
    ) -> RecommendationResponse:
        """
        Get hybrid recommendations using specified method.
        
        Args:
            user_id: The user ID to get recommendations for
            method: One of 'weighted', 'switching', 'cascade', or 'auto'
            top_n: Number of recommendations to return
        """
        if method == "weighted":
            return self.get_weighted_hybrid_recommendations(user_id, top_n)
        elif method == "switching":
            return self.get_switching_hybrid_recommendations(user_id, top_n)
        elif method == "cascade":
            return self.get_cascade_hybrid_recommendations(user_id, top_n)
        else:
            if self._has_sufficient_ratings(user_id, min_ratings=5):
                return self.get_weighted_hybrid_recommendations(user_id, top_n)
            elif self._has_sufficient_ratings(user_id, min_ratings=2):
                return self.get_cascade_hybrid_recommendations(user_id, top_n)
            else:
                return self.get_switching_hybrid_recommendations(user_id, top_n)
