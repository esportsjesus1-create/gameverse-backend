"""Tests for data models."""

import pytest
from datetime import datetime
from pydantic import ValidationError

from app.models.schemas import (
    Game,
    GameCreate,
    User,
    UserCreate,
    Rating,
    RatingCreate,
    Recommendation,
    RecommendationResponse,
    SimilarityScore,
    SimilarityResponse,
    PersonalizationContext,
)


class TestGameModels:
    """Tests for Game models."""

    def test_game_create_valid(self):
        """Test creating a valid GameCreate."""
        game = GameCreate(
            title="Test Game",
            genre="RPG",
            tags=["action", "adventure"],
            developer="Test Dev",
            publisher="Test Pub",
            release_year=2023,
            description="A test game",
            platform=["PC", "PlayStation"],
        )
        assert game.title == "Test Game"
        assert game.genre == "RPG"
        assert len(game.tags) == 2
        assert game.developer == "Test Dev"

    def test_game_create_minimal(self):
        """Test creating GameCreate with minimal fields."""
        game = GameCreate(
            title="Minimal Game",
            genre="Action",
            developer="Dev",
        )
        assert game.title == "Minimal Game"
        assert game.tags == []
        assert game.platform == []
        assert game.publisher is None

    def test_game_create_invalid_title(self):
        """Test that empty title raises validation error."""
        with pytest.raises(ValidationError):
            GameCreate(title="", genre="RPG", developer="Dev")

    def test_game_create_invalid_release_year(self):
        """Test that invalid release year raises validation error."""
        with pytest.raises(ValidationError):
            GameCreate(
                title="Test",
                genre="RPG",
                developer="Dev",
                release_year=1900,
            )

    def test_game_with_id(self):
        """Test Game model with ID."""
        game = Game(
            id=1,
            title="Test Game",
            genre="RPG",
            developer="Dev",
            tags=[],
            platform=[],
        )
        assert game.id == 1
        assert isinstance(game.created_at, datetime)


class TestUserModels:
    """Tests for User models."""

    def test_user_create_valid(self):
        """Test creating a valid UserCreate."""
        user = UserCreate(
            username="testuser",
            preferences={"RPG": 0.9, "Action": 0.7},
        )
        assert user.username == "testuser"
        assert user.preferences["RPG"] == 0.9

    def test_user_create_minimal(self):
        """Test creating UserCreate with minimal fields."""
        user = UserCreate(username="minimal")
        assert user.username == "minimal"
        assert user.preferences == {}

    def test_user_create_invalid_username(self):
        """Test that empty username raises validation error."""
        with pytest.raises(ValidationError):
            UserCreate(username="")

    def test_user_with_id(self):
        """Test User model with ID."""
        user = User(id=1, username="testuser", preferences={})
        assert user.id == 1
        assert isinstance(user.created_at, datetime)


class TestRatingModels:
    """Tests for Rating models."""

    def test_rating_create_valid(self):
        """Test creating a valid RatingCreate."""
        rating = RatingCreate(user_id=1, game_id=1, rating=4.5)
        assert rating.user_id == 1
        assert rating.game_id == 1
        assert rating.rating == 4.5

    def test_rating_create_invalid_rating_high(self):
        """Test that rating > 5.0 raises validation error."""
        with pytest.raises(ValidationError):
            RatingCreate(user_id=1, game_id=1, rating=5.5)

    def test_rating_create_invalid_rating_low(self):
        """Test that rating < 0.0 raises validation error."""
        with pytest.raises(ValidationError):
            RatingCreate(user_id=1, game_id=1, rating=-0.5)

    def test_rating_with_id(self):
        """Test Rating model with ID."""
        rating = Rating(id=1, user_id=1, game_id=1, rating=4.0)
        assert rating.id == 1
        assert isinstance(rating.timestamp, datetime)


class TestRecommendationModels:
    """Tests for Recommendation models."""

    def test_recommendation_valid(self):
        """Test creating a valid Recommendation."""
        rec = Recommendation(
            game_id=1,
            game_title="Test Game",
            score=0.85,
            reason="Test reason",
            algorithm="test_algo",
        )
        assert rec.game_id == 1
        assert rec.score == 0.85

    def test_recommendation_invalid_score_high(self):
        """Test that score > 1.0 raises validation error."""
        with pytest.raises(ValidationError):
            Recommendation(
                game_id=1,
                game_title="Test",
                score=1.5,
                reason="Test",
                algorithm="test",
            )

    def test_recommendation_response(self):
        """Test RecommendationResponse model."""
        response = RecommendationResponse(
            user_id=1,
            recommendations=[],
            algorithm_type="test",
        )
        assert response.user_id == 1
        assert isinstance(response.generated_at, datetime)


class TestSimilarityModels:
    """Tests for Similarity models."""

    def test_similarity_score_valid(self):
        """Test creating a valid SimilarityScore."""
        score = SimilarityScore(
            game_id=1,
            game_title="Test Game",
            similarity_score=0.75,
            similarity_type="combined",
        )
        assert score.game_id == 1
        assert score.similarity_score == 0.75

    def test_similarity_response(self):
        """Test SimilarityResponse model."""
        response = SimilarityResponse(
            source_game_id=1,
            source_game_title="Test Game",
            similar_games=[],
        )
        assert response.source_game_id == 1
        assert isinstance(response.generated_at, datetime)


class TestPersonalizationContext:
    """Tests for PersonalizationContext model."""

    def test_personalization_context_full(self):
        """Test creating a full PersonalizationContext."""
        context = PersonalizationContext(
            user_id=1,
            session_id="test-session",
            device_type="pc",
            time_of_day="evening",
            recent_interactions=[1, 2, 3],
            current_mood="relaxed",
        )
        assert context.user_id == 1
        assert context.session_id == "test-session"
        assert len(context.recent_interactions) == 3

    def test_personalization_context_minimal(self):
        """Test creating minimal PersonalizationContext."""
        context = PersonalizationContext(user_id=1)
        assert context.user_id == 1
        assert context.session_id is None
        assert context.recent_interactions == []
