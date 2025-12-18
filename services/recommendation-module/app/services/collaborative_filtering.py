"""Collaborative filtering recommendation engine for GameVerse."""

import numpy as np
from scipy.sparse.linalg import svds
from sklearn.metrics.pairwise import cosine_similarity
from typing import Optional

from app.database.memory_db import MemoryDatabase
from app.models.schemas import Recommendation, RecommendationResponse


class CollaborativeFilteringEngine:
    """
    Collaborative filtering recommendation engine.
    
    Implements:
    - User-based collaborative filtering
    - Item-based collaborative filtering
    - Matrix factorization (SVD-based)
    """

    def __init__(self, database: MemoryDatabase) -> None:
        self.db = database
        self._user_similarity_matrix: Optional[np.ndarray] = None
        self._item_similarity_matrix: Optional[np.ndarray] = None
        self._svd_predictions: Optional[np.ndarray] = None
        self._user_ids: list[int] = []
        self._game_ids: list[int] = []

    def _build_matrices(self) -> None:
        """Build similarity matrices from rating data."""
        matrix, self._user_ids, self._game_ids = self.db.get_user_game_matrix()
        
        if matrix.size == 0 or len(self._user_ids) == 0:
            return

        matrix_normalized = matrix - np.mean(matrix, axis=1, keepdims=True, where=matrix > 0)
        matrix_normalized = np.nan_to_num(matrix_normalized)

        if len(self._user_ids) > 1:
            self._user_similarity_matrix = cosine_similarity(matrix_normalized)
        else:
            self._user_similarity_matrix = np.array([[1.0]])

        if len(self._game_ids) > 1:
            self._item_similarity_matrix = cosine_similarity(matrix_normalized.T)
        else:
            self._item_similarity_matrix = np.array([[1.0]])

        self._compute_svd_predictions(matrix)

    def _compute_svd_predictions(self, matrix: np.ndarray) -> None:
        """Compute SVD-based predictions."""
        if matrix.shape[0] < 2 or matrix.shape[1] < 2:
            self._svd_predictions = matrix.copy()
            return

        k = min(min(matrix.shape) - 1, 5)
        if k < 1:
            self._svd_predictions = matrix.copy()
            return

        try:
            U, sigma, Vt = svds(matrix.astype(float), k=k)
            sigma_diag = np.diag(sigma)
            self._svd_predictions = np.dot(np.dot(U, sigma_diag), Vt)
        except Exception:
            self._svd_predictions = matrix.copy()

    def get_user_based_recommendations(
        self, user_id: int, top_n: int = 10
    ) -> RecommendationResponse:
        """
        Get recommendations using user-based collaborative filtering.
        
        Finds similar users and recommends games they liked.
        """
        self._build_matrices()

        if user_id not in self._user_ids:
            return RecommendationResponse(
                user_id=user_id,
                recommendations=[],
                algorithm_type="user_based_collaborative_filtering",
            )

        user_idx = self._user_ids.index(user_id)
        matrix, _, _ = self.db.get_user_game_matrix()

        user_ratings = matrix[user_idx]
        rated_games = set(np.where(user_ratings > 0)[0])

        if self._user_similarity_matrix is None:
            return RecommendationResponse(
                user_id=user_id,
                recommendations=[],
                algorithm_type="user_based_collaborative_filtering",
            )

        similarities = self._user_similarity_matrix[user_idx]
        
        predictions = {}
        for game_idx in range(len(self._game_ids)):
            if game_idx in rated_games:
                continue

            weighted_sum = 0.0
            similarity_sum = 0.0

            for other_user_idx in range(len(self._user_ids)):
                if other_user_idx == user_idx:
                    continue
                if matrix[other_user_idx, game_idx] > 0:
                    sim = similarities[other_user_idx]
                    if sim > 0:
                        weighted_sum += sim * matrix[other_user_idx, game_idx]
                        similarity_sum += abs(sim)

            if similarity_sum > 0:
                predictions[game_idx] = weighted_sum / similarity_sum

        sorted_predictions = sorted(predictions.items(), key=lambda x: x[1], reverse=True)
        top_predictions = sorted_predictions[:top_n]

        recommendations = []
        for game_idx, score in top_predictions:
            game_id = self._game_ids[game_idx]
            game = self.db.get_game(game_id)
            if game:
                normalized_score = min(score / 5.0, 1.0)
                recommendations.append(
                    Recommendation(
                        game_id=game_id,
                        game_title=game.title,
                        score=normalized_score,
                        reason="Users with similar taste enjoyed this game",
                        algorithm="user_based_cf",
                    )
                )

        return RecommendationResponse(
            user_id=user_id,
            recommendations=recommendations,
            algorithm_type="user_based_collaborative_filtering",
        )

    def get_item_based_recommendations(
        self, user_id: int, top_n: int = 10
    ) -> RecommendationResponse:
        """
        Get recommendations using item-based collaborative filtering.
        
        Recommends games similar to ones the user has rated highly.
        """
        self._build_matrices()

        if user_id not in self._user_ids:
            return RecommendationResponse(
                user_id=user_id,
                recommendations=[],
                algorithm_type="item_based_collaborative_filtering",
            )

        user_idx = self._user_ids.index(user_id)
        matrix, _, _ = self.db.get_user_game_matrix()

        user_ratings = matrix[user_idx]
        rated_games = np.where(user_ratings > 0)[0]
        unrated_games = np.where(user_ratings == 0)[0]

        if len(rated_games) == 0 or self._item_similarity_matrix is None:
            return RecommendationResponse(
                user_id=user_id,
                recommendations=[],
                algorithm_type="item_based_collaborative_filtering",
            )

        predictions = {}
        for game_idx in unrated_games:
            weighted_sum = 0.0
            similarity_sum = 0.0

            for rated_idx in rated_games:
                sim = self._item_similarity_matrix[game_idx, rated_idx]
                if sim > 0:
                    weighted_sum += sim * user_ratings[rated_idx]
                    similarity_sum += sim

            if similarity_sum > 0:
                predictions[game_idx] = weighted_sum / similarity_sum

        sorted_predictions = sorted(predictions.items(), key=lambda x: x[1], reverse=True)
        top_predictions = sorted_predictions[:top_n]

        recommendations = []
        for game_idx, score in top_predictions:
            game_id = self._game_ids[game_idx]
            game = self.db.get_game(game_id)
            if game:
                normalized_score = min(score / 5.0, 1.0)
                recommendations.append(
                    Recommendation(
                        game_id=game_id,
                        game_title=game.title,
                        score=normalized_score,
                        reason="Similar to games you've enjoyed",
                        algorithm="item_based_cf",
                    )
                )

        return RecommendationResponse(
            user_id=user_id,
            recommendations=recommendations,
            algorithm_type="item_based_collaborative_filtering",
        )

    def get_svd_recommendations(
        self, user_id: int, top_n: int = 10
    ) -> RecommendationResponse:
        """
        Get recommendations using SVD matrix factorization.
        
        Uses latent factors to predict user preferences.
        """
        self._build_matrices()

        if user_id not in self._user_ids or self._svd_predictions is None:
            return RecommendationResponse(
                user_id=user_id,
                recommendations=[],
                algorithm_type="svd_matrix_factorization",
            )

        user_idx = self._user_ids.index(user_id)
        matrix, _, _ = self.db.get_user_game_matrix()

        user_ratings = matrix[user_idx]
        rated_games = set(np.where(user_ratings > 0)[0])

        predictions = {}
        for game_idx in range(len(self._game_ids)):
            if game_idx not in rated_games:
                predictions[game_idx] = self._svd_predictions[user_idx, game_idx]

        sorted_predictions = sorted(predictions.items(), key=lambda x: x[1], reverse=True)
        top_predictions = sorted_predictions[:top_n]

        recommendations = []
        for game_idx, score in top_predictions:
            game_id = self._game_ids[game_idx]
            game = self.db.get_game(game_id)
            if game:
                normalized_score = max(0.0, min(score / 5.0, 1.0))
                recommendations.append(
                    Recommendation(
                        game_id=game_id,
                        game_title=game.title,
                        score=normalized_score,
                        reason="Predicted based on your rating patterns",
                        algorithm="svd_mf",
                    )
                )

        return RecommendationResponse(
            user_id=user_id,
            recommendations=recommendations,
            algorithm_type="svd_matrix_factorization",
        )

    def get_recommendations(
        self, user_id: int, method: str = "combined", top_n: int = 10
    ) -> RecommendationResponse:
        """
        Get collaborative filtering recommendations.
        
        Args:
            user_id: The user ID to get recommendations for
            method: One of 'user_based', 'item_based', 'svd', or 'combined'
            top_n: Number of recommendations to return
        """
        if method == "user_based":
            return self.get_user_based_recommendations(user_id, top_n)
        elif method == "item_based":
            return self.get_item_based_recommendations(user_id, top_n)
        elif method == "svd":
            return self.get_svd_recommendations(user_id, top_n)
        else:
            user_recs = self.get_user_based_recommendations(user_id, top_n)
            item_recs = self.get_item_based_recommendations(user_id, top_n)
            svd_recs = self.get_svd_recommendations(user_id, top_n)

            combined_scores: dict[int, tuple[float, str, str]] = {}

            for rec in user_recs.recommendations:
                combined_scores[rec.game_id] = (
                    rec.score * 0.3,
                    rec.game_title,
                    rec.reason,
                )

            for rec in item_recs.recommendations:
                if rec.game_id in combined_scores:
                    old_score, title, reason = combined_scores[rec.game_id]
                    combined_scores[rec.game_id] = (
                        old_score + rec.score * 0.35,
                        title,
                        reason,
                    )
                else:
                    combined_scores[rec.game_id] = (
                        rec.score * 0.35,
                        rec.game_title,
                        rec.reason,
                    )

            for rec in svd_recs.recommendations:
                if rec.game_id in combined_scores:
                    old_score, title, reason = combined_scores[rec.game_id]
                    combined_scores[rec.game_id] = (
                        old_score + rec.score * 0.35,
                        title,
                        reason,
                    )
                else:
                    combined_scores[rec.game_id] = (
                        rec.score * 0.35,
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
                    reason="Combined collaborative filtering recommendation",
                    algorithm="combined_cf",
                )
                for game_id, data in sorted_combined
            ]

            return RecommendationResponse(
                user_id=user_id,
                recommendations=recommendations,
                algorithm_type="combined_collaborative_filtering",
            )
