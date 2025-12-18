# GameVerse N1.43 Recommendation Module

ML-powered game recommendation engine with collaborative filtering, content-based recommendations, hybrid algorithms, real-time personalization, and item similarity scoring.

## Features

- **Collaborative Filtering**: User-based, item-based, and SVD matrix factorization
- **Content-Based Recommendations**: TF-IDF vectorization and categorical feature matching
- **Hybrid Algorithms**: Weighted, switching, and cascade hybrid approaches
- **Real-Time Personalization**: Context-aware recommendations based on time, device, mood, and session
- **Item Similarity Scoring**: Feature-based, behavioral, and combined similarity metrics

## Quick Start

### Local Development

```bash
# Install dependencies
poetry install

# Run the development server
poetry run fastapi dev app/main.py

# Run tests
poetry run pytest tests/ -v --cov=app
```

### Docker

```bash
# Build and run
docker-compose up --build

# Run tests in Docker
docker-compose --profile test up recommendation-tests
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/games` | GET | List all games |
| `/users` | GET | List all users |
| `/ratings` | GET/POST | Manage ratings |
| `/recommendations/collaborative/{user_id}` | GET | Collaborative filtering recommendations |
| `/recommendations/content-based/{user_id}` | GET | Content-based recommendations |
| `/recommendations/hybrid/{user_id}` | GET | Hybrid recommendations |
| `/recommendations/personalized/{user_id}` | GET | Real-time personalized recommendations |
| `/similarity/{game_id}` | GET | Similar games |

## Test Coverage

94% test coverage with 117 tests covering models, database, services, and API endpoints.

## License

MIT
