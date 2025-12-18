"""Content-based recommendation engine for GameVerse."""

import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from typing import Optional

from app.database.memory_db import MemoryDatabase
from app.models.schemas import Recommendation, RecommendationResponse, Game


class ContentBasedEngine:
    """
    Content-based recommendation engine.
    
    Implements:
    - TF-IDF vectorization for text features
    - Feature extraction from game attributes
    - Cosine similarity for content matching
    """

    def __init__(self, database: MemoryDatabase) -> None:
        self.db = database
        self._tfidf_matrix: Optional[np.ndarray] = None
        self._feature_matrix: Optional[np.ndarray] = None
        self._game_ids: list[int] = []
        self._vectorizer: Optional[TfidfVectorizer] = None

    def _build_content_features(self) -> None:
        """Build content feature matrices from game data."""
        games = self.db.get_all_games()
        if not games:
            return

        self._game_ids = [game.id for game in games]

        documents = []
        for game in games:
            doc_parts = [
                game.title,
                game.genre,
                game.developer,
                game.publisher or "",
                game.description or "",
                " ".join(game.tags),
                " ".join(game.platform),
            ]
            documents.append(" ".join(doc_parts).lower())

        self._vectorizer = TfidfVectorizer(
            stop_words="english",
            max_features=1000,
            ngram_range=(1, 2),
        )
        self._tfidf_matrix = self._vectorizer.fit_transform(documents).toarray()

        self._build_categorical_features(games)

    def _build_categorical_features(self, games: list[Game]) -> None:
        """Build categorical feature matrix."""
        all_genres = set()
        all_tags = set()
        all_platforms = set()
        all_developers = set()

        for game in games:
            all_genres.add(game.genre.lower())
            all_tags.update(tag.lower() for tag in game.tags)
            all_platforms.update(p.lower() for p in game.platform)
            all_developers.add(game.developer.lower())

        genre_list = sorted(all_genres)
        tag_list = sorted(all_tags)
        platform_list = sorted(all_platforms)
        developer_list = sorted(all_developers)

        num_features = len(genre_list) + len(tag_list) + len(platform_list) + len(developer_list)
        self._feature_matrix = np.zeros((len(games), num_features))

        for i, game in enumerate(games):
            offset = 0

            if game.genre.lower() in genre_list:
                self._feature_matrix[i, genre_list.index(game.genre.lower())] = 1.0
            offset += len(genre_list)

            for tag in game.tags:
                if tag.lower() in tag_list:
                    self._feature_matrix[i, offset + tag_list.index(tag.lower())] = 1.0
            offset += len(tag_list)

            for platform in game.platform:
                if platform.lower() in platform_list:
                    self._feature_matrix[i, offset + platform_list.index(platform.lower())] = 1.0
            offset += len(platform_list)

            if game.developer.lower() in developer_list:
                self._feature_matrix[i, offset + developer_list.index(game.developer.lower())] = 1.0

    def _get_user_profile(self, user_id: int) -> Optional[np.ndarray]:
        """Build user profile from their ratings."""
        if self._tfidf_matrix is None:
            return None

        user_ratings = self.db.get_ratings_by_user(user_id)
        if not user_ratings:
            return None

        profile = np.zeros(self._tfidf_matrix.shape[1])
        total_weight = 0.0

        for rating in user_ratings:
            if rating.game_id in self._game_ids:
                game_idx = self._game_ids.index(rating.game_id)
                weight = rating.rating / 5.0
                profile += weight * self._tfidf_matrix[game_idx]
                total_weight += weight

        if total_weight > 0:
            profile /= total_weight

        return profile

    def _get_user_categorical_profile(self, user_id: int) -> Optional[np.ndarray]:
        """Build user categorical profile from their ratings."""
        if self._feature_matrix is None:
            return None

        user_ratings = self.db.get_ratings_by_user(user_id)
        if not user_ratings:
            return None

        profile = np.zeros(self._feature_matrix.shape[1])
        total_weight = 0.0

        for rating in user_ratings:
            if rating.game_id in self._game_ids:
                game_idx = self._game_ids.index(rating.game_id)
                weight = rating.rating / 5.0
                profile += weight * self._feature_matrix[game_idx]
                total_weight += weight

        if total_weight > 0:
            profile /= total_weight

        return profile

    def get_recommendations(
        self, user_id: int, top_n: int = 10
    ) -> RecommendationResponse:
        """
        Get content-based recommendations for a user.
        
        Uses TF-IDF similarity between user profile and game content.
        """
        self._build_content_features()

        user = self.db.get_user(user_id)
        if not user:
            return RecommendationResponse(
                user_id=user_id,
                recommendations=[],
                algorithm_type="content_based",
            )

        user_profile = self._get_user_profile(user_id)
        user_cat_profile = self._get_user_categorical_profile(user_id)

        if user_profile is None or self._tfidf_matrix is None:
            return self._get_cold_start_recommendations(user_id, top_n)

        tfidf_similarities = cosine_similarity(
            user_profile.reshape(1, -1), self._tfidf_matrix
        )[0]

        if user_cat_profile is not None and self._feature_matrix is not None:
            cat_similarities = cosine_similarity(
                user_cat_profile.reshape(1, -1), self._feature_matrix
            )[0]
            combined_similarities = 0.6 * tfidf_similarities + 0.4 * cat_similarities
        else:
            combined_similarities = tfidf_similarities

        user_ratings = self.db.get_ratings_by_user(user_id)
        rated_game_ids = {r.game_id for r in user_ratings}

        predictions = []
        for idx, score in enumerate(combined_similarities):
            game_id = self._game_ids[idx]
            if game_id not in rated_game_ids:
                predictions.append((game_id, score))

        predictions.sort(key=lambda x: x[1], reverse=True)
        top_predictions = predictions[:top_n]

        recommendations = []
        for game_id, score in top_predictions:
            game = self.db.get_game(game_id)
            if game:
                recommendations.append(
                    Recommendation(
                        game_id=game_id,
                        game_title=game.title,
                        score=float(min(max(score, 0.0), 1.0)),
                        reason=f"Matches your interest in {game.genre} games",
                        algorithm="content_based_tfidf",
                    )
                )

        return RecommendationResponse(
            user_id=user_id,
            recommendations=recommendations,
            algorithm_type="content_based",
        )

    def _get_cold_start_recommendations(
        self, user_id: int, top_n: int = 10
    ) -> RecommendationResponse:
        """
        Get recommendations for users with no rating history.
        
        Uses user preferences if available, otherwise returns popular games.
        """
        user = self.db.get_user(user_id)
        games = self.db.get_all_games()

        if not games:
            return RecommendationResponse(
                user_id=user_id,
                recommendations=[],
                algorithm_type="content_based_cold_start",
            )

        if user and user.preferences:
            scored_games = []
            for game in games:
                score = 0.0
                genre_lower = game.genre.lower()
                tags_lower = [t.lower() for t in game.tags]

                for pref_key, pref_value in user.preferences.items():
                    pref_lower = pref_key.lower()
                    if pref_lower in genre_lower:
                        score += pref_value * 0.5
                    if any(pref_lower in tag for tag in tags_lower):
                        score += pref_value * 0.3

                scored_games.append((game, score))

            scored_games.sort(key=lambda x: x[1], reverse=True)
            top_games = scored_games[:top_n]
        else:
            all_ratings = self.db.get_all_ratings()
            game_scores: dict[int, tuple[float, int]] = {}

            for rating in all_ratings:
                if rating.game_id not in game_scores:
                    game_scores[rating.game_id] = (0.0, 0)
                total, count = game_scores[rating.game_id]
                game_scores[rating.game_id] = (total + rating.rating, count + 1)

            avg_scores = {
                gid: total / count for gid, (total, count) in game_scores.items()
            }

            top_games = []
            for game in games:
                score = avg_scores.get(game.id, 3.0) / 5.0
                top_games.append((game, score))

            top_games.sort(key=lambda x: x[1], reverse=True)
            top_games = top_games[:top_n]

        recommendations = [
            Recommendation(
                game_id=game.id,
                game_title=game.title,
                score=float(min(max(score, 0.0), 1.0)),
                reason="Recommended based on your preferences" if user and user.preferences else "Popular game",
                algorithm="content_based_cold_start",
            )
            for game, score in top_games
        ]

        return RecommendationResponse(
            user_id=user_id,
            recommendations=recommendations,
            algorithm_type="content_based_cold_start",
        )

    def get_similar_by_content(
        self, game_id: int, top_n: int = 10
    ) -> list[tuple[int, float]]:
        """
        Get games similar to a given game based on content.
        
        Returns list of (game_id, similarity_score) tuples.
        """
        self._build_content_features()

        if game_id not in self._game_ids or self._tfidf_matrix is None:
            return []

        game_idx = self._game_ids.index(game_id)

        tfidf_similarities = cosine_similarity(
            self._tfidf_matrix[game_idx].reshape(1, -1), self._tfidf_matrix
        )[0]

        if self._feature_matrix is not None:
            cat_similarities = cosine_similarity(
                self._feature_matrix[game_idx].reshape(1, -1), self._feature_matrix
            )[0]
            combined_similarities = 0.5 * tfidf_similarities + 0.5 * cat_similarities
        else:
            combined_similarities = tfidf_similarities

        similar_games = []
        for idx, score in enumerate(combined_similarities):
            if idx != game_idx:
                similar_games.append((self._game_ids[idx], float(score)))

        similar_games.sort(key=lambda x: x[1], reverse=True)
        return similar_games[:top_n]
