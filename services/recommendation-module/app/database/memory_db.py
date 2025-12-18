"""In-memory database implementation for GameVerse recommendation module."""

from datetime import datetime
from typing import Optional
import numpy as np

from app.models.schemas import (
    Game,
    GameCreate,
    User,
    UserCreate,
    Rating,
    RatingCreate,
)


class MemoryDatabase:
    """In-memory database for storing games, users, and ratings."""

    def __init__(self) -> None:
        self._games: dict[int, Game] = {}
        self._users: dict[int, User] = {}
        self._ratings: dict[int, Rating] = {}
        self._game_id_counter = 1
        self._user_id_counter = 1
        self._rating_id_counter = 1
        self._initialize_sample_data()

    def _initialize_sample_data(self) -> None:
        """Initialize database with sample game data."""
        sample_games = [
            GameCreate(
                title="The Witcher 3: Wild Hunt",
                genre="RPG",
                tags=["open-world", "fantasy", "story-rich", "action"],
                developer="CD Projekt Red",
                publisher="CD Projekt",
                release_year=2015,
                description="An epic RPG set in a vast open world",
                platform=["PC", "PlayStation", "Xbox"],
            ),
            GameCreate(
                title="Dark Souls III",
                genre="Action RPG",
                tags=["souls-like", "difficult", "dark-fantasy", "action"],
                developer="FromSoftware",
                publisher="Bandai Namco",
                release_year=2016,
                description="A challenging action RPG",
                platform=["PC", "PlayStation", "Xbox"],
            ),
            GameCreate(
                title="Stardew Valley",
                genre="Simulation",
                tags=["farming", "relaxing", "pixel-art", "indie"],
                developer="ConcernedApe",
                publisher="ConcernedApe",
                release_year=2016,
                description="A farming simulation game",
                platform=["PC", "PlayStation", "Xbox", "Switch"],
            ),
            GameCreate(
                title="Hollow Knight",
                genre="Metroidvania",
                tags=["platformer", "difficult", "indie", "exploration"],
                developer="Team Cherry",
                publisher="Team Cherry",
                release_year=2017,
                description="A challenging metroidvania adventure",
                platform=["PC", "PlayStation", "Xbox", "Switch"],
            ),
            GameCreate(
                title="Civilization VI",
                genre="Strategy",
                tags=["turn-based", "4X", "historical", "multiplayer"],
                developer="Firaxis Games",
                publisher="2K Games",
                release_year=2016,
                description="A turn-based strategy game",
                platform=["PC", "PlayStation", "Xbox", "Switch"],
            ),
            GameCreate(
                title="Elden Ring",
                genre="Action RPG",
                tags=["souls-like", "open-world", "difficult", "fantasy"],
                developer="FromSoftware",
                publisher="Bandai Namco",
                release_year=2022,
                description="An open-world action RPG",
                platform=["PC", "PlayStation", "Xbox"],
            ),
            GameCreate(
                title="Hades",
                genre="Roguelike",
                tags=["action", "indie", "mythology", "fast-paced"],
                developer="Supergiant Games",
                publisher="Supergiant Games",
                release_year=2020,
                description="A roguelike dungeon crawler",
                platform=["PC", "PlayStation", "Xbox", "Switch"],
            ),
            GameCreate(
                title="Red Dead Redemption 2",
                genre="Action Adventure",
                tags=["open-world", "western", "story-rich", "realistic"],
                developer="Rockstar Games",
                publisher="Rockstar Games",
                release_year=2018,
                description="An epic western adventure",
                platform=["PC", "PlayStation", "Xbox"],
            ),
            GameCreate(
                title="Celeste",
                genre="Platformer",
                tags=["difficult", "indie", "pixel-art", "story-rich"],
                developer="Maddy Makes Games",
                publisher="Maddy Makes Games",
                release_year=2018,
                description="A challenging platformer about climbing a mountain",
                platform=["PC", "PlayStation", "Xbox", "Switch"],
            ),
            GameCreate(
                title="Monster Hunter: World",
                genre="Action RPG",
                tags=["co-op", "hunting", "action", "multiplayer"],
                developer="Capcom",
                publisher="Capcom",
                release_year=2018,
                description="Hunt massive monsters in a living ecosystem",
                platform=["PC", "PlayStation", "Xbox"],
            ),
            GameCreate(
                title="Disco Elysium",
                genre="RPG",
                tags=["story-rich", "detective", "dialogue", "indie"],
                developer="ZA/UM",
                publisher="ZA/UM",
                release_year=2019,
                description="A groundbreaking role-playing game",
                platform=["PC", "PlayStation", "Xbox", "Switch"],
            ),
            GameCreate(
                title="Sekiro: Shadows Die Twice",
                genre="Action Adventure",
                tags=["souls-like", "difficult", "ninja", "action"],
                developer="FromSoftware",
                publisher="Activision",
                release_year=2019,
                description="A challenging action-adventure game",
                platform=["PC", "PlayStation", "Xbox"],
            ),
            GameCreate(
                title="Animal Crossing: New Horizons",
                genre="Simulation",
                tags=["relaxing", "life-sim", "multiplayer", "casual"],
                developer="Nintendo",
                publisher="Nintendo",
                release_year=2020,
                description="Build your island paradise",
                platform=["Switch"],
            ),
            GameCreate(
                title="Baldur's Gate 3",
                genre="RPG",
                tags=["turn-based", "fantasy", "story-rich", "co-op"],
                developer="Larian Studios",
                publisher="Larian Studios",
                release_year=2023,
                description="An epic D&D adventure",
                platform=["PC", "PlayStation", "Xbox"],
            ),
            GameCreate(
                title="Factorio",
                genre="Strategy",
                tags=["automation", "building", "sandbox", "indie"],
                developer="Wube Software",
                publisher="Wube Software",
                release_year=2020,
                description="Build and maintain factories",
                platform=["PC", "Switch"],
            ),
        ]

        for game_data in sample_games:
            self.create_game(game_data)

        sample_users = [
            UserCreate(username="gamer1", preferences={"RPG": 0.9, "Action": 0.7}),
            UserCreate(username="gamer2", preferences={"Strategy": 0.8, "Simulation": 0.6}),
            UserCreate(username="gamer3", preferences={"Action RPG": 0.9, "Platformer": 0.5}),
            UserCreate(username="gamer4", preferences={"Indie": 0.8, "Story-rich": 0.9}),
            UserCreate(username="gamer5", preferences={"Multiplayer": 0.7, "Co-op": 0.8}),
        ]

        for user_data in sample_users:
            self.create_user(user_data)

        sample_ratings = [
            (1, 1, 5.0), (1, 2, 4.5), (1, 6, 5.0), (1, 11, 4.0), (1, 14, 5.0),
            (2, 3, 5.0), (2, 5, 4.5), (2, 13, 4.0), (2, 15, 5.0),
            (3, 2, 5.0), (3, 6, 5.0), (3, 7, 4.5), (3, 12, 5.0), (3, 4, 4.0),
            (4, 4, 5.0), (4, 7, 4.5), (4, 9, 5.0), (4, 11, 5.0), (4, 3, 4.0),
            (5, 10, 5.0), (5, 14, 4.5), (5, 1, 4.0), (5, 8, 4.0),
        ]

        for user_id, game_id, rating in sample_ratings:
            self.create_rating(RatingCreate(user_id=user_id, game_id=game_id, rating=rating))

    def create_game(self, game_data: GameCreate) -> Game:
        """Create a new game."""
        game = Game(
            id=self._game_id_counter,
            **game_data.model_dump(),
            created_at=datetime.utcnow(),
        )
        self._games[self._game_id_counter] = game
        self._game_id_counter += 1
        return game

    def get_game(self, game_id: int) -> Optional[Game]:
        """Get a game by ID."""
        return self._games.get(game_id)

    def get_all_games(self) -> list[Game]:
        """Get all games."""
        return list(self._games.values())

    def create_user(self, user_data: UserCreate) -> User:
        """Create a new user."""
        user = User(
            id=self._user_id_counter,
            **user_data.model_dump(),
            created_at=datetime.utcnow(),
        )
        self._users[self._user_id_counter] = user
        self._user_id_counter += 1
        return user

    def get_user(self, user_id: int) -> Optional[User]:
        """Get a user by ID."""
        return self._users.get(user_id)

    def get_all_users(self) -> list[User]:
        """Get all users."""
        return list(self._users.values())

    def create_rating(self, rating_data: RatingCreate) -> Rating:
        """Create a new rating."""
        rating = Rating(
            id=self._rating_id_counter,
            user_id=rating_data.user_id,
            game_id=rating_data.game_id,
            rating=rating_data.rating,
            timestamp=datetime.utcnow(),
        )
        self._ratings[self._rating_id_counter] = rating
        self._rating_id_counter += 1
        return rating

    def get_rating(self, rating_id: int) -> Optional[Rating]:
        """Get a rating by ID."""
        return self._ratings.get(rating_id)

    def get_ratings_by_user(self, user_id: int) -> list[Rating]:
        """Get all ratings by a user."""
        return [r for r in self._ratings.values() if r.user_id == user_id]

    def get_ratings_by_game(self, game_id: int) -> list[Rating]:
        """Get all ratings for a game."""
        return [r for r in self._ratings.values() if r.game_id == game_id]

    def get_all_ratings(self) -> list[Rating]:
        """Get all ratings."""
        return list(self._ratings.values())

    def get_user_game_matrix(self) -> tuple[np.ndarray, list[int], list[int]]:
        """Get user-game rating matrix for collaborative filtering."""
        user_ids = sorted(self._users.keys())
        game_ids = sorted(self._games.keys())

        matrix = np.zeros((len(user_ids), len(game_ids)))

        user_idx_map = {uid: idx for idx, uid in enumerate(user_ids)}
        game_idx_map = {gid: idx for idx, gid in enumerate(game_ids)}

        for rating in self._ratings.values():
            if rating.user_id in user_idx_map and rating.game_id in game_idx_map:
                user_idx = user_idx_map[rating.user_id]
                game_idx = game_idx_map[rating.game_id]
                matrix[user_idx, game_idx] = rating.rating

        return matrix, user_ids, game_ids


_database: Optional[MemoryDatabase] = None


def get_database() -> MemoryDatabase:
    """Get the singleton database instance."""
    global _database
    if _database is None:
        _database = MemoryDatabase()
    return _database


def reset_database() -> None:
    """Reset the database (useful for testing)."""
    global _database
    _database = None
