"""Item similarity scoring engine for GameVerse."""

import numpy as np
from typing import Optional

from app.database.memory_db import MemoryDatabase
from app.models.schemas import SimilarityScore, SimilarityResponse
from app.services.content_based import ContentBasedEngine


class SimilarityEngine:
    """
    Item similarity scoring engine.
    
    Implements:
    - Feature-based similarity
    - Behavioral similarity (users who liked X also liked Y)
    - Combined similarity scores
    """

    def __init__(self, database: MemoryDatabase) -> None:
        self.db = database
        self.content_engine = ContentBasedEngine(database)
        self._behavioral_similarity_matrix: Optional[np.ndarray] = None
        self._game_ids: list[int] = []

    def _build_behavioral_similarity(self) -> None:
        """Build behavioral similarity matrix from user ratings."""
        matrix, user_ids, self._game_ids = self.db.get_user_game_matrix()

        if matrix.size == 0 or len(self._game_ids) < 2:
            self._behavioral_similarity_matrix = None
            return

        binary_matrix = (matrix > 3.0).astype(float)

        co_occurrence = np.dot(binary_matrix.T, binary_matrix)

        game_counts = np.sum(binary_matrix, axis=0)
        game_counts = np.maximum(game_counts, 1)

        with np.errstate(divide='ignore', invalid='ignore'):
            jaccard_sim = co_occurrence / (
                game_counts[:, np.newaxis] + game_counts[np.newaxis, :] - co_occurrence
            )
            jaccard_sim = np.nan_to_num(jaccard_sim)

        np.fill_diagonal(jaccard_sim, 1.0)

        self._behavioral_similarity_matrix = jaccard_sim

    def get_feature_similarity(
        self, game_id: int, top_n: int = 10
    ) -> list[SimilarityScore]:
        """
        Get similar games based on content features.
        
        Uses TF-IDF and categorical features for similarity.
        """
        similar_games = self.content_engine.get_similar_by_content(game_id, top_n)

        similarity_scores = []
        for similar_id, score in similar_games:
            game = self.db.get_game(similar_id)
            if game:
                similarity_scores.append(
                    SimilarityScore(
                        game_id=similar_id,
                        game_title=game.title,
                        similarity_score=float(min(max(score, 0.0), 1.0)),
                        similarity_type="feature_based",
                    )
                )

        return similarity_scores

    def get_behavioral_similarity(
        self, game_id: int, top_n: int = 10
    ) -> list[SimilarityScore]:
        """
        Get similar games based on user behavior.
        
        Finds games that users who liked this game also liked.
        """
        self._build_behavioral_similarity()

        if (
            self._behavioral_similarity_matrix is None
            or game_id not in self._game_ids
        ):
            return []

        game_idx = self._game_ids.index(game_id)
        similarities = self._behavioral_similarity_matrix[game_idx]

        similar_indices = np.argsort(similarities)[::-1]

        similarity_scores = []
        for idx in similar_indices:
            if idx == game_idx:
                continue
            if len(similarity_scores) >= top_n:
                break

            similar_game_id = self._game_ids[idx]
            game = self.db.get_game(similar_game_id)
            if game:
                similarity_scores.append(
                    SimilarityScore(
                        game_id=similar_game_id,
                        game_title=game.title,
                        similarity_score=float(min(max(similarities[idx], 0.0), 1.0)),
                        similarity_type="behavioral",
                    )
                )

        return similarity_scores

    def get_combined_similarity(
        self,
        game_id: int,
        top_n: int = 10,
        feature_weight: float = 0.5,
        behavioral_weight: float = 0.5,
    ) -> list[SimilarityScore]:
        """
        Get similar games using combined similarity scores.
        
        Combines feature-based and behavioral similarity.
        """
        feature_sims = self.get_feature_similarity(game_id, top_n * 2)
        behavioral_sims = self.get_behavioral_similarity(game_id, top_n * 2)

        combined_scores: dict[int, tuple[float, str]] = {}

        for sim in feature_sims:
            combined_scores[sim.game_id] = (
                sim.similarity_score * feature_weight,
                sim.game_title,
            )

        for sim in behavioral_sims:
            if sim.game_id in combined_scores:
                old_score, title = combined_scores[sim.game_id]
                combined_scores[sim.game_id] = (
                    old_score + sim.similarity_score * behavioral_weight,
                    title,
                )
            else:
                combined_scores[sim.game_id] = (
                    sim.similarity_score * behavioral_weight,
                    sim.game_title,
                )

        sorted_combined = sorted(
            combined_scores.items(), key=lambda x: x[1][0], reverse=True
        )[:top_n]

        return [
            SimilarityScore(
                game_id=game_id,
                game_title=data[1],
                similarity_score=float(min(data[0], 1.0)),
                similarity_type="combined",
            )
            for game_id, data in sorted_combined
        ]

    def get_similarity_response(
        self,
        game_id: int,
        similarity_type: str = "combined",
        top_n: int = 10,
    ) -> SimilarityResponse:
        """
        Get similarity response for a game.
        
        Args:
            game_id: The game ID to find similar games for
            similarity_type: One of 'feature', 'behavioral', or 'combined'
            top_n: Number of similar games to return
        """
        source_game = self.db.get_game(game_id)
        if not source_game:
            return SimilarityResponse(
                source_game_id=game_id,
                source_game_title="Unknown",
                similar_games=[],
            )

        if similarity_type == "feature":
            similar_games = self.get_feature_similarity(game_id, top_n)
        elif similarity_type == "behavioral":
            similar_games = self.get_behavioral_similarity(game_id, top_n)
        else:
            similar_games = self.get_combined_similarity(game_id, top_n)

        return SimilarityResponse(
            source_game_id=game_id,
            source_game_title=source_game.title,
            similar_games=similar_games,
        )

    def get_similarity_matrix(
        self, game_ids: list[int], similarity_type: str = "combined"
    ) -> dict[int, dict[int, float]]:
        """
        Get pairwise similarity matrix for a list of games.
        
        Returns a dictionary mapping game_id -> {other_game_id -> similarity_score}.
        """
        similarity_matrix: dict[int, dict[int, float]] = {}

        for game_id in game_ids:
            if similarity_type == "feature":
                similar_games = self.get_feature_similarity(game_id, len(game_ids))
            elif similarity_type == "behavioral":
                similar_games = self.get_behavioral_similarity(game_id, len(game_ids))
            else:
                similar_games = self.get_combined_similarity(game_id, len(game_ids))

            similarity_matrix[game_id] = {
                sim.game_id: sim.similarity_score
                for sim in similar_games
                if sim.game_id in game_ids
            }

        return similarity_matrix

    def find_bridge_games(
        self, game_id_a: int, game_id_b: int, top_n: int = 5
    ) -> list[SimilarityScore]:
        """
        Find games that bridge two different games.
        
        Useful for discovering games that share characteristics with both inputs.
        """
        similar_to_a = self.get_combined_similarity(game_id_a, top_n * 3)
        similar_to_b = self.get_combined_similarity(game_id_b, top_n * 3)

        scores_a = {sim.game_id: sim.similarity_score for sim in similar_to_a}
        scores_b = {sim.game_id: sim.similarity_score for sim in similar_to_b}

        common_games = set(scores_a.keys()) & set(scores_b.keys())
        common_games.discard(game_id_a)
        common_games.discard(game_id_b)

        bridge_scores = []
        for gid in common_games:
            combined_score = (scores_a[gid] + scores_b[gid]) / 2
            game = self.db.get_game(gid)
            if game:
                bridge_scores.append(
                    SimilarityScore(
                        game_id=gid,
                        game_title=game.title,
                        similarity_score=combined_score,
                        similarity_type="bridge",
                    )
                )

        bridge_scores.sort(key=lambda x: x.similarity_score, reverse=True)
        return bridge_scores[:top_n]
