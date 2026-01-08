"""Tests for API endpoints."""



class TestHealthEndpoint:
    """Tests for health check endpoint."""

    def test_healthz(self, client):
        """Test health check endpoint."""
        response = client.get("/healthz")
        assert response.status_code == 200
        assert response.json() == {"status": "ok"}

    def test_root(self, client):
        """Test root endpoint."""
        response = client.get("/")
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "GameVerse N1.43 Recommendation Module"
        assert data["version"] == "1.43.0"
        assert "features" in data
        assert "endpoints" in data


class TestGamesAPI:
    """Tests for games API endpoints."""

    def test_list_games(self, client):
        """Test listing all games."""
        response = client.get("/games")
        assert response.status_code == 200
        games = response.json()
        assert isinstance(games, list)
        assert len(games) > 0

    def test_list_games_with_limit(self, client):
        """Test listing games with limit."""
        response = client.get("/games?limit=5")
        assert response.status_code == 200
        games = response.json()
        assert len(games) <= 5

    def test_list_games_with_offset(self, client):
        """Test listing games with offset."""
        response = client.get("/games?offset=5&limit=5")
        assert response.status_code == 200
        games = response.json()
        assert isinstance(games, list)

    def test_list_games_filter_by_genre(self, client):
        """Test filtering games by genre."""
        response = client.get("/games?genre=RPG")
        assert response.status_code == 200
        games = response.json()
        for game in games:
            assert game["genre"].lower() == "rpg"

    def test_get_game(self, client):
        """Test getting a specific game."""
        response = client.get("/games/1")
        assert response.status_code == 200
        game = response.json()
        assert game["id"] == 1

    def test_get_game_not_found(self, client):
        """Test getting a non-existent game."""
        response = client.get("/games/9999")
        assert response.status_code == 404

    def test_create_game(self, client):
        """Test creating a new game."""
        game_data = {
            "title": "Test Game",
            "genre": "Action",
            "developer": "Test Dev",
            "tags": ["test"],
            "platform": ["PC"],
        }
        response = client.post("/games", json=game_data)
        assert response.status_code == 201
        game = response.json()
        assert game["title"] == "Test Game"
        assert game["id"] is not None

    def test_search_by_tags(self, client):
        """Test searching games by tags."""
        response = client.get("/games/search/by-tags?tags=action,rpg")
        assert response.status_code == 200
        games = response.json()
        assert isinstance(games, list)

    def test_search_by_tags_match_all(self, client):
        """Test searching games by tags with match_all."""
        response = client.get("/games/search/by-tags?tags=action&match_all=true")
        assert response.status_code == 200
        games = response.json()
        assert isinstance(games, list)


class TestUsersAPI:
    """Tests for users API endpoints."""

    def test_list_users(self, client):
        """Test listing all users."""
        response = client.get("/users")
        assert response.status_code == 200
        users = response.json()
        assert isinstance(users, list)
        assert len(users) > 0

    def test_list_users_with_pagination(self, client):
        """Test listing users with pagination."""
        response = client.get("/users?limit=2&offset=1")
        assert response.status_code == 200
        users = response.json()
        assert len(users) <= 2

    def test_get_user(self, client):
        """Test getting a specific user."""
        response = client.get("/users/1")
        assert response.status_code == 200
        user = response.json()
        assert user["id"] == 1

    def test_get_user_not_found(self, client):
        """Test getting a non-existent user."""
        response = client.get("/users/9999")
        assert response.status_code == 404

    def test_create_user(self, client):
        """Test creating a new user."""
        user_data = {
            "username": "newuser",
            "preferences": {"RPG": 0.9},
        }
        response = client.post("/users", json=user_data)
        assert response.status_code == 201
        user = response.json()
        assert user["username"] == "newuser"
        assert user["id"] is not None

    def test_get_user_ratings(self, client):
        """Test getting user ratings."""
        response = client.get("/users/1/ratings")
        assert response.status_code == 200
        data = response.json()
        assert data["user_id"] == 1
        assert "ratings" in data

    def test_get_user_ratings_not_found(self, client):
        """Test getting ratings for non-existent user."""
        response = client.get("/users/9999/ratings")
        assert response.status_code == 404


class TestRatingsAPI:
    """Tests for ratings API endpoints."""

    def test_list_ratings(self, client):
        """Test listing all ratings."""
        response = client.get("/ratings")
        assert response.status_code == 200
        ratings = response.json()
        assert isinstance(ratings, list)
        assert len(ratings) > 0

    def test_list_ratings_filter_by_user(self, client):
        """Test filtering ratings by user."""
        response = client.get("/ratings?user_id=1")
        assert response.status_code == 200
        ratings = response.json()
        for rating in ratings:
            assert rating["user_id"] == 1

    def test_list_ratings_filter_by_game(self, client):
        """Test filtering ratings by game."""
        response = client.get("/ratings?game_id=1")
        assert response.status_code == 200
        ratings = response.json()
        for rating in ratings:
            assert rating["game_id"] == 1

    def test_list_ratings_filter_by_min_rating(self, client):
        """Test filtering ratings by minimum rating."""
        response = client.get("/ratings?min_rating=4.0")
        assert response.status_code == 200
        ratings = response.json()
        for rating in ratings:
            assert rating["rating"] >= 4.0

    def test_create_rating(self, client):
        """Test creating a new rating."""
        rating_data = {
            "user_id": 1,
            "game_id": 3,
            "rating": 4.5,
        }
        response = client.post("/ratings", json=rating_data)
        assert response.status_code == 201
        rating = response.json()
        assert rating["rating"] == 4.5

    def test_create_rating_invalid_user(self, client):
        """Test creating rating with invalid user."""
        rating_data = {
            "user_id": 9999,
            "game_id": 1,
            "rating": 4.0,
        }
        response = client.post("/ratings", json=rating_data)
        assert response.status_code == 404

    def test_create_rating_invalid_game(self, client):
        """Test creating rating with invalid game."""
        rating_data = {
            "user_id": 1,
            "game_id": 9999,
            "rating": 4.0,
        }
        response = client.post("/ratings", json=rating_data)
        assert response.status_code == 404

    def test_get_rating_stats(self, client):
        """Test getting rating statistics."""
        response = client.get("/ratings/stats")
        assert response.status_code == 200
        stats = response.json()
        assert "total_ratings" in stats
        assert "average_rating" in stats

    def test_get_game_rating_stats(self, client):
        """Test getting game rating statistics."""
        response = client.get("/ratings/game/1/stats")
        assert response.status_code == 200
        stats = response.json()
        assert stats["game_id"] == 1

    def test_get_game_rating_stats_not_found(self, client):
        """Test getting stats for non-existent game."""
        response = client.get("/ratings/game/9999/stats")
        assert response.status_code == 404


class TestRecommendationsAPI:
    """Tests for recommendations API endpoints."""

    def test_collaborative_recommendations(self, client):
        """Test collaborative filtering recommendations."""
        response = client.get("/recommendations/collaborative/1")
        assert response.status_code == 200
        data = response.json()
        assert data["user_id"] == 1
        assert "recommendations" in data

    def test_collaborative_recommendations_methods(self, client):
        """Test different CF methods."""
        methods = ["user_based", "item_based", "svd", "combined"]
        for method in methods:
            response = client.get(f"/recommendations/collaborative/1?method={method}")
            assert response.status_code == 200

    def test_collaborative_recommendations_not_found(self, client):
        """Test CF recommendations for non-existent user."""
        response = client.get("/recommendations/collaborative/9999")
        assert response.status_code == 404

    def test_content_based_recommendations(self, client):
        """Test content-based recommendations."""
        response = client.get("/recommendations/content-based/1")
        assert response.status_code == 200
        data = response.json()
        assert data["user_id"] == 1

    def test_content_based_recommendations_not_found(self, client):
        """Test CB recommendations for non-existent user."""
        response = client.get("/recommendations/content-based/9999")
        assert response.status_code == 404

    def test_hybrid_recommendations(self, client):
        """Test hybrid recommendations."""
        response = client.get("/recommendations/hybrid/1")
        assert response.status_code == 200
        data = response.json()
        assert data["user_id"] == 1

    def test_hybrid_recommendations_methods(self, client):
        """Test different hybrid methods."""
        methods = ["weighted", "switching", "cascade", "auto"]
        for method in methods:
            response = client.get(f"/recommendations/hybrid/1?method={method}")
            assert response.status_code == 200

    def test_hybrid_recommendations_not_found(self, client):
        """Test hybrid recommendations for non-existent user."""
        response = client.get("/recommendations/hybrid/9999")
        assert response.status_code == 404

    def test_personalized_recommendations_post(self, client):
        """Test personalized recommendations via POST."""
        context = {
            "user_id": 1,
            "time_of_day": "evening",
            "device_type": "pc",
            "current_mood": "relaxed",
            "recent_interactions": [1, 2],
        }
        response = client.post("/recommendations/personalized", json=context)
        assert response.status_code == 200
        data = response.json()
        assert data["user_id"] == 1

    def test_personalized_recommendations_get(self, client):
        """Test personalized recommendations via GET."""
        response = client.get(
            "/recommendations/personalized/1?time_of_day=evening&device_type=pc"
        )
        assert response.status_code == 200
        data = response.json()
        assert data["user_id"] == 1

    def test_personalized_recommendations_not_found(self, client):
        """Test personalized recommendations for non-existent user."""
        context = {"user_id": 9999}
        response = client.post("/recommendations/personalized", json=context)
        assert response.status_code == 404

    def test_session_interaction(self, client):
        """Test recording session interaction."""
        response = client.post(
            "/recommendations/session/test-session/interaction?game_id=1"
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "recorded"

    def test_session_interaction_invalid_game(self, client):
        """Test recording interaction with invalid game."""
        response = client.post(
            "/recommendations/session/test-session/interaction?game_id=9999"
        )
        assert response.status_code == 404

    def test_get_session_interactions(self, client):
        """Test getting session interactions."""
        client.post("/recommendations/session/test-session/interaction?game_id=1")
        response = client.get("/recommendations/session/test-session/interactions")
        assert response.status_code == 200
        data = response.json()
        assert data["session_id"] == "test-session"

    def test_clear_session(self, client):
        """Test clearing session."""
        response = client.delete("/recommendations/session/test-session")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "cleared"


class TestSimilarityAPI:
    """Tests for similarity API endpoints."""

    def test_get_similar_games(self, client):
        """Test getting similar games."""
        response = client.get("/similarity/1")
        assert response.status_code == 200
        data = response.json()
        assert data["source_game_id"] == 1
        assert "similar_games" in data

    def test_get_similar_games_types(self, client):
        """Test different similarity types."""
        types = ["feature", "behavioral", "combined"]
        for sim_type in types:
            response = client.get(f"/similarity/1?similarity_type={sim_type}")
            assert response.status_code == 200

    def test_get_similar_games_not_found(self, client):
        """Test similarity for non-existent game."""
        response = client.get("/similarity/9999")
        assert response.status_code == 404

    def test_feature_similar_games(self, client):
        """Test feature-based similarity endpoint."""
        response = client.get("/similarity/1/feature")
        assert response.status_code == 200
        data = response.json()
        for game in data["similar_games"]:
            assert game["similarity_type"] == "feature_based"

    def test_behavioral_similar_games(self, client):
        """Test behavioral similarity endpoint."""
        response = client.get("/similarity/1/behavioral")
        assert response.status_code == 200
        data = response.json()
        for game in data["similar_games"]:
            assert game["similarity_type"] == "behavioral"

    def test_bridge_games(self, client):
        """Test bridge games endpoint."""
        response = client.get("/similarity/bridge/1/2")
        assert response.status_code == 200
        data = response.json()
        assert data["game_a"]["id"] == 1
        assert data["game_b"]["id"] == 2
        assert "bridge_games" in data

    def test_bridge_games_not_found(self, client):
        """Test bridge games with non-existent game."""
        response = client.get("/similarity/bridge/1/9999")
        assert response.status_code == 404

    def test_similarity_matrix(self, client):
        """Test similarity matrix endpoint."""
        response = client.post(
            "/similarity/matrix",
            json=[1, 2, 3],
        )
        assert response.status_code == 200
        data = response.json()
        assert "matrix" in data

    def test_similarity_matrix_invalid_game(self, client):
        """Test similarity matrix with invalid game."""
        response = client.post(
            "/similarity/matrix",
            json=[1, 9999],
        )
        assert response.status_code == 404
