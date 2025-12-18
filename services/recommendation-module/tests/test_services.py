"""Tests for recommendation services."""


from app.services.collaborative_filtering import CollaborativeFilteringEngine
from app.services.content_based import ContentBasedEngine
from app.services.hybrid import HybridRecommendationEngine
from app.services.personalization import PersonalizationEngine
from app.services.similarity import SimilarityEngine
from app.models.schemas import PersonalizationContext


class TestCollaborativeFilteringEngine:
    """Tests for CollaborativeFilteringEngine."""

    def test_user_based_recommendations(self, db):
        """Test user-based collaborative filtering."""
        engine = CollaborativeFilteringEngine(db)
        response = engine.get_user_based_recommendations(1, top_n=5)

        assert response.user_id == 1
        assert response.algorithm_type == "user_based_collaborative_filtering"
        assert len(response.recommendations) <= 5

    def test_item_based_recommendations(self, db):
        """Test item-based collaborative filtering."""
        engine = CollaborativeFilteringEngine(db)
        response = engine.get_item_based_recommendations(1, top_n=5)

        assert response.user_id == 1
        assert response.algorithm_type == "item_based_collaborative_filtering"

    def test_svd_recommendations(self, db):
        """Test SVD-based recommendations."""
        engine = CollaborativeFilteringEngine(db)
        response = engine.get_svd_recommendations(1, top_n=5)

        assert response.user_id == 1
        assert response.algorithm_type == "svd_matrix_factorization"

    def test_combined_recommendations(self, db):
        """Test combined collaborative filtering."""
        engine = CollaborativeFilteringEngine(db)
        response = engine.get_recommendations(1, method="combined", top_n=5)

        assert response.user_id == 1
        assert response.algorithm_type == "combined_collaborative_filtering"

    def test_recommendations_for_nonexistent_user(self, db):
        """Test recommendations for non-existent user."""
        engine = CollaborativeFilteringEngine(db)
        response = engine.get_recommendations(9999, top_n=5)

        assert response.user_id == 9999
        assert len(response.recommendations) == 0

    def test_recommendation_scores_valid(self, db):
        """Test that recommendation scores are valid."""
        engine = CollaborativeFilteringEngine(db)
        response = engine.get_recommendations(1, top_n=10)

        for rec in response.recommendations:
            assert 0.0 <= rec.score <= 1.0
            assert rec.game_id > 0
            assert len(rec.game_title) > 0


class TestContentBasedEngine:
    """Tests for ContentBasedEngine."""

    def test_content_based_recommendations(self, db):
        """Test content-based recommendations."""
        engine = ContentBasedEngine(db)
        response = engine.get_recommendations(1, top_n=5)

        assert response.user_id == 1
        assert "content" in response.algorithm_type.lower()

    def test_cold_start_recommendations(self, db):
        """Test recommendations for user with no ratings."""
        from app.models.schemas import UserCreate
        new_user = db.create_user(UserCreate(username="newuser", preferences={"RPG": 0.9}))

        engine = ContentBasedEngine(db)
        response = engine.get_recommendations(new_user.id, top_n=5)

        assert response.user_id == new_user.id
        assert len(response.recommendations) > 0

    def test_similar_by_content(self, db):
        """Test getting similar games by content."""
        engine = ContentBasedEngine(db)
        similar = engine.get_similar_by_content(1, top_n=5)

        assert isinstance(similar, list)
        assert len(similar) <= 5
        for game_id, score in similar:
            assert game_id != 1
            assert 0.0 <= score <= 1.0

    def test_content_recommendations_exclude_rated(self, db):
        """Test that content recommendations exclude already rated games."""
        engine = ContentBasedEngine(db)
        response = engine.get_recommendations(1, top_n=10)

        user_ratings = db.get_ratings_by_user(1)
        rated_game_ids = {r.game_id for r in user_ratings}

        for rec in response.recommendations:
            assert rec.game_id not in rated_game_ids


class TestHybridRecommendationEngine:
    """Tests for HybridRecommendationEngine."""

    def test_weighted_hybrid(self, db):
        """Test weighted hybrid recommendations."""
        engine = HybridRecommendationEngine(db)
        response = engine.get_weighted_hybrid_recommendations(1, top_n=5)

        assert response.user_id == 1
        assert response.algorithm_type == "weighted_hybrid"

    def test_switching_hybrid(self, db):
        """Test switching hybrid recommendations."""
        engine = HybridRecommendationEngine(db)
        response = engine.get_switching_hybrid_recommendations(1, top_n=5)

        assert response.user_id == 1
        assert "switching_hybrid" in response.algorithm_type

    def test_cascade_hybrid(self, db):
        """Test cascade hybrid recommendations."""
        engine = HybridRecommendationEngine(db)
        response = engine.get_cascade_hybrid_recommendations(1, top_n=5)

        assert response.user_id == 1
        assert response.algorithm_type == "cascade_hybrid"

    def test_auto_method(self, db):
        """Test auto method selection."""
        engine = HybridRecommendationEngine(db)
        response = engine.get_recommendations(1, method="auto", top_n=5)

        assert response.user_id == 1
        assert len(response.recommendations) > 0

    def test_hybrid_scores_valid(self, db):
        """Test that hybrid scores are valid."""
        engine = HybridRecommendationEngine(db)
        response = engine.get_recommendations(1, top_n=10)

        for rec in response.recommendations:
            assert 0.0 <= rec.score <= 1.0


class TestPersonalizationEngine:
    """Tests for PersonalizationEngine."""

    def test_personalized_recommendations(self, db):
        """Test personalized recommendations."""
        engine = PersonalizationEngine(db)
        context = PersonalizationContext(
            user_id=1,
            time_of_day="evening",
            device_type="pc",
            current_mood="relaxed",
        )
        response = engine.get_personalized_recommendations(context, top_n=5)

        assert response.user_id == 1
        assert response.algorithm_type == "real_time_personalized"

    def test_personalized_with_session(self, db):
        """Test personalized recommendations with session interactions."""
        engine = PersonalizationEngine(db)
        engine.record_interaction("test-session", 1)
        engine.record_interaction("test-session", 2)

        context = PersonalizationContext(
            user_id=1,
            session_id="test-session",
            recent_interactions=[1, 2],
        )
        response = engine.get_personalized_recommendations(context, top_n=5)

        assert response.user_id == 1

    def test_record_interaction(self, db):
        """Test recording session interactions."""
        engine = PersonalizationEngine(db)
        engine.record_interaction("session1", 1)
        engine.record_interaction("session1", 2)

        interactions = engine.get_session_interactions("session1")
        assert 1 in interactions
        assert 2 in interactions

    def test_clear_session(self, db):
        """Test clearing session."""
        engine = PersonalizationEngine(db)
        engine.record_interaction("session1", 1)
        engine.clear_session("session1")

        interactions = engine.get_session_interactions("session1")
        assert len(interactions) == 0

    def test_diversity_reranking(self, db):
        """Test that diversity reranking works."""
        engine = PersonalizationEngine(db)
        context = PersonalizationContext(user_id=1)

        response_with_diversity = engine.get_personalized_recommendations(
            context, top_n=10, apply_diversity=True
        )
        response_without_diversity = engine.get_personalized_recommendations(
            context, top_n=10, apply_diversity=False
        )

        assert len(response_with_diversity.recommendations) > 0
        assert len(response_without_diversity.recommendations) > 0


class TestSimilarityEngine:
    """Tests for SimilarityEngine."""

    def test_feature_similarity(self, db):
        """Test feature-based similarity."""
        engine = SimilarityEngine(db)
        similar = engine.get_feature_similarity(1, top_n=5)

        assert isinstance(similar, list)
        assert len(similar) <= 5
        for score in similar:
            assert score.game_id != 1
            assert 0.0 <= score.similarity_score <= 1.0
            assert score.similarity_type == "feature_based"

    def test_behavioral_similarity(self, db):
        """Test behavioral similarity."""
        engine = SimilarityEngine(db)
        similar = engine.get_behavioral_similarity(1, top_n=5)

        assert isinstance(similar, list)
        for score in similar:
            assert score.similarity_type == "behavioral"

    def test_combined_similarity(self, db):
        """Test combined similarity."""
        engine = SimilarityEngine(db)
        similar = engine.get_combined_similarity(1, top_n=5)

        assert isinstance(similar, list)
        for score in similar:
            assert score.similarity_type == "combined"

    def test_similarity_response(self, db):
        """Test similarity response."""
        engine = SimilarityEngine(db)
        response = engine.get_similarity_response(1, top_n=5)

        assert response.source_game_id == 1
        assert len(response.source_game_title) > 0
        assert isinstance(response.similar_games, list)

    def test_similarity_nonexistent_game(self, db):
        """Test similarity for non-existent game."""
        engine = SimilarityEngine(db)
        response = engine.get_similarity_response(9999, top_n=5)

        assert response.source_game_id == 9999
        assert response.source_game_title == "Unknown"
        assert len(response.similar_games) == 0

    def test_bridge_games(self, db):
        """Test finding bridge games."""
        engine = SimilarityEngine(db)
        bridge = engine.find_bridge_games(1, 2, top_n=3)

        assert isinstance(bridge, list)
        for score in bridge:
            assert score.game_id not in [1, 2]
            assert score.similarity_type == "bridge"

    def test_similarity_matrix(self, db):
        """Test similarity matrix."""
        engine = SimilarityEngine(db)
        game_ids = [1, 2, 3]
        matrix = engine.get_similarity_matrix(game_ids)

        assert isinstance(matrix, dict)
        for game_id in game_ids:
            assert game_id in matrix
