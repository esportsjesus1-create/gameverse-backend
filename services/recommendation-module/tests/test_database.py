"""Tests for in-memory database."""

import numpy as np

from app.database.memory_db import get_database, reset_database
from app.models.schemas import GameCreate, UserCreate, RatingCreate


class TestMemoryDatabase:
    """Tests for MemoryDatabase class."""

    def test_database_initialization(self, db):
        """Test that database initializes with sample data."""
        games = db.get_all_games()
        users = db.get_all_users()
        ratings = db.get_all_ratings()

        assert len(games) > 0
        assert len(users) > 0
        assert len(ratings) > 0

    def test_create_game(self, db):
        """Test creating a new game."""
        initial_count = len(db.get_all_games())
        game_data = GameCreate(
            title="New Test Game",
            genre="Action",
            developer="Test Developer",
            tags=["test", "action"],
            platform=["PC"],
        )
        game = db.create_game(game_data)

        assert game.id is not None
        assert game.title == "New Test Game"
        assert len(db.get_all_games()) == initial_count + 1

    def test_get_game(self, db):
        """Test getting a game by ID."""
        game = db.get_game(1)
        assert game is not None
        assert game.id == 1

    def test_get_game_not_found(self, db):
        """Test getting a non-existent game."""
        game = db.get_game(9999)
        assert game is None

    def test_get_all_games(self, db):
        """Test getting all games."""
        games = db.get_all_games()
        assert isinstance(games, list)
        assert len(games) > 0

    def test_create_user(self, db):
        """Test creating a new user."""
        initial_count = len(db.get_all_users())
        user_data = UserCreate(
            username="newuser",
            preferences={"RPG": 0.8},
        )
        user = db.create_user(user_data)

        assert user.id is not None
        assert user.username == "newuser"
        assert len(db.get_all_users()) == initial_count + 1

    def test_get_user(self, db):
        """Test getting a user by ID."""
        user = db.get_user(1)
        assert user is not None
        assert user.id == 1

    def test_get_user_not_found(self, db):
        """Test getting a non-existent user."""
        user = db.get_user(9999)
        assert user is None

    def test_get_all_users(self, db):
        """Test getting all users."""
        users = db.get_all_users()
        assert isinstance(users, list)
        assert len(users) > 0

    def test_create_rating(self, db):
        """Test creating a new rating."""
        initial_count = len(db.get_all_ratings())
        rating_data = RatingCreate(user_id=1, game_id=3, rating=4.5)
        rating = db.create_rating(rating_data)

        assert rating.id is not None
        assert rating.rating == 4.5
        assert len(db.get_all_ratings()) == initial_count + 1

    def test_get_rating(self, db):
        """Test getting a rating by ID."""
        rating = db.get_rating(1)
        assert rating is not None
        assert rating.id == 1

    def test_get_rating_not_found(self, db):
        """Test getting a non-existent rating."""
        rating = db.get_rating(9999)
        assert rating is None

    def test_get_ratings_by_user(self, db):
        """Test getting ratings by user."""
        ratings = db.get_ratings_by_user(1)
        assert isinstance(ratings, list)
        assert len(ratings) > 0
        assert all(r.user_id == 1 for r in ratings)

    def test_get_ratings_by_game(self, db):
        """Test getting ratings by game."""
        ratings = db.get_ratings_by_game(1)
        assert isinstance(ratings, list)
        assert all(r.game_id == 1 for r in ratings)

    def test_get_all_ratings(self, db):
        """Test getting all ratings."""
        ratings = db.get_all_ratings()
        assert isinstance(ratings, list)
        assert len(ratings) > 0

    def test_get_user_game_matrix(self, db):
        """Test getting user-game rating matrix."""
        matrix, user_ids, game_ids = db.get_user_game_matrix()

        assert isinstance(matrix, np.ndarray)
        assert len(user_ids) > 0
        assert len(game_ids) > 0
        assert matrix.shape == (len(user_ids), len(game_ids))


class TestDatabaseSingleton:
    """Tests for database singleton pattern."""

    def test_get_database_returns_same_instance(self):
        """Test that get_database returns the same instance."""
        reset_database()
        db1 = get_database()
        db2 = get_database()
        assert db1 is db2

    def test_reset_database(self):
        """Test that reset_database creates a new instance."""
        reset_database()
        db1 = get_database()
        reset_database()
        db2 = get_database()
        assert db1 is not db2
